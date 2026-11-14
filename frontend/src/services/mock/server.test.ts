import { beforeEach, describe, expect, it } from 'vitest'
import type * as T from '../types'
import { DEMO_PASSWORD, DEMO_TRAINEE_EMAIL, DEMO_TRAINER_EMAIL } from './seed'
import { handleMock, resetMockDb, simulateProviderOutcome } from './server'

// The mock is only a stand-in, but the demo must not misrepresent the product's rules.
// These tests pin the behaviours the real backend is required to have.

const call = (method: string, path: string, body?: unknown) => handleMock(method, path, body)
const login = (email: string) => call('POST', '/auth/login', { email, password: DEMO_PASSWORD })
const UNOWNED_PLAN = 'pln_bodyweight'
const UNOWNED_WORKOUT = 'pln_bodyweight_w1_d1'

async function enrolments(): Promise<T.Enrolment[]> {
  return (await call('GET', '/enrolments/me')).body as T.Enrolment[]
}

beforeEach(() => {
  sessionStorage.clear()
  resetMockDb()
})

describe('identity', () => {
  it('rejects protected requests without a session', async () => {
    expect((await call('GET', '/users/me')).status).toBe(401)
    expect((await call('GET', '/enrolments/me')).status).toBe(401)
  })

  it('always registers a trainee, whatever role the client asks for', async () => {
    const response = await call('POST', '/auth/register', {
      displayName: 'New Person', email: 'new@example.com', password: 'long-enough-pw', role: 'ADMIN',
    })
    expect(response.status).toBe(201)
    expect((response.body as T.User).role).toBe('TRAINEE')
  })

  it('reports field-level validation errors', async () => {
    const response = await call('POST', '/auth/register', { displayName: 'A', email: 'nope', password: 'short' })
    expect(response.status).toBe(422)
    const fields = (response.body as { details: T.ApiErrorDetail[] }).details.map((d) => d.field)
    expect(fields).toEqual(['displayName', 'email', 'password'])
  })
})

describe('marketplace', () => {
  it('lists only published plans and never exposes exercise prescriptions publicly', async () => {
    const page = (await call('GET', '/plans?size=50')).body as T.Page<T.PlanSummary>
    expect(page.items.map((p) => p.id)).not.toContain('pln_kettlebell')

    const detail = (await call('GET', `/plans/${UNOWNED_PLAN}`)).body as T.PlanDetail
    expect(JSON.stringify(detail)).not.toContain('prescribedSets')
    expect((await call('GET', '/plans/pln_kettlebell')).status).toBe(404)
  })

  it('filters by level and search text', async () => {
    const page = (await call('GET', '/plans?difficulty=ADVANCED')).body as T.Page<T.PlanSummary>
    expect(page.items.map((p) => p.id)).toEqual(['pln_ppl'])
    const searched = (await call('GET', '/plans?search=bodyweight')).body as T.Page<T.PlanSummary>
    expect(searched.items.map((p) => p.id)).toEqual([UNOWNED_PLAN])
  })
})

describe('purchase and access', () => {
  beforeEach(async () => {
    await login(DEMO_TRAINEE_EMAIL)
  })

  it('does not grant access when checkout starts or when the buyer simply returns', async () => {
    const before = await enrolments()
    const checkout = await call('POST', '/checkout', { planId: UNOWNED_PLAN, amount: '0.01' })
    expect(checkout.status).toBe(201)
    const { purchaseId } = checkout.body as T.CheckoutSession

    const purchase = (await call('GET', `/purchases/${purchaseId}`)).body as T.Purchase
    expect(purchase.status).toBe('PENDING')
    // The server-owned price is charged, not the amount the client sent.
    expect(purchase.amount).toEqual({ amount: '249.00', currency: 'ZAR' })
    expect(await enrolments()).toHaveLength(before.length)
    expect((await call('GET', `/workouts/${UNOWNED_WORKOUT}`)).status).toBe(403)
  })

  it('grants exactly one enrolment after confirmation, even if the confirmation repeats', async () => {
    const before = await enrolments()
    const { purchaseId } = (await call('POST', '/checkout', { planId: UNOWNED_PLAN })).body as T.CheckoutSession

    simulateProviderOutcome(purchaseId, 'PAID')
    expect(((await call('GET', `/purchases/${purchaseId}`)).body as T.Purchase).status).toBe('PAID')
    simulateProviderOutcome(purchaseId, 'PAID')
    simulateProviderOutcome(purchaseId, 'FAILED')

    const after = await enrolments()
    expect(after.filter((e) => e.planId === UNOWNED_PLAN)).toHaveLength(1)
    expect(after).toHaveLength(before.length + 1)
    expect((await call('GET', `/workouts/${UNOWNED_WORKOUT}`)).status).toBe(200)
  })

  it('grants nothing for a failed or cancelled payment', async () => {
    for (const outcome of ['FAILED', 'CANCELLED'] as const) {
      const { purchaseId } = (await call('POST', '/checkout', { planId: UNOWNED_PLAN })).body as T.CheckoutSession
      simulateProviderOutcome(purchaseId, outcome)
      expect(((await call('GET', `/purchases/${purchaseId}`)).body as T.Purchase).status).toBe(outcome)
    }
    expect((await enrolments()).some((e) => e.planId === UNOWNED_PLAN)).toBe(false)
    expect((await call('GET', `/workouts/${UNOWNED_WORKOUT}`)).status).toBe(403)
  })

  it('refuses a second purchase of a programme the buyer already owns', async () => {
    expect((await call('POST', '/checkout', { planId: 'pln_foundations' })).status).toBe(409)
  })

  it('hides one buyer’s purchase from another account', async () => {
    const { purchaseId } = (await call('POST', '/checkout', { planId: UNOWNED_PLAN })).body as T.CheckoutSession
    await login('sam@example.com')
    expect((await call('GET', `/purchases/${purchaseId}`)).status).toBe(404)
  })

  it('does not let a trainer account buy', async () => {
    await login(DEMO_TRAINER_EMAIL)
    expect((await call('POST', '/checkout', { planId: UNOWNED_PLAN })).status).toBe(403)
  })
})

