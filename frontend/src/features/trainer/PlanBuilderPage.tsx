import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Badge, EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { errorMessage, isApiError } from '../../services/http'
import type {
  ApiErrorDetail, Difficulty, Exercise, PlanDraftInput, PlanWeek, TrainerPlan, Workout, WorkoutExercise,
} from '../../services/types'
import { validatePlanForPublish } from './validatePlan'

const CURRENCIES = ['ZAR', 'USD', 'EUR', 'GBP']
const newId = () => `new-${crypto.randomUUID()}`
const numberValue = (n: number) => (Number.isFinite(n) ? n : '')
const toNumber = (text: string) => (text === '' ? Number.NaN : Number(text))

type Edit = (change: (draft: TrainerPlan) => void) => void

function toInput(plan: TrainerPlan): PlanDraftInput {
  return {
    version: plan.version,
    title: plan.title,
    description: plan.description,
    difficulty: plan.difficulty,
    price: plan.price,
    weeks: plan.weeks.map((week) => ({
      id: week.id,
      workouts: week.workouts.map((workout) => ({
        id: workout.id, title: workout.title, dayNumber: workout.dayNumber, durationMinutes: workout.durationMinutes,
        description: workout.description,
        exercises: workout.exercises.map((e) => ({
          id: e.id, exerciseId: e.exerciseId, prescribedSets: e.prescribedSets, prescribedReps: e.prescribedReps,
          restSeconds: e.restSeconds, instructions: e.instructions,
        })),
      })),
    })),
  }
}

function blankExercise(position: number): WorkoutExercise {
  return { id: newId(), exerciseId: '', exerciseName: '', position, prescribedSets: 3, prescribedReps: 10, restSeconds: 60, instructions: '' }
}

function blankWorkout(dayNumber: number): Workout {
  return { id: newId(), title: '', dayNumber, durationMinutes: 45, description: '', exercises: [blankExercise(1)] }
}

/** Copy of a week with fresh ids, so the copy is saved as new records rather than moving the original. */
function cloneWeek(week: PlanWeek): PlanWeek {
  return {
    id: newId(),
    weekNumber: 0,
    workouts: week.workouts.map((workout) => ({
      ...workout, id: newId(), exercises: workout.exercises.map((e) => ({ ...e, id: newId() })),
    })),
  }
}

