import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { errorMessage, fieldError } from '../../services/http'
import type { ProgressSummary } from '../../services/types'
import { formatDateTime, parseISODate } from '../../utils/dates'

function WeeklyChart({ weekly }: { weekly: ProgressSummary['weekly'] }) {
  const max = Math.max(...weekly.map((w) => w.workouts), 1)
  const label = (weekStart: string) =>
    parseISODate(weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <ol className="bars" aria-label="Sessions logged per week">
      {weekly.map((week) => (
        <li key={week.weekStart}>
          <span className="bar-value">{week.workouts}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar" style={{ height: `${(week.workouts / max) * 100}%` }} />
          </span>
          <span className="bar-label">
            <span className="visually-hidden">sessions in the week of </span>{label(week.weekStart)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Body weight is opt-in: nothing is asked for or shown unless the trainee opens this section. */
function WeightSection({ weights }: { weights: ProgressSummary['weights'] }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const record = useMutation({
    mutationFn: (weightKg: number) => api.recordWeight(weightKg),
    onSuccess: () => {
      setValue('')
      return queryClient.invalidateQueries({ queryKey: qk.progress })
    },
  })
  const weight = Number(value)
  const valid = value.trim() !== '' && weight >= 20 && weight <= 400

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (record.isPending || !valid) return
    record.mutate(weight)
  }

  return (
    <details className="card">
      <summary>Body weight <span className="hint">(optional)</span></summary>
      <div className="stack">
        <p className="hint">
          Record your weight only if it’s useful to you. It’s private to your account and never shown to trainers.
        </p>
        <form onSubmit={submit} className="row row-end">
          <div className="field">
            <label htmlFor="weight-kg">Weight in kg</label>
            <input
              id="weight-kg" className="input input-sm" type="number" inputMode="decimal" step="0.1" min={20} max={400}
              value={value} onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={record.isPending || !valid}>
            {record.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
        {record.isError && <Notice tone="danger">{fieldError(record.error, 'weightKg') ?? errorMessage(record.error)}</Notice>}
        {weights.length > 0 && (
          <ul className="list">
            {weights.map((entry) => (
              <li key={entry.id} className="list-row">
                <span>{entry.weightKg} kg</span>
                <span className="hint">{formatDateTime(entry.recordedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

export default function ProgressPage() {
  useTitle('Progress')
  const progress = useQuery({ queryKey: qk.progress, queryFn: api.getProgress })

  if (progress.isPending) return <LoadingState label="Loading your progress…" />
  if (progress.isError) {
    return (
      <div className="page">
        <ErrorState error={progress.error} onRetry={() => progress.refetch()} title="We couldn’t load your progress" />
      </div>
    )
  }

  const { totalWorkouts, weekly, recentLogs, weights } = progress.data
  const thisWeek = weekly.at(-1)?.workouts ?? 0

  return (
    <div className="page page-medium stack-lg">
      <header className="page-head">
        <h1>Progress</h1>
        <p className="lead">A record of the sessions you’ve logged.</p>
      </header>

      {totalWorkouts === 0 ? (
        <EmptyState title="Nothing logged yet" action={<Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>}>
          Complete a workout and it will show up here.
        </EmptyState>
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><span className="tile-value">{totalWorkouts}</span><span className="tile-label">sessions logged</span></div>
            <div className="tile"><span className="tile-value">{thisWeek}</span><span className="tile-label">this week</span></div>
          </div>

          <section className="card" aria-labelledby="weekly-heading">
            <h2 id="weekly-heading">Sessions per week</h2>
            <WeeklyChart weekly={weekly} />
          </section>

          <section aria-labelledby="history-heading">
            <h2 id="history-heading">History</h2>
            <ul className="list card">
              {recentLogs.map((log) => (
                <li key={log.id} className="history-row">
                  <div>
                    <strong>{log.workoutTitle}</strong>
                    <p className="hint">{log.planTitle}</p>
                    {log.notes && <p className="note">“{log.notes}”</p>}
                  </div>
                  <div className="history-meta">
                    <span>{formatDateTime(log.completedAt)}</span>
                    <span className="hint">
                      {log.setsCompleted}/{log.totalSets} sets{log.durationMinutes ? ` · ${log.durationMinutes} min` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <WeightSection weights={weights} />
    </div>
  )
}
