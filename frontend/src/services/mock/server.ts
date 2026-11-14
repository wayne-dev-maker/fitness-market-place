import { validatePlanForPublish } from '../../features/trainer/validatePlan'
import { addDays, todayISO, weekStartISO } from '../../utils/dates'
import { isValidAmount } from '../../utils/money'
import type * as T from '../types'
import {
  createSeed,
  enrolmentStartDay,
  type Db,
  type StoredEnrolment,
  type StoredLog,
  type StoredPlan,
  type StoredPurchase,
  type StoredUser,
} from './seed'

/**
 * In-browser stand-in for the Spring Boot API, used only when VITE_API_MOCK=true.
 *
 * It implements the /api/v1 contract closely enough to exercise every screen,
 * including the rules the real backend must enforce (ownership, enrolment-gated
 * content, purchase != enrolment, idempotent confirmation). It is a development
 * aid, not a security boundary and not evidence that the real backend works.
 */

const STORAGE_KEY = 'fm-mock-db-v1'
const IS_TEST = import.meta.env.MODE === 'test'
const LATENCY_MS = IS_TEST ? 0 : 280
/** How long the simulated provider takes to deliver its confirmation webhook. */
const SETTLE_DELAY_MS = IS_TEST ? 0 : 3500

export interface MockResponse {
  status: number
  body: unknown
}

interface Context {
  db: Db
  params: string[]
  query: URLSearchParams
  body: Record<string, unknown>
}

type Handler = (ctx: Context) => MockResponse

class MockHttpError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, code: string, message: string, details: T.ApiErrorDetail[]) {
    super(message)
    this.status = status
    this.body = { code, message, details, traceId: `mock-${Math.random().toString(36).slice(2, 10)}` }
  }
}

function fail(status: number, code: string, message: string, details: T.ApiErrorDetail[] = []): never {
  throw new MockHttpError(status, code, message, details)
}

const ok = (body: unknown, status = 200): MockResponse => ({ status, body })

// ---- Persistence ------------------------------------------------------------
// sessionStorage keeps the demo state across the full-page redirect to the
// simulated payment page. Nothing here is an authentication token.

let memory: Db | null = null

function load(): Db {
  if (memory) return memory
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      memory = JSON.parse(raw) as Db
      return memory
    }
  } catch {
    // Storage unavailable or corrupt: fall through to a fresh seed.
  }
  memory = createSeed()
  return memory
}

function save(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // The mock still works for this page view without persistence.
  }
}

export function resetMockDb(): void {
  memory = createSeed()
  save()
}

// ---- Helpers ----------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

function nextId(db: Db, prefix: string): string {
  db.seq += 1
  return `${prefix}_${db.seq.toString(36)}`
}

function currentUser(db: Db): StoredUser {
  const user = db.users.find((u) => u.id === db.sessionUserId)
  if (!user) fail(401, 'UNAUTHENTICATED', 'Please log in to continue.')
  return user
}

function requireRole(db: Db, role: T.Role): StoredUser {
  const user = currentUser(db)
  if (user.role !== role) fail(403, 'FORBIDDEN', 'Your account cannot do this.')
  return user
}

function publicUser(user: StoredUser): T.User {
  return { id: user.id, email: user.email, role: user.role, displayName: user.displayName, imageUrl: user.imageUrl }
}

function displayName(db: Db, userId: string): string {
  return db.users.find((u) => u.id === userId)?.displayName ?? 'Unknown'
}

function toSummary(db: Db, plan: StoredPlan): T.PlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    difficulty: plan.difficulty,
    durationWeeks: plan.weeks.length,
    workoutsPerWeek: plan.weeks[0]?.workouts.length ?? 0,
    price: plan.price,
    billingType: plan.billingType,
    trainer: { id: plan.trainerId, displayName: displayName(db, plan.trainerId), imageUrl: null },
  }
}

function enrolmentStatus(enrolment: StoredEnrolment): T.EnrolmentStatus {
  return enrolment.expiresAt && new Date(enrolment.expiresAt).getTime() < Date.now() ? 'EXPIRED' : 'ACTIVE'
}

function toTrainerPlan(db: Db, plan: StoredPlan): T.TrainerPlan {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    difficulty: plan.difficulty,
    durationWeeks: plan.weeks.length,
    price: plan.price,
    billingType: plan.billingType,
    status: plan.status,
    version: plan.version,
    weeks: plan.weeks,
    enrolmentCount: db.enrolments.filter((e) => e.planId === plan.id && enrolmentStatus(e) === 'ACTIVE').length,
    updatedAt: plan.updatedAt,
  }
}

