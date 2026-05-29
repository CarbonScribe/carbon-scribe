import { StateCreator } from "zustand";

import { dismissNotificationApi, fetchNotificationsApi, markNotificationReadApi } from "./notification.api";

import { Notification, NotificationsSlice } from "./notification.types";

export const createNotificationsSlice: StateCreator<
  NotificationsSlice,
  [],
  [],
  NotificationsSlice
> = (set, get) => ({
  notifications: [],

  unreadCount: 0,

  isLoading: false,

  error: null,

  fetchNotifications: async () => {
    try {
      set({
        isLoading: true,
        error: null,
      });

      const notifications =
        await fetchNotificationsApi();

      const unreadCount = notifications.filter(
        (notification) =>
          !notification.read &&
          !notification.dismissed
      ).length;

      set({
        notifications,
        unreadCount,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  },

  refreshNotifications: async () => {
    await get().fetchNotifications();
  },

  markAsRead: async (id: string) => {
    const previous =
      get().notifications;

    /**
     * Optimistic update
     */
    set((state) => {
      const updated =
        state.notifications.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                read: true,
              }
            : notification
        );

      return {
        notifications: updated,
        unreadCount: updated.filter(
          (notification) =>
            !notification.read &&
            !notification.dismissed
        ).length,
      };
    });

    try {
      await markNotificationReadApi(id);
    } catch {
      /**
       * Rollback
       */
      set({
        notifications: previous,
        unreadCount: previous.filter(
          (notification) =>
            !notification.read &&
            !notification.dismissed
        ).length,
      });
    }
  },

  dismissNotification: async (
    id: string
  ) => {
    const previous =
      get().notifications;

    /**
     * Optimistic update
     */
    set((state) => {
      const updated =
        state.notifications.map((notification) =>
          notification.id === id
            ? {
                ...notification,
                dismissed: true,
              }
            : notification
        );

      return {
        notifications: updated,
        unreadCount: updated.filter(
          (notification) =>
            !notification.read &&
            !notification.dismissed
        ).length,
      };
    });

    try {
      await dismissNotificationApi(id);
    } catch {
      /**
       * Rollback
       */
      set({
        notifications: previous,
        unreadCount: previous.filter(
          (notification) =>
            !notification.read &&
            !notification.dismissed
        ).length,
      });
    }
  },

  resetNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
    });
  },
});
