const INTERNAL_ORIGIN = 'https://carbon-scribe.internal'

export function getSafeRedirectTarget(target?: string | null): string | null {
  if (
    !target ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.includes('\\') ||
    /[\u0000-\u001f]/.test(target)
  ) {
    return null
  }

  try {
    const url = new URL(target, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function getLoginRedirectUrl(pathname?: string | null): string {
  const target = getSafeRedirectTarget(pathname)
  return target ? `/login?redirect=${encodeURIComponent(target)}` : '/login'
}