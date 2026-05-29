export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error";

export interface Notification {
    
  id: string;

  title: string;

  message: string;

  type: NotificationType;

  createdAt: string;

  read: boolean;

  dismissed: boolean;

  metadata?: Record<string, unknown>;
}


export interface NotificationsSlice {
  notifications: Notification[];

  unreadCount: number;

  isLoading: boolean;

  error: string | null;

  fetchNotifications: () => Promise<void>;

  refreshNotifications: () => Promise<void>;

  markAsRead: (id: string) => Promise<void>;

  dismissNotification: (id: string) => Promise<void>;

  resetNotifications: () => void;
}