function planOf(db: Db, planId: string): StoredPlan {
  const plan = db.plans.find((p) => p.id === planId)
  if (!plan) fail(404, 'NOT_FOUND', 'That plan does not exist.')
  return plan
}

/** A trainer's own plan. Other trainers' plans are reported as not found, not forbidden. */
function ownPlan(db: Db, trainer: StoredUser, planId: string): StoredPlan {
  const plan = db.plans.find((p) => p.id === planId && p.trainerId === trainer.id)
  if (!plan) fail(404, 'NOT_FOUND', 'That plan does not exist.')
  return plan
}

function schedule(db: Db, enrolment: StoredEnrolment): T.ScheduledWorkout[] {
  const plan = planOf(db, enrolment.planId)
  const startDay = enrolmentStartDay(enrolment)
  return plan.weeks.flatMap((week) =>
    week.workouts.map((workout) => ({
      enrolmentId: enrolment.id,
      planId: plan.id,
      planTitle: plan.title,
      workoutId: workout.id,
      title: workout.title,
      weekNumber: week.weekNumber,
      dayNumber: workout.dayNumber,
      scheduledDate: addDays(startDay, (week.weekNumber - 1) * 7 + workout.dayNumber - 1),
      durationMinutes: workout.durationMinutes,
      exerciseCount: workout.exercises.length,
      completedLogId: db.logs.find((l) => l.enrolmentId === enrolment.id && l.workoutId === workout.id)?.id ?? null,
    })),
  )
}

function toEnrolment(db: Db, enrolment: StoredEnrolment): T.Enrolment {
  const plan = planOf(db, enrolment.planId)
  const items = schedule(db, enrolment)
  return {
    id: enrolment.id,
    planId: plan.id,
    planTitle: plan.title,
    trainerName: displayName(db, plan.trainerId),
    status: enrolmentStatus(enrolment),
    startedAt: enrolment.startedAt,
    expiresAt: enrolment.expiresAt,
    completedWorkouts: items.filter((i) => i.completedLogId).length,
    totalWorkouts: items.length,
  }
}

/** Enrolment gate for paid workout content. Runs on every workout read and write. */
function workoutAccess(db: Db, user: StoredUser, workoutId: string) {
  for (const plan of db.plans) {
    for (const week of plan.weeks) {
      const workout = week.workouts.find((w) => w.id === workoutId)
      if (!workout) continue
      const enrolment = db.enrolments.find((e) => e.userId === user.id && e.planId === plan.id)
      if (!enrolment) fail(403, 'NO_ACCESS', 'You need to buy this programme to open its workouts.')
      if (enrolmentStatus(enrolment) === 'EXPIRED') {
        fail(403, 'ACCESS_EXPIRED', 'Your access to this programme has ended.')
      }
      return { plan, week, workout, enrolment }
    }
  }
  return fail(404, 'NOT_FOUND', 'That workout does not exist.')
}

function toLog(db: Db, log: StoredLog): T.WorkoutLog {
  const plan = db.plans.find((p) => p.id === log.planId)
  const workout = plan?.weeks.flatMap((w) => w.workouts).find((w) => w.id === log.workoutId)
  return {
    id: log.id,
    workoutId: log.workoutId,
    workoutTitle: workout?.title ?? 'Workout',
    planId: log.planId,
    planTitle: plan?.title ?? 'Programme',
    completedAt: log.completedAt,
    durationMinutes: log.durationMinutes,
    notes: log.notes,
    setsCompleted: log.sets.filter((s) => s.completed).length,
    totalSets: log.sets.length,
  }
}

function toPurchase(db: Db, purchase: StoredPurchase): T.Purchase {
  return {
    id: purchase.id,
    planId: purchase.planId,
    planTitle: db.plans.find((p) => p.id === purchase.planId)?.title ?? 'Programme',
    amount: purchase.amount,
    status: purchase.status,
    createdAt: purchase.createdAt,
  }
}

/**
 * Applies simulated provider confirmations that are due. This is the only place an
 * enrolment is created from a purchase, and it is idempotent: a purchase that has
 * already left PENDING is skipped, and one purchase can only ever own one enrolment.
 */
