import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNotificationsSlice } from "@/store/notificationsSlice";
import * as api from "@/store/notification.api";

vi.mock("@/store/notification.api", () => ({
  fetchNotificationsApi: vi.fn(),
  markNotificationReadApi: vi.fn(),
  dismissNotificationApi: vi.fn(),
}));

const mockApi = vi.mocked(api);

describe('NotificationsSlice', () => {
  let slice: ReturnType<typeof createNotificationsSlice>;
  let mockSet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSet = vi.fn((update) => {
      if (typeof update === 'function') {
        const newState = update(slice);
        Object.assign(slice, newState);
      } else {
        Object.assign(slice, update);
      }
    });
    const mockGet = vi.fn(() => slice);
    const mockStoreApi = { setState: vi.fn(), getState: vi.fn(), getInitialState: vi.fn() } as any;
    slice = createNotificationsSlice(mockSet as any, mockGet as any, mockStoreApi);
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(slice.notifications).toEqual([]);
      expect(slice.unreadCount).toBe(0);
      expect(slice.isLoading).toBe(false);
      expect(slice.error).toBe(null);
    });
  });

  describe('fetchNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockNotifications = [
        { id: '1', title: 'Test', message: 'Test Message', type: 'info' as const, createdAt: new Date().toISOString(), read: false, dismissed: false },
        { id: '2', title: 'Test 2', message: 'Test Message 2', type: 'success' as const, createdAt: new Date().toISOString(), read: true, dismissed: false },
        { id: '3', title: 'Test 3', message: 'Test Message 3', type: 'warning' as const, createdAt: new Date().toISOString(), read: false, dismissed: true },
      ];
      mockApi.fetchNotificationsApi.mockResolvedValue(mockNotifications);

      await slice.fetchNotifications();

      expect(mockApi.fetchNotificationsApi).toHaveBeenCalled();
      expect(slice.notifications).toEqual(mockNotifications);
      expect(slice.unreadCount).toBe(1);
      expect(slice.isLoading).toBe(false);
    });

    it('should handle fetch notifications error', async () => {
      const error = new Error('Failed to fetch notifications');
      mockApi.fetchNotificationsApi.mockRejectedValue(error);

      await slice.fetchNotifications();

      expect(mockApi.fetchNotificationsApi).toHaveBeenCalled();
      expect(slice.error).toBe(error.message);
      expect(slice.isLoading).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      slice.notifications = [
        { id: '1', title: 'Test', message: 'Test Message', type: 'info' as const, createdAt: new Date().toISOString(), read: false, dismissed: false },
      ];
      slice.unreadCount = 1;
      mockApi.markNotificationReadApi.mockResolvedValue(undefined);

      await slice.markAsRead("1");

      expect(mockApi.markNotificationReadApi).toHaveBeenCalledWith("1");
      expect(slice.notifications[0].read).toBe(true);
      expect(slice.unreadCount).toBe(0);
    });

    it('should rollback on markAsRead error', async () => {
      slice.notifications = [
        { id: '1', title: 'Test', message: 'Test Message', type: 'info' as const, createdAt: new Date().toISOString(), read: false, dismissed: false },
      ];
      slice.unreadCount = 1;
      mockApi.markNotificationReadApi.mockRejectedValue(new Error('Network error'));

      await slice.markAsRead("1");

      expect(slice.notifications[0].read).toBe(false);
      expect(slice.unreadCount).toBe(1);
    });
  });

  describe('dismissNotification', () => {
    it('should dismiss notification successfully', async () => {
      slice.notifications = [
        { id: '1', title: 'Test', message: 'Test Message', type: 'info' as const, createdAt: new Date().toISOString(), read: false, dismissed: false },
      ];
      slice.unreadCount = 1;
      mockApi.dismissNotificationApi.mockResolvedValue(undefined);

      await slice.dismissNotification("1");

      expect(mockApi.dismissNotificationApi).toHaveBeenCalledWith("1");
      expect(slice.notifications[0].dismissed).toBe(true);
      expect(slice.unreadCount).toBe(0);
    });

    it('should rollback on dismissNotification error', async () => {
      slice.notifications = [
        { id: '1', title: 'Test', message: 'Test Message', type: 'info' as const, createdAt: new Date().toISOString(), read: false, dismissed: false },
      ];
      slice.unreadCount = 1;
      mockApi.dismissNotificationApi.mockRejectedValue(new Error('Network error'));

      await slice.dismissNotification("1");

      expect(slice.notifications[0].dismissed).toBe(false);
      expect(slice.unreadCount).toBe(1);
    });
  });

  describe('resetNotifications', () => {
    it('should reset state to initial values', () => {
      slice.notifications = [{ id: '1', title: 'Test', message: 'Test', type: 'info' as const, createdAt: '', read: false, dismissed: false }];
      slice.unreadCount = 5;
      slice.isLoading = true;
      slice.error = 'Some error';

      slice.resetNotifications();

      expect(slice.notifications).toEqual([]);
      expect(slice.unreadCount).toBe(0);
      expect(slice.isLoading).toBe(false);
      expect(slice.error).toBe(null);
    });
  });
});