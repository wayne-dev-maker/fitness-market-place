import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { errorMessage, isApiError } from '../../services/http'
import type { AdaptationProposal, Workout, WorkoutLog, WorkoutLogInput, WorkoutSession } from '../../services/types'
import { relativeDay } from '../../utils/dates'
import { CheckinComposer } from '../accountability/Checkins'
import { AdaptationPanel } from '../assistant/AdaptationPanel'

/** What the player shows for one exercise: the trainer's prescription, or today's accepted adjustment of it. */
interface PlayerExercise {
  workoutExerciseId: string
  name: string
  sets: number
  reps: number
  restSeconds: number
  instructions: string
  note: string
}

interface SetRow {
  reps: string
  weight: string
  done: boolean
}

function fromWorkout(workout: Workout): PlayerExercise[] {
  return workout.exercises.map((e) => ({
    workoutExerciseId: e.id, name: e.exerciseName, sets: e.prescribedSets, reps: e.prescribedReps,
    restSeconds: e.restSeconds, instructions: e.instructions, note: '',
  }))
}

function fromProposal(workout: Workout, proposal: AdaptationProposal): PlayerExercise[] {
  return proposal.exercises
    .filter((e) => e.change !== 'REMOVED')
    .map((e) => ({
      workoutExerciseId: e.workoutExerciseId, name: e.exerciseName, sets: e.sets, reps: e.reps,
      restSeconds: e.restSeconds,
      // Trainer instructions describe the original movement, so they are dropped for a swap.
      instructions: e.change === 'SUBSTITUTED' ? '' : (workout.exercises.find((w) => w.id === e.workoutExerciseId)?.instructions ?? ''),
      note: e.change === 'UNCHANGED' ? '' : e.note,
    }))
}

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function RestBar({ endsAt, onDone }: { endsAt: number; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(Math.ceil((endsAt - now) / 1000), 0)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (remaining === 0) onDone()
  }, [remaining, onDone])

  return (
    <div className="rest-bar" role="timer" aria-label="Rest timer">
      <span>Rest <strong>{formatClock(remaining)}</strong></span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onDone}>Skip</button>
    </div>
  )
}