function settlePurchases(db: Db): void {
  for (const purchase of db.purchases) {
    if (purchase.status !== 'PENDING' || !purchase.settleAs || purchase.settleAt === null) continue
    if (purchase.settleAt > Date.now()) continue
    purchase.status = purchase.settleAs
    purchase.settleAs = null
    purchase.settleAt = null
    if (purchase.status === 'PAID' && !db.enrolments.some((e) => e.purchaseId === purchase.id)) {
      db.enrolments.push({
        id: nextId(db, 'enr'),
        userId: purchase.userId,
        planId: purchase.planId,
        purchaseId: purchase.id,
        startedAt: new Date().toISOString(),
        expiresAt: null,
      })
    }
  }
}

function normaliseWeeks(db: Db, weeks: unknown, details: T.ApiErrorDetail[]): T.PlanWeek[] {
  if (!Array.isArray(weeks) || weeks.length > 52) {
    details.push({ field: 'weeks', message: 'A plan can have at most 52 weeks.' })
    return []
  }
  const keepId = (id: unknown, prefix: string) =>
    typeof id === 'string' && id && !id.startsWith('new-') ? id : nextId(db, prefix)

  return (weeks as T.PlanWeekInput[]).map((week, wi) => ({
    id: keepId(week.id, 'wk'),
    weekNumber: wi + 1,
    workouts: (Array.isArray(week.workouts) ? week.workouts : []).map((workout, oi) => {
      const where = `weeks[${wi}].workouts[${oi}]`
      if (!isInt(workout.dayNumber, 1, 7)) details.push({ field: `${where}.dayNumber`, message: 'Day must be between 1 and 7.' })
      if (!isInt(workout.durationMinutes, 5, 300)) {
        details.push({ field: `${where}.durationMinutes`, message: 'Duration must be 5–300 minutes.' })
      }
      return {
        id: keepId(workout.id, 'wo'),
        title: str(workout.title).slice(0, 120),
        dayNumber: workout.dayNumber,
        durationMinutes: workout.durationMinutes,
        description: str(workout.description).slice(0, 1000),
        exercises: (Array.isArray(workout.exercises) ? workout.exercises : []).map((exercise, ei) => {
          const exWhere = `${where}.exercises[${ei}]`
          const library = db.exercises.find((e) => e.id === exercise.exerciseId)
          if (!library) details.push({ field: `${exWhere}.exerciseId`, message: 'Choose an exercise from the library.' })
          if (!isInt(exercise.prescribedSets, 1, 20)) details.push({ field: `${exWhere}.prescribedSets`, message: 'Sets must be 1–20.' })
          if (!isInt(exercise.prescribedReps, 1, 200)) details.push({ field: `${exWhere}.prescribedReps`, message: 'Reps must be 1–200.' })
          if (!isInt(exercise.restSeconds, 0, 900)) details.push({ field: `${exWhere}.restSeconds`, message: 'Rest must be 0–900 seconds.' })
          return {
            id: keepId(exercise.id, 'we'),
            exerciseId: exercise.exerciseId,
            exerciseName: library?.name ?? '',
            position: ei + 1,
            prescribedSets: exercise.prescribedSets,
            prescribedReps: exercise.prescribedReps,
            restSeconds: exercise.restSeconds,
            instructions: str(exercise.instructions).slice(0, 500),
          }
        }),
      }
    }),
  }))
}

