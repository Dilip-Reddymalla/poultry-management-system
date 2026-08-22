import { prisma } from "../config/database.js";
import { purgeExpiredOtpChallenges } from "../modules/auth/auth.service.js";

async function main(): Promise<void> {
  console.log("🧹 Purging expired OTP challenges...");

  const { deleted } = await purgeExpiredOtpChallenges();

  console.log(`🧹 Removed ${deleted} expired OTP challenge(s).`);
}

main()
  .catch((error) => {
    console.error("❌ OTP cleanup failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
