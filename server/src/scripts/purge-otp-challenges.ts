import { prisma } from "../config/database.js";
import { purgeExpiredOtpChallenges } from "../modules/auth/auth.service.js";
import { logger } from "../config/logger.js";

async function main(): Promise<void> {
  logger.info("🧹 Purging expired OTP challenges...");

  const { deleted } = await purgeExpiredOtpChallenges();

  logger.info(`🧹 Removed ${deleted} expired OTP challenge(s).`);
}

main()
  .catch((error) => {
    logger.error({ error }, "❌ OTP cleanup failed");

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