const DIFFICULTIES: T.Difficulty[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

// ---- Routes -----------------------------------------------------------------

const routes: { method: string; pattern: RegExp; handler: Handler }[] = []

function route(method: string, path: string, handler: Handler): void {
  const pattern = new RegExp(`^${path.replace(/:[a-zA-Z]+/g, '([^/]+)')}$`)
  routes.push({ method, pattern, handler })
}

// Identity

route('POST', '/auth/register', ({ db, body }) => {
  const displayNameInput = str(body.displayName)
  const email = str(body.email).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const details: T.ApiErrorDetail[] = []
  if (displayNameInput.length < 2 || displayNameInput.length > 60) {
    details.push({ field: 'displayName', message: 'Enter a name between 2 and 60 characters.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) details.push({ field: 'email', message: 'Enter a valid email address.' })
  if (password.length < 10) details.push({ field: 'password', message: 'Use at least 10 characters.' })
  if (details.length) fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', details)
  if (db.users.some((u) => u.email === email)) {
    fail(409, 'EMAIL_TAKEN', 'An account with that email already exists. Try logging in instead.')
  }
  // Role is never read from the request: every self-registration is a trainee.
  const user: StoredUser = {
    id: nextId(db, 'usr'), email, role: 'TRAINEE', displayName: displayNameInput, imageUrl: null, password,
  }
  db.users.push(user)
  db.sessionUserId = user.id
  return ok(publicUser(user), 201)
})

route('POST', '/auth/login', ({ db, body }) => {
  const email = str(body.email).toLowerCase()
  const user = db.users.find((u) => u.email === email && u.password === body.password)
  if (!user) fail(401, 'INVALID_CREDENTIALS', 'That email and password do not match an account.')
  db.sessionUserId = user.id
  return ok(publicUser(user))
})

route('POST', '/auth/logout', ({ db }) => {
  db.sessionUserId = null
  return ok(null, 204)
})

route('GET', '/users/me', ({ db }) => ok(publicUser(currentUser(db))))

// Marketplace

route('GET', '/plans', ({ db, query }) => {
  const search = (query.get('search') ?? '').trim().toLowerCase()
  const difficulty = query.get('difficulty')
  const maxWeeks = Number(query.get('maxWeeks')) || null
  const sort = query.get('sort') ?? 'featured'
  const size = Math.min(Math.max(Number(query.get('size')) || 12, 1), 50)
  const page = Math.max(Number(query.get('page')) || 1, 1)

  let items = db.plans.filter((p) => p.status === 'PUBLISHED').map((p) => toSummary(db, p))
  if (search) {
    items = items.filter((p) =>
      [p.title, p.description, p.trainer.displayName].some((text) => text.toLowerCase().includes(search)),
    )
  }
  if (difficulty) items = items.filter((p) => p.difficulty === difficulty)
  if (maxWeeks) items = items.filter((p) => p.durationWeeks <= maxWeeks)
  if (sort === 'price_asc') items.sort((a, b) => Number(a.price.amount) - Number(b.price.amount))
  if (sort === 'price_desc') items.sort((a, b) => Number(b.price.amount) - Number(a.price.amount))
  if (sort === 'duration_asc') items.sort((a, b) => a.durationWeeks - b.durationWeeks)

  const result: T.Page<T.PlanSummary> = {
    items: items.slice((page - 1) * size, page * size),
    page,
    size,
    totalItems: items.length,
    totalPages: Math.max(Math.ceil(items.length / size), 1),
  }
  return ok(result)
})

route('GET', '/plans/:id', ({ db, params }) => {
  const plan = db.plans.find((p) => p.id === params[0] && p.status === 'PUBLISHED')
  if (!plan) fail(404, 'NOT_FOUND', 'That plan does not exist or is no longer available.')
  const detail: T.PlanDetail = {
    ...toSummary(db, plan),
    outline: plan.weeks.map((week) => ({
      weekNumber: week.weekNumber,
      workouts: week.workouts.map((w) => ({
        title: w.title, dayNumber: w.dayNumber, durationMinutes: w.durationMinutes, exerciseCount: w.exercises.length,
      })),
    })),
  }
  return ok(detail)
})

// Trainer authoring

route('GET', '/exercises', ({ db }) => {
  currentUser(db)
  return ok(db.exercises)
})

route('GET', '/trainer/plans', ({ db }) => {
  const trainer = requireRole(db, 'TRAINER')
  return ok(db.plans.filter((p) => p.trainerId === trainer.id).map((p) => toTrainerPlan(db, p)))
})

route('POST', '/trainer/plans', ({ db, body }) => {
  const trainer = requireRole(db, 'TRAINER')
  const title = str(body.title)
  if (title.length < 3 || title.length > 120) {
    fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', [
      { field: 'title', message: 'Enter a title between 3 and 120 characters.' },
    ])
  }
  const plan: StoredPlan = {
    id: nextId(db, 'pln'), trainerId: trainer.id, title, description: '', difficulty: 'BEGINNER',
    price: { amount: '0.00', currency: 'ZAR' }, billingType: 'ONE_TIME', status: 'DRAFT', version: 1,
    weeks: [], updatedAt: new Date().toISOString(),
  }
  db.plans.push(plan)
  return ok(toTrainerPlan(db, plan), 201)
})

route('GET', '/trainer/plans/:id', ({ db, params }) => {
  const trainer = requireRole(db, 'TRAINER')
  return ok(toTrainerPlan(db, ownPlan(db, trainer, params[0])))
})

route('PATCH', '/trainer/plans/:id', ({ db, params, body }) => {
  const trainer = requireRole(db, 'TRAINER')
  const plan = ownPlan(db, trainer, params[0])
  if (plan.status !== 'DRAFT') fail(409, 'PLAN_NOT_EDITABLE', 'Published plans cannot be edited.')
  if (body.version !== plan.version) {
    fail(409, 'VERSION_CONFLICT', 'This plan was changed somewhere else. Reload it to continue editing.')
  }

  const details: T.ApiErrorDetail[] = []
  const title = str(body.title)
  const description = str(body.description)
  const price = (body.price ?? {}) as Partial<T.Money>
  if (title.length < 1 || title.length > 120) details.push({ field: 'title', message: 'Enter a title of up to 120 characters.' })
  if (description.length > 2000) details.push({ field: 'description', message: 'Keep the description under 2000 characters.' })
  if (!DIFFICULTIES.includes(body.difficulty as T.Difficulty)) details.push({ field: 'difficulty', message: 'Choose a difficulty.' })
  if (!isValidAmount(price.amount)) details.push({ field: 'price', message: 'Enter a price such as 349 or 349.00.' })
  if (!/^[A-Z]{3}$/.test(str(price.currency))) details.push({ field: 'price', message: 'Choose a currency.' })
  const weeks = normaliseWeeks(db, body.weeks, details)
  if (details.length) fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', details)

  plan.title = title
  plan.description = description
  plan.difficulty = body.difficulty as T.Difficulty
  plan.price = { amount: Number(price.amount).toFixed(2), currency: str(price.currency) }
  plan.weeks = weeks
  plan.version += 1
  plan.updatedAt = new Date().toISOString()
  return ok(toTrainerPlan(db, plan))
})

route('POST', '/trainer/plans/:id/publish', ({ db, params }) => {
  const trainer = requireRole(db, 'TRAINER')
  const plan = ownPlan(db, trainer, params[0])
  if (plan.status !== 'DRAFT') fail(409, 'PLAN_NOT_EDITABLE', 'This plan is already published.')
  const issues = validatePlanForPublish(plan)
  if (issues.length) fail(422, 'PLAN_NOT_PUBLISHABLE', 'This plan is not ready to publish yet.', issues)
  plan.status = 'PUBLISHED'
  plan.version += 1
  plan.updatedAt = new Date().toISOString()
  return ok(toTrainerPlan(db, plan))
})

// Purchase and access

route('POST', '/checkout', ({ db, body }) => {
  const user = requireRole(db, 'TRAINEE')
  const plan = db.plans.find((p) => p.id === body.planId && p.status === 'PUBLISHED')
  if (!plan) fail(404, 'NOT_FOUND', 'That plan does not exist or is no longer available.')
  if (db.enrolments.some((e) => e.userId === user.id && e.planId === plan.id && enrolmentStatus(e) === 'ACTIVE')) {
    fail(409, 'ALREADY_ENROLLED', 'You already have access to this programme.')
  }
  // The amount comes from the stored plan. Any amount sent by the client is ignored.
  const purchase: StoredPurchase = {
    id: nextId(db, 'pur'), userId: user.id, planId: plan.id, amount: plan.price, status: 'PENDING',
    createdAt: new Date().toISOString(), settleAs: null, settleAt: null,
  }
  db.purchases.push(purchase)
  const session: T.CheckoutSession = {
    purchaseId: purchase.id,
    checkoutUrl: `/mock-checkout?purchase=${encodeURIComponent(purchase.id)}`,
  }
  return ok(session, 201)
})

route('GET', '/purchases/:id', ({ db, params }) => {
  const user = currentUser(db)
  const purchase = db.purchases.find((p) => p.id === params[0] && p.userId === user.id)
  if (!purchase) fail(404, 'NOT_FOUND', 'We could not find that purchase.')
  return ok(toPurchase(db, purchase))
})

route('GET', '/enrolments/me', ({ db }) => {
  const user = requireRole(db, 'TRAINEE')
  return ok(db.enrolments.filter((e) => e.userId === user.id).map((e) => toEnrolment(db, e)))
})

route('GET', '/enrolments/:id/schedule', ({ db, params }) => {
  const user = requireRole(db, 'TRAINEE')
  const enrolment = db.enrolments.find((e) => e.id === params[0] && e.userId === user.id)
  if (!enrolment) fail(404, 'NOT_FOUND', 'We could not find that programme.')
  return ok(schedule(db, enrolment))
})

// Training

route('GET', '/workouts/today', ({ db }) => {
  const user = requireRole(db, 'TRAINEE')
  const today = todayISO()
  const due = db.enrolments
    .filter((e) => e.userId === user.id && enrolmentStatus(e) === 'ACTIVE')
    .flatMap((e) => schedule(db, e))
    .filter((item) => item.scheduledDate === today)
  return ok(due)
})

route('GET', '/workouts/:id', ({ db, params }) => {
  const user = requireRole(db, 'TRAINEE')
  const { plan, week, workout, enrolment } = workoutAccess(db, user, params[0])
  const session: T.WorkoutSession = {
    enrolmentId: enrolment.id,
    planId: plan.id,
    planTitle: plan.title,
    weekNumber: week.weekNumber,
    scheduledDate: addDays(enrolmentStartDay(enrolment), (week.weekNumber - 1) * 7 + workout.dayNumber - 1),
    workout,
    completedLogId: db.logs.find((l) => l.enrolmentId === enrolment.id && l.workoutId === workout.id)?.id ?? null,
  }
  return ok(session)
})

route('POST', '/workout-logs', ({ db, body }) => {
  const user = requireRole(db, 'TRAINEE')
  const input = body as unknown as T.WorkoutLogInput
  const requestId = str(input.clientRequestId)
  if (!requestId) fail(422, 'VALIDATION_ERROR', 'Missing request id.', [{ field: 'clientRequestId', message: 'Required.' }])

  // A retry of the same submission returns the log that was already stored.
  const replay = db.logs.find((l) => l.userId === user.id && l.clientRequestId === requestId)
  if (replay) return ok(toLog(db, replay))

  const { plan, workout, enrolment } = workoutAccess(db, user, str(input.workoutId))
  if (db.logs.some((l) => l.enrolmentId === enrolment.id && l.workoutId === workout.id)) {
    fail(409, 'ALREADY_LOGGED', 'This workout has already been logged.')
  }

  const details: T.ApiErrorDetail[] = []
  const sets = Array.isArray(input.sets) ? input.sets : []
  if (sets.length === 0) details.push({ field: 'sets', message: 'Log at least one set.' })
  sets.forEach((set, i) => {
    const where = `sets[${i}]`
    if (!workout.exercises.some((e) => e.id === set.workoutExerciseId)) {
      details.push({ field: `${where}.workoutExerciseId`, message: 'That exercise is not part of this workout.' })
    }
    if (!isInt(set.setNumber, 1, 50)) details.push({ field: `${where}.setNumber`, message: 'Invalid set number.' })
    if (!isInt(set.repsCompleted, 0, 500)) details.push({ field: `${where}.repsCompleted`, message: 'Reps must be 0–500.' })
    if (set.weightKg !== null && !(typeof set.weightKg === 'number' && set.weightKg >= 0 && set.weightKg <= 1000)) {
      details.push({ field: `${where}.weightKg`, message: 'Weight must be 0–1000 kg.' })
    }
  })
  if (input.durationMinutes !== null && !isInt(input.durationMinutes, 1, 600)) {
    details.push({ field: 'durationMinutes', message: 'Duration must be 1–600 minutes.' })
  }
  const notes = str(input.notes)
  if (notes.length > 1000) details.push({ field: 'notes', message: 'Keep notes under 1000 characters.' })
  if (details.length) fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', details)

  const log: StoredLog = {
    id: nextId(db, 'log'), clientRequestId: requestId, userId: user.id, enrolmentId: enrolment.id, planId: plan.id,
    workoutId: workout.id, completedAt: new Date().toISOString(), durationMinutes: input.durationMinutes, notes,
    sets: sets.map((s) => ({
      workoutExerciseId: s.workoutExerciseId, setNumber: s.setNumber, repsCompleted: s.repsCompleted,
      weightKg: s.weightKg, completed: Boolean(s.completed),
    })),
  }
  db.logs.push(log)
  return ok(toLog(db, log), 201)
})

route('GET', '/progress/me', ({ db }) => {
  const user = requireRole(db, 'TRAINEE')
  const logs = db.logs
    .filter((l) => l.userId === user.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))

  const thisWeek = weekStartISO(new Date())
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const weekStart = addDays(thisWeek, (i - 7) * 7)
    return { weekStart, workouts: logs.filter((l) => weekStartISO(new Date(l.completedAt)) === weekStart).length }
  })

  const summary: T.ProgressSummary = {
    totalWorkouts: logs.length,
    weekly,
    recentLogs: logs.slice(0, 20).map((l) => toLog(db, l)),
    weights: db.weights
      .filter((w) => w.userId === user.id)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((w) => ({ id: w.id, weightKg: w.weightKg, recordedAt: w.recordedAt })),
  }
  return ok(summary)
})

