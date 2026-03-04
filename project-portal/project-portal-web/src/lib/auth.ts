/**
 * Current user id for collaboration (comment author, task creator, etc.).
 * Reads from localStorage auth_user when available.
 */
export function getCurrentUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return '';
    const user = JSON.parse(raw) as { id?: string; user_id?: string };
    return user?.id ?? user?.user_id ?? '';
  } catch {
    return '';
  }
}

export function getCurrentUserDisplayName(): string {
  if (typeof window === 'undefined') return 'You';
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return 'You';
    const user = JSON.parse(raw) as { name?: string; email?: string };
    return user?.name ?? user?.email ?? 'You';
  } catch {
    return 'You';
  }
}
