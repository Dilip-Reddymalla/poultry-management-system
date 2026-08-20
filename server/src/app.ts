import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRouter from "./modules/auth/auth.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";


const app = express();

app.use(
    cors({
        origin: "http://localhost:5173",
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



app.use(errorMiddleware);

export default app;