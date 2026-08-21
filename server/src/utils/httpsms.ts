import { env } from "../config/env.js";

const HTTPSMS_API_URL = "https://api.httpsms.com/v1/messages/send";

export interface SendSmsInput {
  to: string;
  message: string;
  requestId?: string;
}

export interface HttpsmsResponse {
  [key: string]: unknown;
}

export async function sendSms(
  input: SendSmsInput,
): Promise<HttpsmsResponse> {
  const response = await fetch(HTTPSMS_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.HTTPSMS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: input.message,
      from: env.HTTPSMS_FROM_PHONE,
      to: input.to,
      encrypted: false,
      ...(input.requestId
        ? { request_id: input.requestId }
        : {}),
    }),
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = JSON.parse(responseText);
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    console.error("❌ HTTPSMS API error:", {
      status: response.status,
      statusText: response.statusText,
      response: data,
    });

    throw new Error(
      `HTTPSMS SMS request failed with status ${response.status}`,
    );
  }

  return data as HttpsmsResponse;
}