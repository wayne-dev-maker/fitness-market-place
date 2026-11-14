import { describe, expect, it } from 'vitest'
import { landingPath } from './session'

describe('landingPath', () => {
  it('returns people to the page they were heading for', () => {
    expect(landingPath('TRAINEE', '/plans/pln_1')).toBe('/plans/pln_1')
    expect(landingPath('TRAINEE', '/workouts/w1')).toBe('/workouts/w1')
    expect(landingPath('TRAINEE', '/checkout/return?purchase=pur_1')).toBe('/checkout/return?purchase=pur_1')
    expect(landingPath('TRAINER', '/trainer/plans/pln_1')).toBe('/trainer/plans/pln_1')
  })

  it('falls back to the role home page when there is nowhere to return to', () => {
    expect(landingPath('TRAINEE', undefined)).toBe('/dashboard')
    expect(landingPath('TRAINER', undefined)).toBe('/trainer')
    expect(landingPath('ADMIN', undefined)).toBe('/')
  })

  it('does not send an account to another role’s area', () => {
    expect(landingPath('TRAINER', '/dashboard')).toBe('/trainer')
    expect(landingPath('TRAINER', '/workouts/w1')).toBe('/trainer')
    expect(landingPath('TRAINEE', '/trainer')).toBe('/dashboard')
    expect(landingPath('TRAINEE', '/trainer/plans/pln_1')).toBe('/dashboard')
  })

  it('ignores anything that is not a same-site path', () => {
    expect(landingPath('TRAINEE', 'https://evil.example/phish')).toBe('/dashboard')
    expect(landingPath('TRAINEE', '//evil.example')).toBe('/dashboard')
  })
})
