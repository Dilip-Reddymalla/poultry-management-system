import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { clientOrigin } from "./config/env.js";
import authRouter from "./modules/auth/auth.routes.js";
import employeeRouter from "./modules/employee/employee.routes.js";
import farmRouter from "./modules/farm/farm.routes.js";
import shedRouter from "./modules/shed/shed.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";


const app = express();

// The frontend is a separate origin and authenticates with the session cookie,
// so credentials must be allowed and the origin named explicitly — the CORS spec
// forbids a wildcard origin on credentialed requests.
app.use(
    cors({
        origin: clientOrigin,
        credentials: true,
    }),
);


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
app.use("/api/employees", employeeRouter);
app.use("/api/farms", farmRouter);
app.use("/api/sheds", shedRouter);

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
