import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { clientOrigin, env } from "./config/env.js";
import authRouter from "./modules/auth/auth.routes.js";
import employeeRouter from "./modules/employee/employee.routes.js";
import farmRouter from "./modules/farm/farm.routes.js";
import shedRouter from "./modules/shed/shed.routes.js";
import companyRouter from "./modules/company/company.routes.js";
import workerRouter from "./modules/worker/worker.routes.js";
import attendanceRouter from "./modules/attendance/attendance.routes.js";
import auditRouter from "./modules/audit/audit.routes.js";
import {
    designationRouter,
    roleRouter,
} from "./modules/reference/reference.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

const app = express();

// CORS middleware: Echoes requesting origin to satisfy browser CORS & credential requirements
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Cookie",
    );
  }

  // Preflight OPTIONS requests must terminate immediately with 204 No Content
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

// Request status & IP logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip ||
    "unknown";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    console.log(
      `[${new Date().toISOString()}] ${method} ${url} -> Status: ${statusCode} (${duration}ms) | IP: ${clientIp}`
    );
  });

  next();
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());

app.get('/api/health',(_req,res)=>{
    res.status(200).json({
        success:true,
        message:"Poultry Management API is running"
    });
});

app.use("/api/auth",authRouter);
app.use("/api/companies", companyRouter);
app.use("/api/farms", farmRouter);
app.use("/api/sheds", shedRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/workers", workerRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/audit-logs", auditRouter);
app.use("/api/designations", designationRouter);
app.use("/api/roles", roleRouter);

if (env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const clientBuildPath = path.join(__dirname, "../../../client/dist");
    
    if (fs.existsSync(clientBuildPath)) {
        app.use(express.static(clientBuildPath));
        app.get(/(.*)/, (req, res, next) => {
            if (req.originalUrl.startsWith("/api/")) {
                return next();
            }
            res.sendFile(path.join(clientBuildPath, "index.html"));
        });
    }
}

// Unmatched routes would otherwise fall through to Express' HTML error page;
// an API client should always receive the standard JSON error envelope.
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

app.use(errorMiddleware);

export default app;
