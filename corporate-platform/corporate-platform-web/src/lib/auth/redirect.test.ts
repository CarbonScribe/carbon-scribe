import { describe, expect, it } from 'vitest'
import { getLoginRedirectUrl, getSafeRedirectTarget } from './redirect'

describe('auth redirect utilities', () => {
  it('allows internal paths and preserves query/hash parts', () => {
    expect(getSafeRedirectTarget('/portfolio?tab=credits#active')).toBe(
      '/portfolio?tab=credits#active',
    )
  })

  it.each([
    'https://attacker.example',
    '//attacker.example/path',
    '/\\attacker.example/path',
    '\n/attacker.example',
  ])('rejects unsafe redirect target %s', (target) => {
    expect(getSafeRedirectTarget(target)).toBeNull()
  })

  it('adds safe paths to login URLs and omits invalid targets', () => {
    expect(getLoginRedirectUrl('/reports')).toBe('/login?redirect=%2Freports')
    expect(getLoginRedirectUrl('//attacker.example')).toBe('/login')
  })
})