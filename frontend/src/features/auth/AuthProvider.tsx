import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { qk } from '../../services/api'
import { setUnauthorizedHandler } from '../../services/http'
import { SessionContext } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    // Any authenticated request that comes back 401 means the session has ended.
    // Clearing the cached user makes RequireAuth send the person to the login page.
    setUnauthorizedHandler(() => {
      if (queryClient.getQueryData(qk.me)) setExpired(true)
      queryClient.setQueryData(qk.me, null)
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient])

  const value = useMemo(() => ({ expired, clearExpired: () => setExpired(false) }), [expired])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
