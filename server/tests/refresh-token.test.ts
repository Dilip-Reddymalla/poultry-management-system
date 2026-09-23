import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  cleanupTestData,
  createActor,
  prisma,
  TEST_PASSWORD,
  type TestActor,
} from "./helpers.js";
import { REFRESH_COOKIE_NAME } from "../src/utils/refresh-cookie.js";
import { AUTH_COOKIE_NAME } from "../src/utils/auth-cookie.js";

function extractCookie(
  setCookieHeaders: string[] | string | undefined,
  name: string,
): string | undefined {
  if (!setCookieHeaders) return undefined;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const target = list.find((cookie) => cookie.startsWith(`${name}=`));
  if (!target) return undefined;
  return target.split(";")[0];
}

describe("Refresh Token System", () => {
  let supervisor: TestActor;

  beforeAll(async () => {
    await cleanupTestData();
    supervisor = await createActor("Supervisor");
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  it("issues both auth and refresh cookies on login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: supervisor.email,
        password: TEST_PASSWORD,
      });

    expect(res.status).toBe(200);
    const authCookie = extractCookie(res.headers["set-cookie"], AUTH_COOKIE_NAME);
    const refreshCookie = extractCookie(res.headers["set-cookie"], REFRESH_COOKIE_NAME);

    expect(authCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
  });

  it("rotates refresh token and issues new access token on /refresh", async () => {
    // 1. Login
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: supervisor.email,
        password: TEST_PASSWORD,
      });

    const oldRefreshCookie = extractCookie(loginRes.headers["set-cookie"], REFRESH_COOKIE_NAME)!;
    expect(oldRefreshCookie).toBeDefined();

    // 2. Call /refresh
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldRefreshCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);

    const newAuthCookie = extractCookie(refreshRes.headers["set-cookie"], AUTH_COOKIE_NAME);
    const newRefreshCookie = extractCookie(refreshRes.headers["set-cookie"], REFRESH_COOKIE_NAME);

    expect(newAuthCookie).toBeDefined();
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).not.toBe(oldRefreshCookie);

    // 3. Old refresh token should be rejected (rotation / reuse detection)
    const replayRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldRefreshCookie);

    expect(replayRes.status).toBe(401);
  });

  it("revokes refresh token on logout", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: supervisor.email,
        password: TEST_PASSWORD,
      });

    const refreshCookie = extractCookie(loginRes.headers["set-cookie"], REFRESH_COOKIE_NAME)!;

    // Logout
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", refreshCookie);

    expect(logoutRes.status).toBe(200);

    // Refresh should now fail because token was revoked
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshRes.status).toBe(401);
  });

  it("revokes all tokens on /logout-all", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: supervisor.email,
        password: TEST_PASSWORD,
      });

    const authCookie = extractCookie(loginRes.headers["set-cookie"], AUTH_COOKIE_NAME)!;
    const refreshCookie = extractCookie(loginRes.headers["set-cookie"], REFRESH_COOKIE_NAME)!;

    // Logout all
    const logoutAllRes = await request(app)
      .post("/api/auth/logout-all")
      .set("Cookie", authCookie);

    expect(logoutAllRes.status).toBe(200);

    // Refresh should fail
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshRes.status).toBe(401);
  });
});
