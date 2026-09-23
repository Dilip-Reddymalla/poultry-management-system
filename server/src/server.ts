import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { logger } from "./config/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
});

const gracefulShutdown = async () => {
  logger.info("Shutting down gracefully...");
  server.close(async () => {
    logger.info("Closed out remaining connections.");
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
};

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught Exception");
});

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);