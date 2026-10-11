import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { createAndSendNotification } from '../modules/notifications/notification.service.js';

async function seedFakeNotifications() {
  console.log('Seeding fake notifications...');

  // 1. Fetch some users (e.g. DGM or active user)
  const users = await prisma.user.findMany({
    take: 5,
    include: {
      employee: {
        include: { farm: true },
      },
    },
  });

  const farm = await prisma.farm.findFirst({ select: { id: true, name: true } });
  const farmName = farm?.name || 'Green Valley Farm';
  const farmId = farm?.id || 'farm-123';

  // 2. Real System Error Log records in database
  const reqId1 = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const reqId2 = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const err1 = await prisma.systemErrorLog.create({
    data: {
      requestId: reqId1,
      statusCode: 500,
      errorName: 'PrismaClientKnownRequestError',
      errorMessage: 'Deadlock detected while recording 28 attendance records in bulk transaction.',
      stackTrace: `PrismaClientKnownRequestError: Deadlock detected
    at RequestHandler.request (C:\\server\\node_modules\\@prisma\\client\\runtime\\library.js:127:15)
    at async AttendanceService.bulkRecordAttendance (C:\\server\\src\\modules\\attendance\\attendance.service.ts:312:9)
    at async handleBulkRecordAttendance (C:\\server\\src\\modules\\attendance\\attendance.controller.ts:45:5)`,
      method: 'POST',
      path: '/api/v1/attendance/bulk',
      queryParams: { dryRun: 'false' },
      requestBody: {
        farmId,
        date: '2026-10-11',
        recordsCount: 28,
        mode: 'BULK_ATTENDANCE',
      },
      userName: 'Ramesh Verma',
      userEmail: 'ramesh.verma@poultryops.com',
      userRole: 'FARM_INCHARGE',
      companyName: 'Apex Agro Industries',
      farmName,
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36',
    },
  });

  const err2 = await prisma.systemErrorLog.create({
    data: {
      requestId: reqId2,
      statusCode: 500,
      errorName: 'TimeoutError',
      errorMessage: 'Connection to Redis session cache timed out after 5000ms.',
      stackTrace: `TimeoutError: Connection to Redis session cache timed out after 5000ms
    at Timeout._onTimeout (C:\\server\\src\\config\\redis.ts:89:12)
    at listOnTimeout (node:internal/timers:581:17)
    at process.processTimers (node:internal/timers:519:7)`,
      method: 'GET',
      path: '/api/v1/analytics/live',
      queryParams: { period: 'realtime', metric: 'shed_temperature' },
      requestBody: Prisma.JsonNull,
      userName: 'Suresh Rao',
      userEmail: 'suresh.rao@poultryops.com',
      userRole: 'ASSISTANT_MANAGER',
      companyName: 'Apex Agro Industries',
      farmName,
      ipAddress: '192.168.1.218',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    },
  });

  // 2. Fake System Admin 500 error alerts with real inspector deep links
  await createAndSendNotification({
    isSystemAdmin: true,
    category: 'SERVER_500_ERROR',
    priority: 'CRITICAL',
    title: '🚨 Server 500: [POST] /api/v1/attendance/bulk',
    body: 'Reason: PrismaClientKnownRequestError - Deadlock detected while recording 28 attendance records. (Req: #req-a8f9c2)',
    linkUrl: `/audit-logs?tab=system-errors&errorId=${err1.id}`,
    tag: `fake-500-1`,
    metadata: {
      path: '/api/v1/attendance/bulk',
      method: 'POST',
      errorName: 'PrismaClientKnownRequestError',
      errorMessage: 'Deadlock detected while recording 28 attendance records.',
      requestId: 'req-a8f9c2',
      systemErrorId: err1.id,
    },
  });

  await createAndSendNotification({
    isSystemAdmin: true,
    category: 'SERVER_500_ERROR',
    priority: 'CRITICAL',
    title: '🚨 Server 500: [GET] /api/v1/analytics/live',
    body: 'Reason: TimeoutError - Connection to Redis session cache timed out after 5000ms. (Req: #req-77b10x)',
    linkUrl: `/audit-logs?tab=system-errors&errorId=${err2.id}`,
    tag: `fake-500-2`,
    metadata: {
      path: '/api/v1/analytics/live',
      method: 'GET',
      errorName: 'TimeoutError',
      errorMessage: 'Connection to Redis session cache timed out after 5000ms.',
      requestId: 'req-77b10x',
      systemErrorId: err2.id,
    },
  });

  // 3. Fake IP Fallback Audit alerts (For System Admin and for existing users)
  // System Admin copy
  await createAndSendNotification({
    isSystemAdmin: true,
    category: 'IP_FALLBACK_AUDIT',
    priority: 'HIGH',
    title: '⚠️ IP Fallback Attendance Audit',
    body: `10 attendance records require confirmation at ${farmName} (3 new, 7 pending backlog).`,
    linkUrl: `/attendance/approvals?filter=IP_FALLBACK&farmId=${farmId}`,
    tag: `fake-ip-admin`,
    metadata: {
      farmId,
      farmName,
      newCount: 3,
      backlogCount: 7,
      totalPending: 10,
    },
  });

  // Also send to all found users (Incharge, DGM, etc.)
  for (const user of users) {
    await createAndSendNotification({
      userId: user.id,
      category: 'IP_FALLBACK_AUDIT',
      priority: 'HIGH',
      title: '⚠️ IP Fallback Attendance Audit',
      body: `10 attendance records require confirmation at ${user.employee.farm.name} (3 new, 7 pending backlog).`,
      linkUrl: `/attendance/approvals?filter=IP_FALLBACK&farmId=${user.employee.farmId}`,
      tag: `fake-ip-${user.id}`,
      metadata: {
        farmId: user.employee.farmId,
        farmName: user.employee.farm.name,
        newCount: 3,
        backlogCount: 7,
        totalPending: 10,
      },
    });

    await createAndSendNotification({
      userId: user.id,
      category: 'ATTENDANCE_APPROVAL',
      priority: 'MEDIUM',
      title: '✍️ Manager Attendance Signoff',
      body: `Morning Shift attendance finalized by Incharge with 42 present and 2 absences. Approval pending.`,
      linkUrl: `/attendance/approvals?shift=MORNING_SHIFT`,
      tag: `fake-att-${user.id}`,
      metadata: {
        shift: 'MORNING_SHIFT',
        presentCount: 42,
        absentCount: 2,
      },
    });
  }

  console.log('✅ Fake notifications successfully seeded to database and dispatched to push subscriptions!');
  await prisma.$disconnect();
}

seedFakeNotifications().catch((err) => {
  console.error('Failed to seed fake notifications:', err);
  process.exit(1);
});