route('POST', '/progress/weight', ({ db, body }) => {
  const user = requireRole(db, 'TRAINEE')
  const weightKg = body.weightKg
  if (typeof weightKg !== 'number' || !(weightKg >= 20 && weightKg <= 400)) {
    fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', [
      { field: 'weightKg', message: 'Enter a weight between 20 and 400 kg.' },
    ])
  }
  const entry = { id: nextId(db, 'bm'), userId: user.id, weightKg: Math.round(weightKg * 10) / 10, recordedAt: new Date().toISOString() }
  db.weights.push(entry)
  return ok({ id: entry.id, weightKg: entry.weightKg, recordedAt: entry.recordedAt }, 201)
})

// P1: check-ins

function requirePlanParticipant(db: Db, user: StoredUser, planId: string): void {
  planOf(db, planId)
  if (!db.enrolments.some((e) => e.userId === user.id && e.planId === planId)) {
    fail(403, 'NO_ACCESS', 'Check-ins are only visible to people on this programme.')
  }
}

function toCheckin(db: Db, viewer: StoredUser, checkin: Db['checkins'][number]): T.Checkin {
  const log = db.logs.find((l) => l.id === checkin.workoutLogId)
  return {
    id: checkin.id,
    authorName: displayName(db, checkin.userId),
    workoutTitle: log ? toLog(db, log).workoutTitle : 'Workout',
    message: checkin.message,
    createdAt: checkin.createdAt,
    mine: checkin.userId === viewer.id,
  }
}

