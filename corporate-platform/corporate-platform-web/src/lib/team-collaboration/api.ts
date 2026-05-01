import {
  ActivityFeedQuery,
  ActivitySummary,
  CollaborationScore,
  DateRange,
  TeamActivity,
  TeamCollaborationApiError,
  TeamMessage,
  TeamNotification,
  TeamPerformance,
} from './types';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' &&
    process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  '/api/v1';

export interface TeamCollaborationClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | undefined | Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}

function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export class TeamCollaborationClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: TeamCollaborationClientOptions['getAuthToken'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: TeamCollaborationClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.getAuthToken = options.getAuthToken;
    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : (undefined as never));
    if (!this.fetchImpl) {
      throw new Error(
        'TeamCollaborationClient requires a fetch implementation in this environment',
      );
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (init.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.fetchImpl(url, { ...init, headers });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      throw new TeamCollaborationApiError(
        `Team collaboration request failed: ${response.status} ${response.statusText}`,
        response.status,
        body,
      );
    }
    return body as T;
  }

  // ==================== Activity Feed ====================

  getActivityFeed(query: ActivityFeedQuery = {}): Promise<TeamActivity[]> {
    return this.request<TeamActivity[]>(
      `/team/activity${buildQuery(query as Record<string, unknown>)}`,
    );
  }

  getRecentActivities(limit = 10): Promise<TeamActivity[]> {
    return this.request<TeamActivity[]>(
      `/team/activity/recent${buildQuery({ limit })}`,
    );
  }

  getUserActivity(userId: string, limit = 50): Promise<TeamActivity[]> {
    if (!userId) {
      return Promise.reject(new Error('userId is required'));
    }
    return this.request<TeamActivity[]>(
      `/team/activity/user/${encodeURIComponent(userId)}${buildQuery({ limit })}`,
    );
  }

  getActivitySummary(range: DateRange = {}): Promise<ActivitySummary> {
    return this.request<ActivitySummary>(
      `/team/activity/summary${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  // ==================== Performance ====================

  getTeamPerformance(range: DateRange = {}): Promise<TeamPerformance> {
    return this.request<TeamPerformance>(
      `/team/performance${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  getMemberPerformance(range: DateRange = {}): Promise<TeamPerformance> {
    return this.request<TeamPerformance>(
      `/team/performance/members${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  getPerformanceTrends(range: DateRange = {}): Promise<TeamPerformance> {
    return this.request<TeamPerformance>(
      `/team/performance/trends${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  getPerformanceBenchmarks(range: DateRange = {}): Promise<TeamPerformance> {
    return this.request<TeamPerformance>(
      `/team/performance/benchmarks${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  // ==================== Collaboration Score ====================

  getCollaborationScore(range: DateRange = {}): Promise<CollaborationScore> {
    return this.request<CollaborationScore>(
      `/team/collaboration/score${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  getCollaborationScoreHistory(
    metricType: 'WEEKLY_SCORE' | 'MONTHLY_SCORE' = 'WEEKLY_SCORE',
  ): Promise<CollaborationScore> {
    return this.request<CollaborationScore>(
      `/team/collaboration/score/history${buildQuery({ metricType })}`,
    );
  }

  getCollaborationRecommendations(range: DateRange = {}): Promise<{
    companyId: string;
    recommendations: string[];
  }> {
    return this.request(
      `/team/collaboration/recommendations${buildQuery(range as Record<string, unknown>)}`,
    );
  }

  getTopContributors(limit = 10): Promise<TeamActivity[]> {
    return this.request<TeamActivity[]>(
      `/team/collaboration/top-contributors${buildQuery({ limit })}`,
    );
  }

  // ==================== Notifications ====================

  getUnreadNotifications(): Promise<TeamNotification[]> {
    return this.request<TeamNotification[]>(`/team/notifications/unread`);
  }

  markNotificationRead(id: string): Promise<TeamNotification> {
    if (!id) {
      return Promise.reject(new Error('notification id is required'));
    }
    return this.request<TeamNotification>(
      `/team/notifications/${encodeURIComponent(id)}/read`,
      { method: 'POST' },
    );
  }

  // ==================== Messages ====================
  // Convenience helpers used by UI components. Messages are modelled as
  // `MESSAGE_POSTED` activities on the backend activity feed.

  getTeamMessages(teamId: string, limit = 50): Promise<TeamMessage[]> {
    if (!teamId) {
      return Promise.reject(new Error('teamId is required'));
    }
    return this.request<TeamMessage[]>(
      `/team/activity${buildQuery({
        type: 'MESSAGE_POSTED',
        teamId,
        limit,
      })}`,
    );
  }

  postTeamMessage(teamId: string, content: string): Promise<TeamMessage> {
    if (!teamId) {
      return Promise.reject(new Error('teamId is required'));
    }
    if (!content || !content.trim()) {
      return Promise.reject(new Error('content is required'));
    }
    return this.request<TeamMessage>(
      `/team/activity`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'MESSAGE_POSTED',
          teamId,
          description: content,
        }),
      },
    );
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const teamCollaborationClient = new TeamCollaborationClient();
