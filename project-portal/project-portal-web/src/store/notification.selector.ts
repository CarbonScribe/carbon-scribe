import { useStore } from "../lib/store/store";

export const useUnreadNotifications = () =>
  useStore((state) =>
    state.notifications.filter(
      (notification) =>
        !notification.read &&
        !notification.dismissed
    )
  );