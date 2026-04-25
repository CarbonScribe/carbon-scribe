# Team Collaboration API Integration

This module integrates the backend Team Collaboration endpoints
(`/api/v1/team/*`) into the frontend.

## Configuration

Set the following environment variable so the client can reach the backend:

```
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com/api/v1
```

If unset, the client defaults to the relative path `/api/v1`, which works when
the backend is proxied by Next.js.

## Usage

### Direct client

```ts
import { teamCollaborationClient } from '@/lib/team-collaboration';

const recent = await teamCollaborationClient.getRecentActivities(10);
const score = await teamCollaborationClient.getCollaborationScore();
```

To use an authenticated token, create a client explicitly:

```ts
import { TeamCollaborationClient } from '@/lib/team-collaboration';

const client = new TeamCollaborationClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAuthToken: () => localStorage.getItem('access_token'),
});
```

### React hooks

```tsx
import {
  useActivityFeed,
  useTeamMessages,
  useUnreadNotifications,
} from '@/hooks/useTeamCollaboration';

function TeamFeed() {
  const { data, status, error, refresh } = useActivityFeed({
    limit: 20,
    pollIntervalMs: 15000, // poll every 15s for near-real-time updates
  });

  if (status === 'loading' && data.length === 0) return <p>Loading…</p>;
  if (status === 'error') return <p>Failed to load: {error?.message}</p>;

  return (
    <ul>
      {data.map((a) => (
        <li key={a.id}>{a.description}</li>
      ))}
    </ul>
  );
}
```

### Posting messages

```tsx
const { messages, send } = useTeamMessages({
  teamId,
  pollIntervalMs: 5000,
});

await send('Shipped the new dashboard!');
```

## Endpoints

| Frontend method                          | Backend path                              |
| ---------------------------------------- | ----------------------------------------- |
| `getActivityFeed(query)`                 | `GET /team/activity`                      |
| `getRecentActivities(limit)`             | `GET /team/activity/recent`               |
| `getUserActivity(userId, limit)`         | `GET /team/activity/user/:userId`         |
| `getActivitySummary(range)`              | `GET /team/activity/summary`              |
| `getTeamPerformance(range)`              | `GET /team/performance`                   |
| `getMemberPerformance(range)`            | `GET /team/performance/members`           |
| `getPerformanceTrends(range)`            | `GET /team/performance/trends`            |
| `getPerformanceBenchmarks(range)`        | `GET /team/performance/benchmarks`        |
| `getCollaborationScore(range)`           | `GET /team/collaboration/score`           |
| `getCollaborationScoreHistory(type)`     | `GET /team/collaboration/score/history`   |
| `getCollaborationRecommendations(range)` | `GET /team/collaboration/recommendations` |
| `getTopContributors(limit)`              | `GET /team/collaboration/top-contributors`|
| `getUnreadNotifications()`               | `GET /team/notifications/unread`          |
| `markNotificationRead(id)`               | `POST /team/notifications/:id/read`       |
| `getTeamMessages(teamId, limit)`         | `GET /team/activity?type=MESSAGE_POSTED`  |
| `postTeamMessage(teamId, content)`       | `POST /team/activity`                     |

## Error handling

All API errors are thrown as `TeamCollaborationApiError` with `status` and
`body` fields for contextual error UIs. Network errors surface as the native
`TypeError` from `fetch`. React hooks expose the error via their `error`
state so components can show user-friendly feedback.

## Real-time updates

Hooks support a `pollIntervalMs` option for lightweight polling. When a
WebSocket channel becomes available on the backend, the polling hooks can be
swapped for a subscription-based implementation without changes to calling
components.