route('GET', '/plans/:id/checkins', ({ db, params }) => {
  const user = requireRole(db, 'TRAINEE')
  requirePlanParticipant(db, user, params[0])
  const items = db.checkins
    .filter((c) => c.planId === params[0])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => toCheckin(db, user, c))
  return ok(items)
})

route('POST', '/plans/:id/checkins', ({ db, params, body }) => {
  const user = requireRole(db, 'TRAINEE')
  requirePlanParticipant(db, user, params[0])
  // The check-in must hang off the caller's own completed workout on this plan.
  const log = db.logs.find((l) => l.id === body.workoutLogId && l.userId === user.id && l.planId === params[0])
  if (!log) fail(403, 'FORBIDDEN', 'You can only check in on your own completed workouts.')
  const message = str(body.message)
  if (message.length < 1 || message.length > 280) {
    fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', [
      { field: 'message', message: 'Write between 1 and 280 characters.' },
    ])
  }
  if (db.checkins.some((c) => c.workoutLogId === log.id)) {
    fail(409, 'ALREADY_CHECKED_IN', 'You have already checked in for this workout.')
  }
  const checkin = {
    id: nextId(db, 'chk'), userId: user.id, planId: params[0], workoutLogId: log.id, message,
    createdAt: new Date().toISOString(),
  }
  db.checkins.push(checkin)
  return ok(toCheckin(db, user, checkin), 201)
})