describe('workout logging', () => {
  const TODAY_WORKOUT = 'pln_foundations_w2_d1'

  function logInput(session: T.WorkoutSession, clientRequestId: string): T.WorkoutLogInput {
    return {
      clientRequestId,
      workoutId: session.workout.id,
      durationMinutes: 38,
      notes: 'Felt good',
      sets: session.workout.exercises.map((e) => ({
        workoutExerciseId: e.id, setNumber: 1, repsCompleted: e.prescribedReps, weightKg: null, completed: true,
      })),
    }
  }

  beforeEach(async () => {
    await login(DEMO_TRAINEE_EMAIL)
  })

  it('shows today’s scheduled workout for an enrolled trainee', async () => {
    const today = (await call('GET', '/workouts/today')).body as T.ScheduledWorkout[]
    expect(today.map((w) => w.workoutId)).toEqual([TODAY_WORKOUT])
    expect(today[0].completedLogId).toBeNull()
  })

  it('stores a log once: a retried submission returns the same log', async () => {
    const session = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    const input = logInput(session, 'request-1')

    const first = await call('POST', '/workout-logs', input)
    const retry = await call('POST', '/workout-logs', input)
    expect(first.status).toBe(201)
    expect(retry.status).toBe(200)
    expect((retry.body as T.WorkoutLog).id).toBe((first.body as T.WorkoutLog).id)

    // A different submission for the same workout is a conflict, not a second log.
    expect((await call('POST', '/workout-logs', logInput(session, 'request-2'))).status).toBe(409)

    const progress = (await call('GET', '/progress/me')).body as T.ProgressSummary
    expect(progress.recentLogs.filter((l) => l.workoutId === TODAY_WORKOUT)).toHaveLength(1)
    expect(progress.totalWorkouts).toBe(3)
  })

  it('leaves the trainer’s prescription untouched after logging different numbers', async () => {
    const session = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    const input = logInput(session, 'request-3')
    input.sets = input.sets.map((s) => ({ ...s, repsCompleted: 1, weightKg: 99 }))
    await call('POST', '/workout-logs', input)

    const again = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    expect(again.workout.exercises).toEqual(session.workout.exercises)
    expect(again.completedLogId).not.toBeNull()
  })

  it('rejects sets for exercises that are not in the workout', async () => {
    const session = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    const input = logInput(session, 'request-4')
    input.sets[0].workoutExerciseId = 'pln_barbell_w1_d1_e1'
    expect((await call('POST', '/workout-logs', input)).status).toBe(422)
  })

  it('only allows a check-in on the caller’s own workout log', async () => {
    const someoneElse = await call('POST', '/plans/pln_foundations/checkins', { workoutLogId: 'log_seed3', message: 'Hi' })
    expect(someoneElse.status).toBe(403)
    const own = await call('POST', '/plans/pln_foundations/checkins', { workoutLogId: 'log_seed1', message: 'Done!' })
    expect(own.status).toBe(201)
    expect((await call('GET', `/plans/${UNOWNED_PLAN}/checkins`)).status).toBe(403)
  })

  it('never increases the prescription in a suggested adaptation and leaves the plan unchanged', async () => {
    const session = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    const response = await call('POST', '/assistant/adapt', {
      workoutId: TODAY_WORKOUT, minutesAvailable: 15, equipment: [], energy: 'LOW',
    })
    expect(response.status).toBe(201)
    const proposal = response.body as T.AdaptationProposal

    for (const adapted of proposal.exercises) {
      const original = session.workout.exercises.find((e) => e.id === adapted.workoutExerciseId)!
      expect(adapted.sets).toBeLessThanOrEqual(original.prescribedSets)
      expect(adapted.reps).toBeLessThanOrEqual(original.prescribedReps)
    }
    expect(proposal.exercises.some((e) => e.change === 'SUBSTITUTED')).toBe(true)

    const again = (await call('GET', `/workouts/${TODAY_WORKOUT}`)).body as T.WorkoutSession
    expect(again.workout).toEqual(session.workout)
  })
})

