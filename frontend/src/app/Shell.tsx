import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Suspense, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { LoadingState } from '../components/ui'
import { useMe } from '../features/auth/session'
import { api, qk } from '../services/api'
import { USE_MOCK_API } from '../services/http'
import type { Role } from '../services/types'
import { APP_NAME } from './config'

const NAV: { to: string; label: string; role?: Role; end?: boolean }[] = [
  { to: '/', label: 'Marketplace', end: true },
  { to: '/dashboard', label: 'Dashboard', role: 'TRAINEE' },
  { to: '/progress', label: 'Progress', role: 'TRAINEE' },
  { to: '/trainer', label: 'Studio', role: 'TRAINER' },
]

export function Shell() {
  const me = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // On navigation, start at the top and move focus to the new page for keyboard and screen-reader users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      // Drop every cached response that belonged to the signed-in user.
      queryClient.setQueryData(qk.me, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
      navigate('/')
    },
  })

  const user = me.data ?? null
  const items = NAV.filter((item) => !item.role || item.role === user?.role)
  const hasTabbar = items.length > 1

  return (
    <div className={hasTabbar ? 'shell has-tabbar' : 'shell'}>
      <a className="skip-link" href="#main">Skip to content</a>
      {USE_MOCK_API && (
        <p className="demo-strip">Demo mode: sample data in your browser. No real accounts or payments.</p>
      )}
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand" aria-label={`${APP_NAME} home`}>
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <rect width="32" height="32" rx="8" className="brand-tile" />
              <path d="M7 20.5 12 11l4.5 7 3-4.5 5.5 7" className="brand-line" />
            </svg>
            <span>{APP_NAME}</span>
          </Link>

          {hasTabbar && (
            <nav className="main-nav" aria-label="Main">
              {items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="account">
            {user ? (
              <>
                <span className="account-name" title={user.email}>{user.displayName}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
                  {logout.isPending ? 'Logging out…' : 'Log out'}
                </button>
              </>
            ) : (
              !me.isPending && (
                <>
                  <Link className="btn btn-ghost btn-sm" to="/login">Log in</Link>
                  <Link className="btn btn-primary btn-sm" to="/register">Sign up</Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="site-footer">
        <p>
          Programmes are general training guidance from independent trainers, not medical advice. Speak to a
          health professional if you have an injury or a health concern.
        </p>
      </footer>
    </div>
  )
}