function ExerciseRows({ workout, wi, oi, library, edit }: {
  workout: Workout; wi: number; oi: number; library: Exercise[]; edit: Edit
}) {
  const at = (draft: TrainerPlan) => draft.weeks[wi].workouts[oi].exercises
  const move = (from: number, to: number) => edit((d) => {
    const list = at(d)
    list.splice(to, 0, ...list.splice(from, 1))
  })
  const label = `week ${wi + 1} workout ${oi + 1}`

  return (
    <div className="ex-rows">
      {workout.exercises.map((exercise, ei) => {
        const rowLabel = `Exercise ${ei + 1}, ${label}`
        return (
          <div key={exercise.id} className="ex-row">
            <div className="field ex-name">
              <label htmlFor={`ex-${exercise.id}`}>Exercise {ei + 1}</label>
              <select
                id={`ex-${exercise.id}`} className="input" value={exercise.exerciseId}
                onChange={(e) => edit((d) => {
                  at(d)[ei].exerciseId = e.target.value
                  at(d)[ei].exerciseName = library.find((x) => x.id === e.target.value)?.name ?? ''
                })}
              >
                <option value="">Choose an exercise…</option>
                {library.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} ({item.equipment === 'None' ? 'no equipment' : item.equipment.toLowerCase()})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`sets-${exercise.id}`}>Sets</label>
              <input
                id={`sets-${exercise.id}`} className="input" type="number" inputMode="numeric" min={1} max={20}
                value={numberValue(exercise.prescribedSets)}
                onChange={(e) => edit((d) => { at(d)[ei].prescribedSets = toNumber(e.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor={`reps-${exercise.id}`}>Reps</label>
              <input
                id={`reps-${exercise.id}`} className="input" type="number" inputMode="numeric" min={1} max={200}
                value={numberValue(exercise.prescribedReps)}
                onChange={(e) => edit((d) => { at(d)[ei].prescribedReps = toNumber(e.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor={`rest-${exercise.id}`}>Rest (s)</label>
              <input
                id={`rest-${exercise.id}`} className="input" type="number" inputMode="numeric" min={0} max={900} step={5}
                value={numberValue(exercise.restSeconds)}
                onChange={(e) => edit((d) => { at(d)[ei].restSeconds = toNumber(e.target.value) })}
              />
            </div>
            <div className="field ex-notes">
              <label htmlFor={`notes-${exercise.id}`}>Instructions</label>
              <input
                id={`notes-${exercise.id}`} className="input" maxLength={500} placeholder="Optional coaching cue"
                value={exercise.instructions}
                onChange={(e) => edit((d) => { at(d)[ei].instructions = e.target.value })}
              />
            </div>
            <div className="ex-actions">
              <button type="button" className="btn btn-sm btn-ghost" disabled={ei === 0} aria-label={`Move up: ${rowLabel}`} onClick={() => move(ei, ei - 1)}>↑</button>
              <button type="button" className="btn btn-sm btn-ghost" disabled={ei === workout.exercises.length - 1} aria-label={`Move down: ${rowLabel}`} onClick={() => move(ei, ei + 1)}>↓</button>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={`Remove: ${rowLabel}`} onClick={() => edit((d) => { at(d).splice(ei, 1) })}>Remove</button>
            </div>
          </div>
        )
      })}
      <div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => edit((d) => { at(d).push(blankExercise(at(d).length + 1)) })}>
          + Add exercise
        </button>
      </div>
    </div>
  )
}

function WeekEditor({ week, wi, library, edit }: { week: PlanWeek; wi: number; library: Exercise[]; edit: Edit }) {
  const nextFreeDay = () => {
    const used = new Set(week.workouts.map((w) => w.dayNumber))
    return [1, 2, 3, 4, 5, 6, 7].find((day) => !used.has(day)) ?? 7
  }

  return (
    <section className="card week" aria-labelledby={`week-${week.id}`}>
      <div className="card-head">
        <h3 id={`week-${week.id}`}>Week {wi + 1}</h3>
        <div className="row">
          <button
            type="button" className="btn btn-sm btn-ghost"
            onClick={() => edit((d) => { d.weeks.splice(wi + 1, 0, cloneWeek(d.weeks[wi])) })}
          >
            Duplicate week
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => edit((d) => { d.weeks.splice(wi, 1) })}>
            Remove week
          </button>
        </div>
      </div>

      {week.workouts.length === 0 && <p className="hint">No workouts in this week yet.</p>}

      {week.workouts.map((workout, oi) => (
        <div key={workout.id} className="workout-edit">
          <div className="workout-fields">
            <div className="field field-grow">
              <label htmlFor={`wt-${workout.id}`}>Workout title</label>
              <input
                id={`wt-${workout.id}`} className="input" maxLength={120} placeholder="e.g. Lower body"
                value={workout.title}
                onChange={(e) => edit((d) => { d.weeks[wi].workouts[oi].title = e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`wd-${workout.id}`}>Day</label>
              <select
                id={`wd-${workout.id}`} className="input" value={workout.dayNumber}
                onChange={(e) => edit((d) => { d.weeks[wi].workouts[oi].dayNumber = Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>Day {day}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`wm-${workout.id}`}>Minutes</label>
              <input
                id={`wm-${workout.id}`} className="input" type="number" inputMode="numeric" min={5} max={300} step={5}
                value={numberValue(workout.durationMinutes)}
                onChange={(e) => edit((d) => { d.weeks[wi].workouts[oi].durationMinutes = toNumber(e.target.value) })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor={`wn-${workout.id}`}>Session note <span className="hint">(optional)</span></label>
            <input
              id={`wn-${workout.id}`} className="input" maxLength={1000} placeholder="What this session is for"
              value={workout.description}
              onChange={(e) => edit((d) => { d.weeks[wi].workouts[oi].description = e.target.value })}
            />
          </div>
          <ExerciseRows workout={workout} wi={wi} oi={oi} library={library} edit={edit} />
          <div>
            <button
              type="button" className="btn btn-sm btn-ghost"
              aria-label={`Remove workout ${oi + 1} from week ${wi + 1}`}
              onClick={() => edit((d) => { d.weeks[wi].workouts.splice(oi, 1) })}
            >
              Remove workout
            </button>
          </div>
        </div>
      ))}

      <div>
        <button
          type="button" className="btn btn-ghost" disabled={week.workouts.length >= 7}
          onClick={() => edit((d) => { d.weeks[wi].workouts.push(blankWorkout(nextFreeDay())) })}
        >
          + Add workout
        </button>
      </div>
    </section>
  )
}

function PlanEditor({ plan, library }: { plan: TrainerPlan; library: Exercise[] }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<TrainerPlan>(() => structuredClone(plan))
  const [serverIssues, setServerIssues] = useState<ApiErrorDetail[]>([])
  const readOnly = plan.status !== 'DRAFT'

  const edit: Edit = (change) => setDraft((current) => {
    const next = structuredClone(current)
    change(next)
    return next
  })

  const dirty = useMemo(() => JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(plan)), [draft, plan])
  const issues = useMemo(() => validatePlanForPublish(draft), [draft])

  const applySaved = (saved: TrainerPlan) => {
    queryClient.setQueryData(qk.trainerPlan(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: qk.trainerPlans })
    setDraft(structuredClone(saved))
  }
  const collectIssues = (error: unknown) => setServerIssues(isApiError(error, 422) ? error.details : [])

  const save = useMutation({
    mutationFn: () => api.updateTrainerPlan(plan.id, toInput(draft)),
    onMutate: () => setServerIssues([]),
    onSuccess: applySaved,
    onError: collectIssues,
  })
  const publish = useMutation({
    mutationFn: () => api.publishTrainerPlan(plan.id),
    onMutate: () => setServerIssues([]),
    onSuccess: (published) => {
      applySaved(published)
      void queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
    onError: collectIssues,
  })
  const busy = save.isPending || publish.isPending

  // Publishing always publishes what is on screen: unsaved edits are saved first.
  const saveThenPublish = async () => {
    try {
      if (dirty) await save.mutateAsync()
      await publish.mutateAsync()
    } catch {
      // Both mutations surface their own errors below.
    }
  }

  const reload = async () => {
    save.reset()
    publish.reset()
    setServerIssues([])
    const fresh = await queryClient.fetchQuery({
      queryKey: qk.trainerPlan(plan.id), queryFn: () => api.getTrainerPlan(plan.id), staleTime: 0,
    })
    setDraft(structuredClone(fresh))
  }

  const failure = save.error ?? publish.error
  const conflict = isApiError(failure, 409)

  return (
    <div className="page stack-lg">
      <div>
        <Link to="/trainer" className="back-link">← Studio</Link>
        <header className="page-head">
          <div className="row">
            <h1>{draft.title || 'Untitled plan'}</h1>
            <Badge tone={readOnly ? 'ok' : 'warn'}>{plan.status === 'PUBLISHED' ? 'Published' : plan.status === 'DRAFT' ? 'Draft' : 'Archived'}</Badge>
          </div>
        </header>
      </div>

      {readOnly && (
        <Notice title="This plan is published and can’t be edited">
          People who bought it keep exactly what they paid for. {plan.enrolmentCount} active enrolment{plan.enrolmentCount === 1 ? '' : 's'}.{' '}
          <Link to={`/plans/${plan.id}`}>View the marketplace listing</Link>
        </Notice>
      )}

      <div className="split">
        <fieldset className="stack-lg builder" disabled={readOnly || busy}>
          <legend className="visually-hidden">Plan details and structure</legend>

          <section className="card stack">
            <h2>Details</h2>
            <div className="field">
              <label htmlFor="plan-title">Title</label>
              <input id="plan-title" className="input" maxLength={120} value={draft.title} onChange={(e) => edit((d) => { d.title = e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="plan-description">Description</label>
              <textarea
                id="plan-description" className="input" rows={4} maxLength={2000}
                placeholder="Who is this for, what will they do, and what do they need?"
                value={draft.description} onChange={(e) => edit((d) => { d.description = e.target.value })}
              />
            </div>
            <div className="row row-end">
              <div className="field">
                <label htmlFor="plan-level">Level</label>
                <select id="plan-level" className="input" value={draft.difficulty} onChange={(e) => edit((d) => { d.difficulty = e.target.value as Difficulty })}>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="plan-price">Price (one-time)</label>
                <input
                  id="plan-price" className="input input-sm" inputMode="decimal" placeholder="349.00"
                  value={draft.price.amount} onChange={(e) => edit((d) => { d.price.amount = e.target.value.trim() })}
                />
              </div>
              <div className="field">
                <label htmlFor="plan-currency">Currency</label>
                <select id="plan-currency" className="input" value={draft.price.currency} onChange={(e) => edit((d) => { d.price.currency = e.target.value })}>
                  {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="stack" aria-labelledby="structure-heading">
            <h2 id="structure-heading">Weeks and workouts</h2>
            {draft.weeks.length === 0 && <p className="hint">This plan has no weeks yet. Add the first one to start building.</p>}
            {draft.weeks.map((week, wi) => <WeekEditor key={week.id} week={week} wi={wi} library={library} edit={edit} />)}
            <div>
              <button
                type="button" className="btn btn-primary" disabled={draft.weeks.length >= 52}
                onClick={() => edit((d) => { d.weeks.push({ id: newId(), weekNumber: d.weeks.length + 1, workouts: [] }) })}
              >
                + Add week
              </button>
            </div>
          </section>
        </fieldset>

        {!readOnly && (
          <aside className="card stack publish-panel" aria-label="Save and publish">
            <h2>Publish checklist</h2>
            {issues.length === 0 ? (
              <Notice tone="ok" title="Ready to publish" />
            ) : (
              <>
                <p className="hint">{issues.length} thing{issues.length === 1 ? '' : 's'} to fix before this can be published:</p>
                <ul className="issues">
                  {issues.slice(0, 8).map((issue, i) => <li key={`${issue.field}-${i}`}>{issue.message}</li>)}
                  {issues.length > 8 && <li>…and {issues.length - 8} more</li>}
                </ul>
              </>
            )}

            {failure !== null && (
              <Notice tone="danger" title={save.isError ? 'Your changes weren’t saved' : 'This plan wasn’t published'}>
                {errorMessage(failure)}
                {serverIssues.length > 0 && (
                  <ul className="issues">{serverIssues.map((issue, i) => <li key={`${issue.field}-${i}`}>{issue.message}</li>)}</ul>
                )}
                {conflict && (
                  <p><button type="button" className="link-button" onClick={() => void reload()}>Discard my changes and reload</button></p>
                )}
              </Notice>
            )}
            {save.isSuccess && !dirty && !failure && <p className="hint" role="status">All changes saved.</p>}

            <button type="button" className="btn btn-primary btn-block" disabled={busy || !dirty} onClick={() => save.mutate()}>
              {save.isPending ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
            </button>
            <button type="button" className="btn btn-accent btn-block" disabled={busy || issues.length > 0} onClick={() => void saveThenPublish()}>
              {publish.isPending ? 'Publishing…' : 'Publish to marketplace'}
            </button>
            <p className="hint">Once published, a plan is listed for sale and can no longer be edited.</p>
          </aside>
        )}
      </div>
    </div>
  )
}

export default function PlanBuilderPage() {
  const { planId = '' } = useParams()
  const plan = useQuery({ queryKey: qk.trainerPlan(planId), queryFn: () => api.getTrainerPlan(planId) })
  const library = useQuery({ queryKey: qk.exercises, queryFn: api.listExercises, staleTime: Infinity })
  useTitle(plan.data?.title ?? 'Plan builder')

  if (plan.isPending || library.isPending) return <LoadingState label="Loading plan…" />
  if (plan.isError) {
    return (
      <div className="page">
        {isApiError(plan.error, 404) ? (
          <EmptyState title="Plan not found" action={<Link className="btn btn-primary" to="/trainer">Back to studio</Link>}>
            This plan doesn’t exist, or it belongs to another trainer.
          </EmptyState>
        ) : (
          <ErrorState error={plan.error} onRetry={() => plan.refetch()} title="We couldn’t load this plan" />
        )}
      </div>
    )
  }
  if (library.isError) {
    return <div className="page"><ErrorState error={library.error} onRetry={() => library.refetch()} title="We couldn’t load the exercise library" /></div>
  }
  return <PlanEditor key={plan.data.id} plan={plan.data} library={library.data} />
}
