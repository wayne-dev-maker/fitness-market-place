import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import type { Role } from '../../services/types'
import { homeFor, useMe } from './session'

/**
 * Route guard for signed-in areas. This only decides what to render: every
 * protected request is still authorised by the server.
 */
export function RequireAuth({ role }: { role?: Role }) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <LoadingState label="Checking your session…" />
  if (me.isError) {
    return (
      <div className="page">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    )
  }
  if (!me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (role && me.data.role !== role) {
    return (
      <div className="page">
        <EmptyState
          title="This area isn’t part of your account"
          action={<Link className="btn btn-primary" to={homeFor(me.data.role)}>Go to your home page</Link>}
        >
          {role === 'TRAINER'
            ? 'The studio is for trainer accounts.'
            : 'This page is for trainee accounts.'}
        </EmptyState>
      </div>
    )
  }
  return <Outlet />
}
