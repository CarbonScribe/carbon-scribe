import type { Comment } from '@/lib/store/collaboration/collaboration.types';

type CommentEvent = {
  event?: string;
  type?: string;
  projectId?: string;
  project_id?: string;
  data?: Comment | { comment?: Comment };
  comment?: Comment;
};

export type CollaborationSocketOptions = {
  createWebSocket?: (url: string) => WebSocket;
  onComment: (comment: Comment) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
};

const MAX_RECONNECT_DELAY = 30_000;
let activeSubscription: CollaborationSocketSubscription | null = null;

function getWebSocketUrl(projectId: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_COLLABORATION_WS_URL?.trim();
  if (configuredUrl) {
    return `${configuredUrl.replace(/\/$/, '')}/${encodeURIComponent(projectId)}`;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
  const url = new URL(apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/collaboration/projects/${encodeURIComponent(projectId)}/comments`;
  return url.toString();
}

function extractComment(message: CommentEvent, projectId: string): Comment | null {
  const payload = message.comment ?? (message.data && 'comment' in message.data ? message.data.comment : message.data);
  const eventName = message.event ?? message.type;
  const comment = payload && 'id' in payload ? payload : null;
  const eventProjectId = message.projectId ?? message.project_id ?? comment?.project_id;
  return eventName === 'comment.created' && eventProjectId === projectId && comment
    ? comment
    : null;
}

export class CollaborationSocketSubscription {
  readonly projectId: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private closed = false;

  constructor(projectId: string, private readonly options: CollaborationSocketOptions) {
    this.projectId = projectId;
  }

  subscribe() {
    this.closed = false;
    this.connect();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  unsubscribe() {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.socket?.close();
    this.socket = null;
  }

  private connect = () => {
    if (this.closed || typeof WebSocket === 'undefined') return;
    this.options.onStatusChange?.('connecting');
    const createWebSocket = this.options.createWebSocket ?? ((url: string) => new WebSocket(url));
    this.socket = createWebSocket(getWebSocketUrl(this.projectId));
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.options.onStatusChange?.('connected');
      this.socket?.send(JSON.stringify({ type: 'subscribe', projectId: this.projectId }));
    };
    this.socket.onmessage = (event) => {
      try {
        const comment = extractComment(JSON.parse(event.data) as CommentEvent, this.projectId);
        if (comment) this.options.onComment(comment);
      } catch {
        // Ignore malformed messages from the socket.
      }
    };
    this.socket.onclose = () => {
      this.options.onStatusChange?.('disconnected');
      this.scheduleReconnect();
    };
    this.socket.onerror = () => this.socket?.close();
  };

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, MAX_RECONNECT_DELAY);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || this.closed) return;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.socket?.close();
      this.connect();
    }
  };
}

export function subscribeToComments(projectId: string, options: CollaborationSocketOptions): () => void {
  activeSubscription?.unsubscribe();
  activeSubscription = new CollaborationSocketSubscription(projectId, options);
  activeSubscription.subscribe();
  return () => {
    activeSubscription?.unsubscribe();
    activeSubscription = null;
  };
}

export function unsubscribeFromComments(projectId: string) {
  if (activeSubscription?.projectId === projectId) {
    activeSubscription.unsubscribe();
    activeSubscription = null;
  }
}