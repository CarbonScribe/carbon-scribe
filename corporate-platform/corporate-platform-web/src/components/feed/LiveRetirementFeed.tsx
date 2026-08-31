'use client';

/**
 * Live retirement event feed (#552)
 *
 * Connects to the backend retirement stream via WebSocket (SSE fallback URL
 * documented below). Features:
 * - Exponential-backoff reconnect with capped interval
 * - connected | reconnecting | disconnected | error UI states
 * - Pause unsubscribes (closes socket) rather than a cosmetic interval
 * - Event deduplication by retirement/transaction id
 * - Pauses while document.visibilityState === 'hidden'
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type FeedConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface RetirementFeedEvent {
  id: string;
  companyName: string;
  projectName: string;
  amount: number;
  unit?: string;
  timestamp: string;
  transactionHash?: string;
}

const MAX_ITEMS = 50;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

function resolveStreamUrl(): string {
  if (typeof window === 'undefined') return '';
  const envUrl = process.env.NEXT_PUBLIC_RETIREMENT_STREAM_URL;
  if (envUrl) return envUrl;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/v1/retirements/stream`;
}

export function LiveRetirementFeed() {
  const [events, setEvents] = useState<RetirementFeedEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<FeedConnectionState>('connecting');
  const [paused, setPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const backoffRef = useRef(BASE_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const visibleRef = useRef(true);

  const pushEvent = useCallback((evt: RetirementFeedEvent) => {
    if (!evt?.id) return;
    if (seenIdsRef.current.has(evt.id)) return; // dedupe
    seenIdsRef.current.add(evt.id);
    setEvents((prev) => [evt, ...prev].slice(0, MAX_ITEMS));
  }, []);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (paused || !visibleRef.current) return;

    disconnect();
    intentionalCloseRef.current = false;
    setConnectionState((s) =>
      s === 'connected' ? 'connected' : s === 'connecting' ? 'connecting' : 'reconnecting',
    );
    setErrorMessage(null);

    const url = resolveStreamUrl();
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setConnectionState('error');
      setErrorMessage((err as Error).message || 'Failed to open WebSocket');
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = BASE_BACKOFF_MS;
      setConnectionState('connected');
      setErrorMessage(null);
    };

    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data as string);
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          if (!item) continue;
          pushEvent({
            id: String(item.id || item.transactionHash || item.txHash || ''),
            companyName: String(item.companyName || item.company || 'Unknown'),
            projectName: String(item.projectName || item.project || '—'),
            amount: Number(item.amount ?? 0),
            unit: item.unit || 'tCO2e',
            timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
            transactionHash: item.transactionHash || item.txHash,
          });
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      setConnectionState('error');
      setErrorMessage('Stream connection error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (intentionalCloseRef.current || paused || !visibleRef.current) {
        setConnectionState(paused ? 'disconnected' : 'disconnected');
        return;
      }
      setConnectionState('reconnecting');
      scheduleReconnect();
    };

    function scheduleReconnect() {
      clearReconnectTimer();
      const delay = backoffRef.current;
      backoffRef.current = Math.min(MAX_BACKOFF_MS, backoffRef.current * 2);
      reconnectTimerRef.current = setTimeout(() => {
        if (!paused && visibleRef.current) {
          setConnectionState('reconnecting');
          connect();
        }
      }, delay);
    }
  }, [disconnect, paused, pushEvent]);

  // Initial connect + pause handling
  useEffect(() => {
    if (paused) {
      disconnect();
      setConnectionState('disconnected');
      return;
    }
    connect();
    return () => disconnect();
  }, [paused, connect, disconnect]);

  // Tab visibility: pause subscription when hidden
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (!visibleRef.current) {
        disconnect();
        setConnectionState('disconnected');
      } else if (!paused) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [connect, disconnect, paused]);

  const badge = (() => {
    switch (connectionState) {
      case 'connected':
        return { label: 'LIVE', className: 'bg-green-500 animate-pulse' };
      case 'reconnecting':
      case 'connecting':
        return { label: 'RECONNECTING', className: 'bg-amber-500' };
      case 'error':
        return { label: 'ERROR', className: 'bg-red-600' };
      default:
        return { label: paused ? 'PAUSED' : 'OFFLINE', className: 'bg-gray-500' };
    }
  })();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-semibold text-white ${badge.className}`}
          >
            {badge.label}
          </span>
          <h3 className="text-sm font-medium text-gray-900">Live retirements</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1 text-xs"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          {connectionState === 'error' && (
            <button
              type="button"
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
              onClick={() => {
                backoffRef.current = BASE_BACKOFF_MS;
                setPaused(false);
                connect();
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="mb-2 text-xs text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      {connectionState === 'connecting' && events.length === 0 && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-8 animate-pulse rounded bg-gray-100" />
          <div className="h-8 animate-pulse rounded bg-gray-100" />
          <div className="h-8 animate-pulse rounded bg-gray-100" />
        </div>
      )}

      <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-2 border-b border-gray-50 pb-2"
          >
            <div>
              <div className="font-medium text-gray-900">{e.companyName}</div>
              <div className="text-xs text-gray-500">{e.projectName}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {e.amount} {e.unit || 'tCO2e'}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(e.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </li>
        ))}
        {events.length === 0 && connectionState === 'connected' && (
          <li className="text-xs text-gray-500">Waiting for retirement events…</li>
        )}
      </ul>
    </div>
  );
}

export default LiveRetirementFeed;
