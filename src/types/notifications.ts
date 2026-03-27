export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  createdAt: string;
  title: string;
  description: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationRow {
  id: string;
  created_at: string;
  title: string;
  description: string;
  type: NotificationType;
  is_read: boolean;
  link: string | null;
  payload: Record<string, unknown> | null;
}
