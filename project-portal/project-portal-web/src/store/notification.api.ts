import { Notification } from "./notification.types";
import { showErrorToast } from "@/lib/utils/toast";

const BASE_URL = "/api/notifications";

export async function fetchNotificationsApi(): Promise<Notification[]> {
  const response = await fetch(BASE_URL);

  if (!response.ok) {
    const err = new Error("Failed to fetch notifications");
    (err as any).status = response.status;
    if (response.status >= 500 && response.status <= 599) {
      showErrorToast("CarbonScribe is having trouble", {
        description: "A server error occurred. Please try again in a moment.",
        retryable: true,
        id: "global-5xx",
      });
    }
    throw err;
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
    const err = new Error("Failed to mark notification as read");
    (err as any).status = response.status;
    if (response.status >= 500 && response.status <= 599) {
      showErrorToast("CarbonScribe is having trouble", {
        description: "A server error occurred. Please try again in a moment.",
        retryable: true,
        id: "global-5xx",
      });
    }
    throw err;
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
    const err = new Error("Failed to dismiss notification");
    (err as any).status = response.status;
    if (response.status >= 500 && response.status <= 599) {
      showErrorToast("CarbonScribe is having trouble", {
        description: "A server error occurred. Please try again in a moment.",
        retryable: true,
        id: "global-5xx",
      });
    }
    throw err;
  }
}
