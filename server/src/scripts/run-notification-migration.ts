import 'dotenv/config';
import fs from 'fs';
import { prisma } from '../config/database.js';

async function run() {
  const sql = fs.readFileSync('prisma/migrations/20261011000000_add_notifications_and_push/migration.sql', 'utf8');
  await prisma.$executeRawUnsafe(sql);
  console.log('✅ Notification & Push tables created successfully via Prisma client');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
