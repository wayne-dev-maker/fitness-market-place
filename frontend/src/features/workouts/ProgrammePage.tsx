import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Badge, EmptyState, ErrorState, LoadingState, Notice, ProgressBar } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import type { ScheduledWorkout } from '../../services/types'
import { relativeDay, todayISO } from '../../utils/dates'
import { CheckinList } from '../accountability/Checkins'

export default function ProgrammePage() {
  const { enrolmentId = '' } = useParams()
  const enrolments = useQuery({ queryKey: qk.enrolments, queryFn: api.listMyEnrolments })
  const enrolment = enrolments.data?.find((e) => e.id === enrolmentId)
  const schedule = useQuery({
    queryKey: qk.schedule(enrolmentId),
    queryFn: () => api.getSchedule(enrolmentId),
    enabled: Boolean(enrolment),
  })
  useTitle(enrolment?.planTitle ?? 'Programme')

  if (enrolments.isPending) return <LoadingState label="Loading programme…" />
  if (enrolments.isError) {
    return <div className="page"><ErrorState error={enrolments.error} onRetry={() => enrolments.refetch()} /></div>
  }
  if (!enrolment) {
    return (
      <div className="page">
        <EmptyState title="You don’t have access to this programme" action={<Link className="btn btn-primary" to="/">Browse programmes</Link>}>
          It isn’t one of the programmes on your account. Programmes you own are on your dashboard.
        </EmptyState>
      </div>
    )
  }

  const expired = enrolment.status === 'EXPIRED'
  const today = todayISO()
  const weeks = new Map<number, ScheduledWorkout[]>()
  for (const item of schedule.data ?? []) {
    weeks.set(item.weekNumber, [...(weeks.get(item.weekNumber) ?? []), item])
  }

  return (
    <div className="page stack-lg">
      <div>
        <Link to="/dashboard" className="back-link">← Dashboard</Link>
        <header className="page-head">
          <h1>{enrolment.planTitle}</h1>
          <p className="lead">with {enrolment.trainerName}</p>
        </header>
        <ProgressBar value={enrolment.completedWorkouts} max={enrolment.totalWorkouts} label="Sessions completed" />
        <p className="hint">{enrolment.completedWorkouts} of {enrolment.totalWorkouts} sessions logged</p>
      </div>

      {expired && (
        <Notice tone="warn" title="Your access to this programme has ended">
          You can still see what you logged under Progress, but the workouts can no longer be opened.
        </Notice>
      )}

      <section aria-labelledby="schedule-heading">
        <h2 id="schedule-heading">Schedule</h2>
        {schedule.isPending ? (
          <LoadingState label="Loading schedule…" />
        ) : schedule.isError ? (
          <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} title="We couldn’t load the schedule" />
        ) : schedule.data.length === 0 ? (
          <p className="hint">This programme has no sessions yet.</p>
        ) : (
          <div className="stack">
            {[...weeks.entries()].map(([weekNumber, items]) => (
              <div key={weekNumber} className="card">
                <h3>Week {weekNumber}</h3>
                <ul className="list">
                  {items.map((item) => {
                    const status = item.completedLogId
                      ? <Badge tone="ok">Done</Badge>
                      : item.scheduledDate === today
                        ? <Badge tone="accent">Today</Badge>
                        : item.scheduledDate < today
                          ? <Badge tone="warn">Not logged</Badge>
                          : null
                    return (
                      <li key={item.workoutId} className="list-row">
                        <span>
                          {expired
                            ? <strong>{item.title}</strong>
                            : <Link to={`/workouts/${item.workoutId}`}><strong>{item.title}</strong></Link>}
                          <span className="hint"> · {relativeDay(item.scheduledDate)} · {item.durationMinutes} min</span>
                        </span>
                        {status}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="checkins-heading">
        <h2 id="checkins-heading">Check-ins</h2>
        <p className="hint">Short notes from people following this programme. Only participants can see them.</p>
        <CheckinList planId={enrolment.planId} />
      </section>
    </div>
  )
}
