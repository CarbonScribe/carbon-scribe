'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/store';

const NOTIFICATION_REFRESH_INTERVAL = 30000;

export default function NotificationProvider() {
  const fetchNotifications = useStore((s) => s.fetchNotifications);
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, NOTIFICATION_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchNotifications, isAuthenticated]);

  return null;
}