import app from "./app.js";
import {env} from "./config/env.js"

import { prisma } from "./config/database.js";

const server = app.listen(env.PORT, ()=>{
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
});

const gracefulShutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close(async () => {
        console.log("Closed out remaining connections.");
        await prisma.$disconnect();
        process.exit(0);
    });

    setTimeout(() => {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);