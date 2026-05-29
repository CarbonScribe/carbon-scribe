import { Notification } from "./notification.types";

const BASE_URL = "/api/notifications";

export async function fetchNotificationsApi(): Promise<Notification[]> {
  const response = await fetch(BASE_URL);

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return response.json();
}

export async function markNotificationReadApi(
  id: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/${id}/read`,
    {
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

export async function dismissNotificationApi(
  id: string
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/${id}/dismiss`,
    {
      method: "PATCH",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to dismiss notification");
  }
}