function WorkoutLogger({ session, exercises, onSaved }: {
  session: WorkoutSession
  exercises: PlayerExercise[]
  onSaved: (log: WorkoutLog) => void
}) {
  const queryClient = useQueryClient()
  // One id per attempt at this session: a retry after a dropped connection cannot create a second log.
  const [clientRequestId] = useState(() => crypto.randomUUID())
  const [rows, setRows] = useState<Record<string, SetRow[]>>(() =>
    Object.fromEntries(exercises.map((e) => [
      e.workoutExerciseId,
      Array.from({ length: e.sets }, () => ({ reps: String(e.reps), weight: '', done: false })),
    ])),
  )
  const [notes, setNotes] = useState('')
  const [minutes, setMinutes] = useState('')
  const [autoRest, setAutoRest] = useState(true)
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null)
  const [formError, setFormError] = useState('')

  const save = useMutation({
    mutationFn: (input: WorkoutLogInput) => api.createWorkoutLog(input),
    // The log is only treated as saved once the server has confirmed it.
    onSuccess: (log) => {
      for (const queryKey of [qk.today, qk.enrolments, qk.progress, qk.schedule(session.enrolmentId), qk.workout(session.workout.id)]) {
        void queryClient.invalidateQueries({ queryKey })
      }
      onSaved(log)
    },
  })

  const updateRow = (exerciseId: string, index: number, change: Partial<SetRow>) =>
    setRows((current) => ({
      ...current,
      [exerciseId]: current[exerciseId].map((row, i) => (i === index ? { ...row, ...change } : row)),
    }))

  const toggleDone = (exercise: PlayerExercise, index: number) => {
    const done = !rows[exercise.workoutExerciseId][index].done
    updateRow(exercise.workoutExerciseId, index, { done })
    if (done && autoRest && exercise.restSeconds > 0) setRestEndsAt(Date.now() + exercise.restSeconds * 1000)
  }

  const allRows = Object.values(rows).flat()
  const doneCount = allRows.filter((row) => row.done).length

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (save.isPending) return

    const sets: WorkoutLogInput['sets'] = []
    for (const exercise of exercises) {
      for (const [index, row] of rows[exercise.workoutExerciseId].entries()) {
        const reps = Number(row.reps)
        const weight = row.weight.trim() === '' ? null : Number(row.weight)
        if (!Number.isInteger(reps) || reps < 0 || reps > 500) {
          return setFormError(`${exercise.name}, set ${index + 1}: reps must be a whole number from 0 to 500.`)
        }
        if (weight !== null && !(weight >= 0 && weight <= 1000)) {
          return setFormError(`${exercise.name}, set ${index + 1}: weight must be between 0 and 1000 kg.`)
        }
        sets.push({ workoutExerciseId: exercise.workoutExerciseId, setNumber: index + 1, repsCompleted: reps, weightKg: weight, completed: row.done })
      }
    }
    if (doneCount === 0) return setFormError('Mark at least one set as done before completing the workout.')
    const duration = minutes.trim() === '' ? null : Number(minutes)
    if (duration !== null && !(Number.isInteger(duration) && duration >= 1 && duration <= 600)) {
      return setFormError('Time taken must be a whole number of minutes from 1 to 600.')
    }

    setFormError('')
    setRestEndsAt(null)
    save.mutate({ clientRequestId, workoutId: session.workout.id, durationMinutes: duration, notes: notes.trim(), sets })
  }

  return (
    <form onSubmit={submit} className="stack-lg" noValidate>
      <label className="check">
        <input type="checkbox" checked={autoRest} onChange={(e) => setAutoRest(e.target.checked)} />
        Start a rest timer when I finish a set
      </label>

      {exercises.map((exercise, position) => (
        <section key={exercise.workoutExerciseId} className="card exercise" aria-labelledby={`ex-${exercise.workoutExerciseId}`}>
          <header>
            <p className="eyebrow">Exercise {position + 1} of {exercises.length}</p>
            <h2 id={`ex-${exercise.workoutExerciseId}`}>{exercise.name}</h2>
            <p className="prescription">
              {exercise.sets} × {exercise.reps}
              {exercise.restSeconds > 0 && <span className="hint"> · rest {exercise.restSeconds}s</span>}
            </p>
            {exercise.instructions && <p>{exercise.instructions}</p>}
            {exercise.note && <p className="hint">Adjusted today: {exercise.note}</p>}
          </header>

          <div className="sets" role="group" aria-label={`Sets for ${exercise.name}`}>
            <div className="set-row set-head" aria-hidden="true">
              <span>Set</span><span>Reps</span><span>Weight (kg)</span><span />
            </div>
            {rows[exercise.workoutExerciseId].map((row, index) => (
              <div key={index} className={row.done ? 'set-row is-done' : 'set-row'}>
                <span className="set-number">{index + 1}</span>
                <input
                  className="input" type="number" inputMode="numeric" min={0} max={500}
                  aria-label={`${exercise.name} set ${index + 1} reps`}
                  value={row.reps} onChange={(e) => updateRow(exercise.workoutExerciseId, index, { reps: e.target.value })}
                />
                <input
                  className="input" type="number" inputMode="decimal" min={0} max={1000} step="0.5" placeholder="Optional"
                  aria-label={`${exercise.name} set ${index + 1} weight in kilograms`}
                  value={row.weight} onChange={(e) => updateRow(exercise.workoutExerciseId, index, { weight: e.target.value })}
                />
                <button
                  type="button" className={row.done ? 'btn btn-sm btn-done' : 'btn btn-sm btn-ghost'}
                  aria-pressed={row.done} aria-label={`${exercise.name} set ${index + 1} done`}
                  onClick={() => toggleDone(exercise, index)}
                >
                  {row.done ? '✓ Done' : 'Done'}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card stack">
        <h2>Finish up</h2>
        <div className="field">
          <label htmlFor="log-minutes">Time taken in minutes <span className="hint">(optional)</span></label>
          <input
            id="log-minutes" className="input input-sm" type="number" inputMode="numeric" min={1} max={600}
            value={minutes} onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="log-notes">Notes <span className="hint">(optional, only you can see these)</span></label>
          <textarea id="log-notes" className="input" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {formError && <Notice tone="danger">{formError}</Notice>}
        {save.isError && (
          <Notice tone="danger" title="Your workout wasn’t saved">
            {isApiError(save.error, 409)
              ? 'This workout has already been logged.'
              : `${errorMessage(save.error)} Your entries are still here, so you can try again.`}
          </Notice>
        )}
        <p className="hint" aria-live="polite">{doneCount} of {allRows.length} sets marked done</p>
        <button type="submit" className="btn btn-accent btn-block" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Complete workout'}
        </button>
      </section>

      {restEndsAt !== null && <RestBar key={restEndsAt} endsAt={restEndsAt} onDone={() => setRestEndsAt(null)} />}
    </form>
  )
}

function WorkoutPlayer({ workoutId }: { workoutId: string }) {
  const session = useQuery({ queryKey: qk.workout(workoutId), queryFn: () => api.getWorkoutSession(workoutId) })
  const [adaptation, setAdaptation] = useState<AdaptationProposal | null>(null)
  const [savedLog, setSavedLog] = useState<WorkoutLog | null>(null)
  useTitle(session.data?.workout.title ?? 'Workout')

  if (session.isPending) return <LoadingState label="Loading workout…" />
  if (session.isError) {
    const { error } = session
    // The server decides access. These states explain its answer; they are not the control.
    if (isApiError(error, 403)) {
      const expired = error.code === 'ACCESS_EXPIRED'
      return (
        <div className="page">
          <EmptyState
            title={expired ? 'Your access to this programme has ended' : 'This workout is part of a paid programme'}
            action={<Link className="btn btn-primary" to={expired ? '/dashboard' : '/'}>{expired ? 'Go to dashboard' : 'Browse programmes'}</Link>}
          >
            {expired
              ? 'The sessions you logged are still under Progress.'
              : 'Buy the programme to open its workouts. If you have just paid, it unlocks once the payment is confirmed.'}
          </EmptyState>
        </div>
      )
    }
    if (isApiError(error, 404)) {
      return (
        <div className="page">
          <EmptyState title="Workout not found" action={<Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>}>
            This workout doesn’t exist or is no longer part of your programme.
          </EmptyState>
        </div>
      )
    }
    return <div className="page"><ErrorState error={error} onRetry={() => session.refetch()} title="We couldn’t load this workout" /></div>
  }

  const { workout, planTitle, weekNumber, scheduledDate, enrolmentId, planId, completedLogId } = session.data
  const exercises = adaptation ? fromProposal(workout, adaptation) : fromWorkout(workout)

  return (
    <div className="page page-medium stack-lg">
      <div>
        <Link to={`/programmes/${enrolmentId}`} className="back-link">← {planTitle}</Link>
        <header className="page-head">
          <p className="eyebrow">Week {weekNumber} · {relativeDay(scheduledDate)} · {workout.durationMinutes} min</p>
          <h1>{workout.title}</h1>
          {workout.description && <p className="lead">{workout.description}</p>}
        </header>
      </div>

      {savedLog ? (
        <>
          <div className="card status-card">
            <span className="status-mark status-ok" aria-hidden="true">✓</span>
            <h2>Workout logged</h2>
            <p>{savedLog.setsCompleted} of {savedLog.totalSets} sets completed. It’s saved to your history.</p>
            <div className="row row-center">
              <Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link>
              <Link className="btn btn-ghost" to="/progress">View progress</Link>
            </div>
          </div>
          <div className="card">
            <CheckinComposer planId={planId} workoutLogId={savedLog.id} />
          </div>
        </>
      ) : completedLogId ? (
        <>
          <Notice tone="ok" title="You’ve logged this workout">
            What you did is saved under <Link to="/progress">Progress</Link>. The prescription is below for reference.
          </Notice>
          <ul className="list card">
            {workout.exercises.map((e) => (
              <li key={e.id} className="list-row">
                <span><strong>{e.exerciseName}</strong>{e.instructions && <span className="hint"> · {e.instructions}</span>}</span>
                <span className="hint">{e.prescribedSets} × {e.prescribedReps}</span>
              </li>
            ))}
          </ul>
        </>
      ) : workout.exercises.length === 0 ? (
        <EmptyState title="No exercises in this session">Your trainer hasn’t added exercises to this workout.</EmptyState>
      ) : (
        <>
          {adaptation ? (
            <Notice title="You’re using an adjusted version for today">
              Your trainer’s original programme is unchanged.{' '}
              <button type="button" className="link-button" onClick={() => setAdaptation(null)}>Switch back to the original</button>
            </Notice>
          ) : (
            <AdaptationPanel workout={workout} onAccept={setAdaptation} />
          )}
          {exercises.length === 0 ? (
            <Notice tone="warn">
              The adjusted version has no exercises left.{' '}
              <button type="button" className="link-button" onClick={() => setAdaptation(null)}>Switch back to the original</button>
            </Notice>
          ) : (
            <WorkoutLogger key={adaptation?.id ?? 'original'} session={session.data} exercises={exercises} onSaved={setSavedLog} />
          )}
        </>
      )}
    </div>
  )
}

export default function WorkoutPlayerPage() {
  const { workoutId = '' } = useParams()
  // Keyed so that moving between workouts never carries one session's entries into another.
  return <WorkoutPlayer key={workoutId} workoutId={workoutId} />
}
