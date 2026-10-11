import 'dotenv/config';
import { createAndSendNotification } from '../modules/notifications/notification.service.js';

async function main() {
  console.log('Sending instant push notification to all active devices...');
  await createAndSendNotification({
    isSystemAdmin: true,
    category: 'SERVER_500_ERROR',
    priority: 'CRITICAL',
    title: '🚨 CRITICAL SYSTEM ALERT',
    body: 'Real-time Web Push notification test dispatched to your device! Everything is working.',
    linkUrl: '/notifications',
    tag: `instant-alert-${Date.now()}`,
    metadata: {
      timestamp: new Date().toISOString(),
      test: true,
    },
  });
  console.log('✅ Push notification dispatched successfully to all subscribed endpoints!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to send push alert:', err);
  process.exit(1);
});