describe('trainer authoring', () => {
  beforeEach(async () => {
    await login(DEMO_TRAINER_EMAIL)
  })

  function draftInput(plan: T.TrainerPlan): T.PlanDraftInput {
    return {
      version: plan.version, title: plan.title, description: plan.description, difficulty: plan.difficulty,
      price: plan.price, weeks: plan.weeks,
    }
  }

  it('lists only the signed-in trainer’s plans and hides other trainers’ plans', async () => {
    const mine = (await call('GET', '/trainer/plans')).body as T.TrainerPlan[]
    expect(mine.map((p) => p.id).sort()).toEqual(['pln_core', 'pln_dumbbell', 'pln_foundations', 'pln_kettlebell'])

    expect((await call('GET', '/trainer/plans/pln_barbell')).status).toBe(404)
    const stolen = await call('PATCH', '/trainer/plans/pln_barbell', { version: 1, title: 'Mine now' })
    expect(stolen.status).toBe(404)
    expect((await call('POST', '/trainer/plans/pln_barbell/publish')).status).toBe(404)
  })

  it('refuses to publish an incomplete plan and explains why', async () => {
    const response = await call('POST', '/trainer/plans/pln_kettlebell/publish')
    expect(response.status).toBe(422)
    const messages = (response.body as { details: T.ApiErrorDetail[] }).details.map((d) => d.message).join(' ')
    expect(messages).toContain('has no exercises')

    const page = (await call('GET', '/plans?size=50')).body as T.Page<T.PlanSummary>
    expect(page.items.map((p) => p.id)).not.toContain('pln_kettlebell')
  })

  it('publishes a completed draft, which then appears in the marketplace and locks', async () => {
    const draft = (await call('GET', '/trainer/plans/pln_kettlebell')).body as T.TrainerPlan
    const input = draftInput(draft)
    input.description = 'Four weeks of kettlebell swings, carries and conditioning circuits.'
    input.price = { amount: '299', currency: 'ZAR' }
    input.weeks[0].workouts[0].exercises = [
      { exerciseId: 'ex_kb_swing', prescribedSets: 5, prescribedReps: 15, restSeconds: 60, instructions: '' },
    ]

    const saved = await call('PATCH', '/trainer/plans/pln_kettlebell', input)
    expect(saved.status).toBe(200)
    expect((saved.body as T.TrainerPlan).price.amount).toBe('299.00')

    expect((await call('POST', '/trainer/plans/pln_kettlebell/publish')).status).toBe(200)
    const page = (await call('GET', '/plans?size=50')).body as T.Page<T.PlanSummary>
    expect(page.items.map((p) => p.id)).toContain('pln_kettlebell')

    const edit = await call('PATCH', '/trainer/plans/pln_kettlebell', { ...input, version: 3 })
    expect(edit.status).toBe(409)
  })

  it('rejects a save based on a stale version', async () => {
    const draft = (await call('GET', '/trainer/plans/pln_kettlebell')).body as T.TrainerPlan
    expect((await call('PATCH', '/trainer/plans/pln_kettlebell', draftInput(draft))).status).toBe(200)
    const stale = await call('PATCH', '/trainer/plans/pln_kettlebell', draftInput(draft))
    expect(stale.status).toBe(409)
    expect((stale.body as { code: string }).code).toBe('VERSION_CONFLICT')
  })

  it('does not let a trainee use trainer endpoints', async () => {
    await login(DEMO_TRAINEE_EMAIL)
    expect((await call('GET', '/trainer/plans')).status).toBe(403)
    expect((await call('POST', '/trainer/plans', { title: 'Sneaky plan' })).status).toBe(403)
  })
})
