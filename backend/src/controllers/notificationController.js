import Notification from '../models/Notification.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.findByUser(req.userId),
    Notification.countUnread(req.userId),
  ]);
  res.json({ success: true, notifications, unreadCount });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.markRead(req.params.id, req.userId);
  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }
  res.json({ success: true, notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.markAllRead(req.userId);
  res.json({ success: true, message: 'All notifications marked read' });
});