// P1: constrained adaptation. The real backend asks an LLM for structured JSON and
// then validates it deterministically; this mock produces the same shape with fixed
// rules so the review screen can be built. Nothing here mutates the authored plan.

route('POST', '/assistant/adapt', ({ db, body }) => {
  const user = requireRole(db, 'TRAINEE')
  const { workout } = workoutAccess(db, user, str(body.workoutId))
  const minutes = body.minutesAvailable
  if (!isInt(minutes, 5, 300)) {
    fail(422, 'VALIDATION_ERROR', 'Some of the details need another look.', [
      { field: 'minutesAvailable', message: 'Enter the time you have, between 5 and 300 minutes.' },
    ])
  }
  const available = new Set(['None', ...(Array.isArray(body.equipment) ? (body.equipment as unknown[]).map(str) : [])])
  const shorter = minutes < workout.durationMinutes
  const lowEnergy = body.energy === 'LOW'

  const exercises: T.AdaptedExercise[] = workout.exercises.map((prescribed) => {
    const original = db.exercises.find((e) => e.id === prescribed.exerciseId)
    let name = prescribed.exerciseName
    let change: T.AdaptedExercise['change'] = 'UNCHANGED'
    const notes: string[] = []

    if (original && !available.has(original.equipment)) {
      // Prefer a no-equipment movement over swapping to a different, possibly heavier, implement.
      const sameGroup = db.exercises.filter((e) => e.muscleGroup === original.muscleGroup)
      const swap = sameGroup.find((e) => e.equipment === 'None') ?? sameGroup.find((e) => available.has(e.equipment))
      if (!swap) {
        return {
          workoutExerciseId: prescribed.id, exerciseName: name, originalExerciseName: name, sets: 0,
          reps: prescribed.prescribedReps, restSeconds: prescribed.restSeconds, change: 'REMOVED' as const,
          note: `Needs ${original.equipment.toLowerCase()}, and there is no suitable swap with what you have today.`,
        }
      }
      name = swap.name
      change = 'SUBSTITUTED'
      notes.push(`Swapped because ${original.equipment.toLowerCase()} is not available.`)
    }

    let sets = prescribed.prescribedSets
    if ((shorter || lowEnergy) && sets > 1) {
      sets -= shorter && lowEnergy && sets > 2 ? 2 : 1
      if (change === 'UNCHANGED') change = 'REDUCED'
      notes.push(`${prescribed.prescribedSets - sets} fewer set${prescribed.prescribedSets - sets === 1 ? '' : 's'}.`)
    }
    return {
      workoutExerciseId: prescribed.id, exerciseName: name, originalExerciseName: prescribed.exerciseName, sets,
      reps: prescribed.prescribedReps, restSeconds: prescribed.restSeconds, change, note: notes.join(' '),
    }
  })

  const changed = exercises.some((e) => e.change !== 'UNCHANGED')
  const proposal: T.AdaptationProposal = {
    id: nextId(db, 'adp'),
    workoutId: workout.id,
    explanation: changed
      ? 'A lighter version of today’s session that keeps the same movements wherever possible. Loads and repetitions are never increased.'
      : 'Today’s session already fits the time and equipment you have, so no changes are suggested.',
    exercises,
  }
  db.adaptations.push({ id: proposal.id, userId: user.id, proposal, acceptedAt: null })
  return ok(proposal, 201)
})

