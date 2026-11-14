import { useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { getMeOrNull, qk } from '../../services/api'
import type { Role } from '../../services/types'

export interface SessionState {
  /** True when a signed-in session ended underneath the user (a 401 mid-use). */
  expired: boolean
  clearExpired: () => void
}

export const SessionContext = createContext<SessionState>({ expired: false, clearExpired: () => {} })

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/**
 * The signed-in user, or null. Identity always comes from GET /users/me, backed by
 * the HttpOnly session cookie; nothing about the session is kept in web storage.
 */
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: getMeOrNull, staleTime: 5 * 60_000 })
}

export function homeFor(role: Role): string {
  return role === 'TRAINER' ? '/trainer' : role === 'TRAINEE' ? '/dashboard' : '/'
}

const ROLE_AREAS: { prefix: string; role: Role }[] = [
  { prefix: '/trainer', role: 'TRAINER' },
  { prefix: '/dashboard', role: 'TRAINEE' },
  { prefix: '/progress', role: 'TRAINEE' },
  { prefix: '/programmes', role: 'TRAINEE' },
  { prefix: '/workouts', role: 'TRAINEE' },
]

/**
 * Where to send someone after they sign in: back to the page they were heading for,
 * unless that page belongs to a different kind of account (for example a trainer
 * signing in from a link to the trainee dashboard). Only same-site paths are accepted.
 */
export function landingPath(role: Role, from: string | undefined): string {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return homeFor(role)
  const area = ROLE_AREAS.find((a) => from === a.prefix || from.startsWith(`${a.prefix}/`) || from.startsWith(`${a.prefix}?`))
  return area && area.role !== role ? homeFor(role) : from
}
