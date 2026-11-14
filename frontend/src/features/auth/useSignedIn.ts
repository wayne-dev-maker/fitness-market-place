import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'
import { qk } from '../../services/api'
import type { User } from '../../services/types'
import { landingPath, useSession } from './session'

/** Completes a login or registration: caches the user and returns them to where they were heading. */
export function useSignedIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useSession()
  const from = (location.state as { from?: string } | null)?.from

  return (user: User) => {
    session.clearExpired()
    // Never show one account's cached data to another.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
    queryClient.setQueryData(qk.me, user)
    navigate(landingPath(user.role, from), { replace: true })
  }
}