route('POST', '/assistant/adaptations/:id/accept', ({ db, params }) => {
  const user = requireRole(db, 'TRAINEE')
  const adaptation = db.adaptations.find((a) => a.id === params[0] && a.userId === user.id)
  if (!adaptation) fail(404, 'NOT_FOUND', 'That suggestion no longer exists.')
  adaptation.acceptedAt ??= new Date().toISOString()
  return ok({ id: adaptation.id, acceptedAt: adaptation.acceptedAt })
})

// ---- Entry points -----------------------------------------------------------

export async function handleMock(method: string, path: string, body?: unknown): Promise<MockResponse> {
  if (LATENCY_MS > 0) await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
  const db = load()
  settlePurchases(db)
  const url = new URL(path, 'http://mock.local')

  for (const candidate of routes) {
    if (candidate.method !== method) continue
    const match = candidate.pattern.exec(url.pathname)
    if (!match) continue
    try {
      const response = candidate.handler({
        db,
        params: match.slice(1).map(decodeURIComponent),
        query: url.searchParams,
        body: body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {},
      })
      save()
      return response
    } catch (error) {
      save()
      if (error instanceof MockHttpError) return { status: error.status, body: error.body }
      throw error
    }
  }
  return { status: 404, body: { code: 'NOT_FOUND', message: `No mock endpoint for ${method} ${url.pathname}.` } }
}

/** What the simulated payment page shows. Mock only. */
export function getMockPurchase(purchaseId: string): T.Purchase | null {
  const db = load()
  const purchase = db.purchases.find((p) => p.id === purchaseId)
  return purchase ? toPurchase(db, purchase) : null
}

/**
 * Simulates the provider's decision and its later server-to-server confirmation.
 * Calling this for a purchase that is no longer PENDING, or calling it twice, has
 * no further effect. Mock only: the real app has no client-side way to confirm payment.
 */
export function simulateProviderOutcome(purchaseId: string, outcome: 'PAID' | 'FAILED' | 'CANCELLED'): void {
  const db = load()
  const purchase = db.purchases.find((p) => p.id === purchaseId)
  if (!purchase || purchase.status !== 'PENDING' || purchase.settleAs) return
  purchase.settleAs = outcome
  purchase.settleAt = Date.now() + SETTLE_DELAY_MS
  save()
}
