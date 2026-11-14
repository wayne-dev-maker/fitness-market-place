import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Badge, EmptyState, ErrorState, LoadingState, Notice, ProgressBar } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { formatDateTime, relativeDay, todayISO } from '../../utils/dates'
import { useMe } from '../auth/session'

export default function DashboardPage() {
  useTitle('Dashboard')
  const me = useMe()
  const enrolments = useQuery({ queryKey: qk.enrolments, queryFn: api.listMyEnrolments })
  const today = useQuery({ queryKey: qk.today, queryFn: api.listTodayWorkouts })
  const progress = useQuery({ queryKey: qk.progress, queryFn: api.getProgress })

  const active = enrolments.data?.filter((e) => e.status === 'ACTIVE') ?? []
  const schedules = useQueries({
    queries: active.map((e) => ({ queryKey: qk.schedule(e.id), queryFn: () => api.getSchedule(e.id) })),
  })
  const todayDate = todayISO()
  const upcoming = schedules
    .flatMap((s) => s.data ?? [])
    .filter((item) => item.scheduledDate > todayDate && !item.completedLogId)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5)

  if (enrolments.isPending) return <LoadingState label="Loading your dashboard…" />
  if (enrolments.isError) {
    return (
      <div className="page">
        <ErrorState error={enrolments.error} onRetry={() => enrolments.refetch()} title="We couldn’t load your dashboard" />
      </div>
    )
  }

  const firstName = me.data?.displayName.split(' ')[0]
  if (enrolments.data.length === 0) {
    return (
      <div className="page">
        <EmptyState
          title={firstName ? `Welcome, ${firstName}` : 'Welcome'}
          action={<Link className="btn btn-accent" to="/">Browse programmes</Link>}
        >
          You don’t have a programme yet. Pick one from the marketplace and your schedule will appear here.
        </EmptyState>
      </div>
    )
  }

  const thisWeek = progress.data?.weekly.at(-1)?.workouts ?? 0
  return (
    <div className="page stack-lg">
      <header className="page-head">
        <h1>{firstName ? `Hi, ${firstName}` : 'Dashboard'}</h1>
      </header>

      <section aria-labelledby="today-heading">
        <h2 id="today-heading">Today</h2>
        {today.isPending ? (
          <LoadingState label="Loading today’s session…" />
        ) : today.isError ? (
          <ErrorState error={today.error} onRetry={() => today.refetch()} title="We couldn’t load today’s session" />
        ) : today.data.length === 0 ? (
          <div className="card">
            <p><strong>No session scheduled today.</strong></p>
            <p className="hint">Rest is part of the plan. Your next sessions are listed below.</p>
          </div>
        ) : (
          <div className="stack">
            {today.data.map((item) => (
              <article key={item.workoutId} className="card today-card">
                <div>
                  <p className="eyebrow">{item.planTitle} · Week {item.weekNumber}</p>
                  <h3>{item.title}</h3>
                  <p className="hint">{item.durationMinutes} min · {item.exerciseCount} exercises</p>
                </div>
                {item.completedLogId ? (
                  <div className="row">
                    <Badge tone="ok">Done</Badge>
                    <Link className="btn btn-ghost" to={`/workouts/${item.workoutId}`}>View</Link>
                  </div>
                ) : (
                  <Link className="btn btn-accent" to={`/workouts/${item.workoutId}`}>Start workout</Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="programmes-heading">
        <h2 id="programmes-heading">Your programmes</h2>
        <div className="stack">
          {enrolments.data.map((enrolment) => (
            <article key={enrolment.id} className="card">
              <div className="card-head">
                <div>
                  <h3><Link to={`/programmes/${enrolment.id}`}>{enrolment.planTitle}</Link></h3>
                  <p className="hint">with {enrolment.trainerName}</p>
                </div>
                {enrolment.status === 'EXPIRED' && <Badge tone="warn">Access ended</Badge>}
              </div>
              <ProgressBar
                value={enrolment.completedWorkouts} max={enrolment.totalWorkouts}
                label={`${enrolment.planTitle} sessions completed`}
              />
              <p className="hint">{enrolment.completedWorkouts} of {enrolment.totalWorkouts} sessions logged</p>
            </article>
          ))}
        </div>
      </section>

      <div className="two-col">
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">Coming up</h2>
          {schedules.some((s) => s.isPending) ? (
            <LoadingState label="Loading your schedule…" />
          ) : schedules.some((s) => s.isError) ? (
            <Notice tone="danger">We couldn’t load your upcoming sessions. Open a programme to see its schedule.</Notice>
          ) : upcoming.length === 0 ? (
            <p className="hint">Nothing else scheduled. You’re up to date.</p>
          ) : (
            <ul className="list card">
              {upcoming.map((item) => (
                <li key={item.workoutId} className="list-row">
                  <span><strong>{relativeDay(item.scheduledDate)}</strong> · {item.title}</span>
                  <span className="hint">{item.durationMinutes} min</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading">Recent activity</h2>
          {progress.isPending ? (
            <LoadingState label="Loading your activity…" />
          ) : progress.isError ? (
            <Notice tone="danger">We couldn’t load your recent activity.</Notice>
          ) : progress.data.recentLogs.length === 0 ? (
            <p className="hint">Sessions you log will show up here.</p>
          ) : (
            <>
              <p className="hint">{thisWeek} session{thisWeek === 1 ? '' : 's'} logged this week</p>
              <ul className="list card">
                {progress.data.recentLogs.slice(0, 3).map((log) => (
                  <li key={log.id} className="list-row">
                    <span>{log.workoutTitle}</span>
                    <span className="hint">{formatDateTime(log.completedAt)}</span>
                  </li>
                ))}
              </ul>
              <Link to="/progress" className="more-link">See all progress →</Link>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
