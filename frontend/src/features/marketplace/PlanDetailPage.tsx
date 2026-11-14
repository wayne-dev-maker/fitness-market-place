import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router'
import { Avatar, Badge, EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { errorMessage, isApiError } from '../../services/http'
import type { PlanDetail } from '../../services/types'
import { formatMoney } from '../../utils/money'
import { useMe } from '../auth/session'
import { coverStyle, DIFFICULTY_LABEL } from './planDisplay'

function PurchasePanel({ plan }: { plan: PlanDetail }) {
  const me = useMe()
  const location = useLocation()
  const isTrainee = me.data?.role === 'TRAINEE'
  const enrolments = useQuery({ queryKey: qk.enrolments, queryFn: api.listMyEnrolments, enabled: isTrainee })
  const enrolment = enrolments.data?.find((e) => e.planId === plan.id && e.status === 'ACTIVE')

  const checkout = useMutation({
    mutationFn: () => api.createCheckout(plan.id),
    // Hand off to the provider's hosted page. Access is decided later by the server, never by this redirect.
    onSuccess: (session) => window.location.assign(session.checkoutUrl),
  })
  // Stay disabled after success too, while the browser is navigating away.
  const busy = checkout.isPending || checkout.isSuccess

  return (
    <aside className="card buy-card" aria-label="Purchase">
      <p className="buy-price">{formatMoney(plan.price)}</p>
      <p className="hint">One-time payment · {plan.durationWeeks} weeks of training</p>

      {me.isPending || (isTrainee && enrolments.isPending) ? (
        <LoadingState label="Checking your access…" />
      ) : !me.data ? (
        <>
          <Link className="btn btn-accent btn-block" to="/login" state={{ from: location.pathname }}>
            Log in to buy
          </Link>
          <p className="hint">
            New here? <Link to="/register" state={{ from: location.pathname }}>Create an account</Link>
          </p>
        </>
      ) : !isTrainee ? (
        <Notice>Programmes can be bought with a trainee account.</Notice>
      ) : enrolments.isError ? (
        <Notice tone="danger">
          We couldn’t check whether you already own this programme.{' '}
          <button type="button" className="link-button" onClick={() => enrolments.refetch()}>Try again</button>
        </Notice>
      ) : enrolment ? (
        <>
          <Notice tone="ok" title="You own this programme" />
          <Link className="btn btn-accent btn-block" to={`/programmes/${enrolment.id}`}>Open programme</Link>
        </>
      ) : (
        <>
          {checkout.isError && (
            <Notice tone="danger">
              {isApiError(checkout.error, 409)
                ? 'You already have access to this programme. Check your dashboard.'
                : errorMessage(checkout.error)}
            </Notice>
          )}
          <button type="button" className="btn btn-accent btn-block" disabled={busy} onClick={() => checkout.mutate()}>
            {busy ? 'Opening secure checkout…' : 'Buy programme'}
          </button>
          <p className="hint">
            You’ll pay on our payment partner’s secure page. Your programme unlocks as soon as the payment is confirmed.
          </p>
        </>
      )}
    </aside>
  )
}

export default function PlanDetailPage() {
  const { planId = '' } = useParams()
  const plan = useQuery({ queryKey: qk.plan(planId), queryFn: () => api.getPlan(planId) })
  useTitle(plan.data?.title ?? 'Programme')

  if (plan.isPending) return <LoadingState label="Loading programme…" />
  if (plan.isError) {
    return (
      <div className="page">
        {isApiError(plan.error, 404) ? (
          <EmptyState title="Programme not available" action={<Link className="btn btn-primary" to="/">Browse programmes</Link>}>
            This programme doesn’t exist or is no longer on sale.
          </EmptyState>
        ) : (
          <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
        )}
      </div>
    )
  }

  const data = plan.data
  return (
    <div className="page">
      <Link to="/" className="back-link">← All programmes</Link>
      <div className="split">
        <div className="stack">
          <header className="plan-head">
            <div className="cover cover-wide" style={coverStyle(data.id)} aria-hidden="true">
              <span className="cover-weeks">{data.durationWeeks}</span>
              <span className="cover-unit">week{data.durationWeeks === 1 ? '' : 's'}</span>
            </div>
            <div className="row">
              <Badge>{DIFFICULTY_LABEL[data.difficulty]}</Badge>
              <Badge>{data.durationWeeks} week{data.durationWeeks === 1 ? '' : 's'}</Badge>
              <Badge>{data.workoutsPerWeek} sessions a week</Badge>
            </div>
            <h1>{data.title}</h1>
            <p className="trainer">
              <Avatar name={data.trainer.displayName} />
              <span>Written by <strong>{data.trainer.displayName}</strong></span>
            </p>
          </header>

          <section>
            <h2>About this programme</h2>
            <p className="prose">{data.description}</p>
          </section>

          <section>
            <h2>What’s inside</h2>
            <p className="hint">Session outline. Exercises, sets and instructions unlock when you buy.</p>
            <div className="outline">
              {data.outline.map((week) => (
                <details key={week.weekNumber} open={week.weekNumber === 1}>
                  <summary>
                    Week {week.weekNumber}
                    <span className="hint"> · {week.workouts.length} session{week.workouts.length === 1 ? '' : 's'}</span>
                  </summary>
                  <ul className="list">
                    {week.workouts.map((workout) => (
                      <li key={workout.dayNumber} className="list-row">
                        <span><strong>Day {workout.dayNumber}</strong> · {workout.title}</span>
                        <span className="hint">{workout.durationMinutes} min · {workout.exerciseCount} exercises</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        </div>

        <PurchasePanel plan={data} />
      </div>
    </div>
  )
}
