'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TeamActivity,
  TeamCollaborationApiError,
  TeamMessage,
  TeamNotification,
  teamCollaborationClient,
} from '@/lib/team-collaboration';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface UseActivityFeedOptions {
  limit?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { limit = 20, pollIntervalMs = 0, enabled = true } = options;
  const [data, setData] = useState<TeamActivity[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<TeamCollaborationApiError | Error | null>(
    null,
  );
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const items = await teamCollaborationClient.getRecentActivities(limit);
      if (!mounted.current) return;
      setData(items);
      setStatus('success');
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setStatus('error');
      setError(err as Error);
    }
  }, [limit]);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return () => {
      mounted.current = false;
    };

    refresh();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pollIntervalMs > 0) {
      interval = setInterval(refresh, pollIntervalMs);
    }
    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
  }, [enabled, pollIntervalMs, refresh]);

  return { data, status, error, refresh };
}

interface UseTeamMessagesOptions {
  teamId: string;
  limit?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useTeamMessages(options: UseTeamMessagesOptions) {
  const { teamId, limit = 50, pollIntervalMs = 0, enabled = true } = options;
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!teamId) return;
    setStatus('loading');
    try {
      const items = await teamCollaborationClient.getTeamMessages(
        teamId,
        limit,
      );
      if (!mounted.current) return;
      setMessages(items);
      setStatus('success');
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setStatus('error');
      setError(err as Error);
    }
  }, [teamId, limit]);

  const send = useCallback(
    async (content: string) => {
      const message = await teamCollaborationClient.postTeamMessage(
        teamId,
        content,
      );
      if (mounted.current) {
        setMessages((prev) => [message, ...prev]);
      }
      return message;
    },
    [teamId],
  );

  useEffect(() => {
    mounted.current = true;
    if (!enabled || !teamId) {
      return () => {
        mounted.current = false;
      };
    }
    refresh();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pollIntervalMs > 0) {
      interval = setInterval(refresh, pollIntervalMs);
    }
    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
  }, [enabled, teamId, pollIntervalMs, refresh]);

  return { messages, status, error, refresh, send };
}

export function useUnreadNotifications(pollIntervalMs = 0) {
  const [notifications, setNotifications] = useState<TeamNotification[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const items = await teamCollaborationClient.getUnreadNotifications();
      if (!mounted.current) return;
      setNotifications(items);
      setStatus('success');
    } catch {
      if (!mounted.current) return;
      setStatus('error');
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    await teamCollaborationClient.markNotificationRead(id);
    if (!mounted.current) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pollIntervalMs > 0) {
      interval = setInterval(refresh, pollIntervalMs);
    }
    return () => {
      mounted.current = false;
      if (interval) clearInterval(interval);
    };
  }, [pollIntervalMs, refresh]);

  return { notifications, status, refresh, markRead };
}
