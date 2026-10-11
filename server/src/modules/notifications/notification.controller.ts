import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { isSystemAdminId } from "../auth/system-admin.js";
import {
  savePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notification.service.js";
import {
  pushSubscriptionSchema,
  unsubscribeSchema,
  notificationQuerySchema,
} from "./notification.schema.js";

export async function getVapidKeyController(
  _req: Request,
  res: Response,
): Promise<void> {
  const publicKey = getVapidPublicKey();
  res.status(200).json({
    success: true,
    publicKey,
  });
}

export async function subscribePushController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const input = pushSubscriptionSchema.parse(req.body);
  const isSystemAdmin = isSystemAdminId(authReq.userId);

  const result = await savePushSubscription(
    {
      userId: isSystemAdmin ? undefined : authReq.userId,
      isSystemAdmin,
    },
    input,
  );

  res.status(200).json(result);
}

export async function unsubscribePushController(
  req: Request,
  res: Response,
): Promise<void> {
  const input = unsubscribeSchema.parse(req.body);
  const result = await removePushSubscription(input.endpoint);
  res.status(200).json(result);
}

export async function listNotificationsController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const query = notificationQuerySchema.parse(req.query);
  const isSystemAdmin = isSystemAdminId(authReq.userId);

  const result = await getUserNotifications(
    {
      userId: isSystemAdmin ? undefined : authReq.userId,
      isSystemAdmin,
    },
    query,
  );

  res.status(200).json({
    success: true,
    ...result,
  });
}

export async function markReadController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const id = req.params.id as string;
  const isSystemAdmin = isSystemAdminId(authReq.userId);

  const result = await markNotificationAsRead(id, {
    userId: isSystemAdmin ? undefined : authReq.userId,
    isSystemAdmin,
  });

  res.status(200).json(result);
}

export async function markAllReadController(
  req: Request,
  res: Response,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const isSystemAdmin = isSystemAdminId(authReq.userId);

  const result = await markAllNotificationsAsRead({
    userId: isSystemAdmin ? undefined : authReq.userId,
    isSystemAdmin,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
}
