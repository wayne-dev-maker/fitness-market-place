// DTO shapes for the /api/v1 contract (docs/04_API_CONTRACTS.md).
// Shapes marked "proposed" are frontend assumptions recorded in docs/09_HANDOFF_LOG.md
// and must be confirmed when the Spring Boot endpoints are implemented.

export type Role = 'TRAINEE' | 'TRAINER' | 'ADMIN'
export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export type PlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type PurchaseStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
export type EnrolmentStatus = 'ACTIVE' | 'EXPIRED'

export interface ApiErrorDetail {
  field?: string
  message: string
}

/** Decimal string amount plus ISO-4217 currency code. */
export interface Money {
  amount: string
  currency: string
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

// ---- Identity -------------------------------------------------------------

export interface User {
  id: string
  email: string
  role: Role
  displayName: string
  imageUrl: string | null
}

export interface RegisterInput {
  displayName: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

// ---- Marketplace ----------------------------------------------------------

export interface TrainerRef {
  id: string
  displayName: string
  imageUrl: string | null
}

export interface PlanSummary {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  durationWeeks: number
  workoutsPerWeek: number
  price: Money
  billingType: 'ONE_TIME'
  trainer: TrainerRef
}

/** Public outline only: exercise prescriptions are paid content and are not included. */
export interface PlanOutlineWeek {
  weekNumber: number
  workouts: { title: string; dayNumber: number; durationMinutes: number; exerciseCount: number }[]
}

export interface PlanDetail extends PlanSummary {
  outline: PlanOutlineWeek[]
}

export type PlanSort = 'featured' | 'price_asc' | 'price_desc' | 'duration_asc'

export interface PlanFilters {
  search?: string
  difficulty?: Difficulty | ''
  maxWeeks?: number | ''
  sort?: PlanSort
  page?: number
  size?: number
}

// ---- Plan authoring -------------------------------------------------------

export interface Exercise {
  id: string
  name: string
  description: string
  muscleGroup: string
  equipment: string
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  position: number
  prescribedSets: number
  prescribedReps: number
  restSeconds: number
  instructions: string
}

export interface Workout {
  id: string
  title: string
  dayNumber: number
  durationMinutes: number
  description: string
  exercises: WorkoutExercise[]
}

export interface PlanWeek {
  id: string
  weekNumber: number
  workouts: Workout[]
}

export interface TrainerPlan {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  durationWeeks: number
  price: Money
  billingType: 'ONE_TIME'
  status: PlanStatus
  /** Optimistic-locking version; echoed back on every update. */
  version: number
  weeks: PlanWeek[]
  enrolmentCount: number
  updatedAt: string
}

export interface WorkoutExerciseInput {
  id?: string
  exerciseId: string
  prescribedSets: number
  prescribedReps: number
  restSeconds: number
  instructions: string
}

export interface WorkoutInput {
  id?: string
  title: string
  dayNumber: number
  durationMinutes: number
  description: string
  exercises: WorkoutExerciseInput[]
}

export interface PlanWeekInput {
  id?: string
  workouts: WorkoutInput[]
}

/** Body of PATCH /trainer/plans/{id}: the whole draft, replaced atomically. */
export interface PlanDraftInput {
  version: number
  title: string
  description: string
  difficulty: Difficulty
  price: Money
  weeks: PlanWeekInput[]
}

// ---- Purchase and access --------------------------------------------------

export interface CheckoutSession {
  purchaseId: string
  /** Hosted payment page owned by the provider. */
  checkoutUrl: string
}

export interface Purchase {
  id: string
  planId: string
  planTitle: string
  amount: Money
  status: PurchaseStatus
  createdAt: string
}

export interface Enrolment {
  id: string
  planId: string
  planTitle: string
  trainerName: string
  status: EnrolmentStatus
  startedAt: string
  expiresAt: string | null
  completedWorkouts: number
  totalWorkouts: number
}

// ---- Training -------------------------------------------------------------

export interface ScheduledWorkout {
  enrolmentId: string
  planId: string
  planTitle: string
  workoutId: string
  title: string
  weekNumber: number
  dayNumber: number
  /** Local calendar day, YYYY-MM-DD. */
  scheduledDate: string
  durationMinutes: number
  exerciseCount: number
  completedLogId: string | null
}

export interface WorkoutSession {
  enrolmentId: string
  planId: string
  planTitle: string
  weekNumber: number
  scheduledDate: string
  workout: Workout
  completedLogId: string | null
}

export interface ExerciseLogInput {
  workoutExerciseId: string
  setNumber: number
  repsCompleted: number
  weightKg: number | null
  completed: boolean
}

export interface WorkoutLogInput {
  /** Client-generated UUID so a retried submission cannot create a second log. */
  clientRequestId: string
  workoutId: string
  durationMinutes: number | null
  notes: string
  sets: ExerciseLogInput[]
}

export interface WorkoutLog {
  id: string
  workoutId: string
  workoutTitle: string
  planId: string
  planTitle: string
  completedAt: string
  durationMinutes: number | null
  notes: string
  setsCompleted: number
  totalSets: number
}

export interface WeightEntry {
  id: string
  weightKg: number
  recordedAt: string
}

export interface ProgressSummary {
  totalWorkouts: number
  weekly: { weekStart: string; workouts: number }[]
  recentLogs: WorkoutLog[]
  weights: WeightEntry[]
}

// ---- P1: accountability and constrained assistant --------------------------

export interface Checkin {
  id: string
  authorName: string
  workoutTitle: string
  message: string
  createdAt: string
  mine: boolean
}

export interface CheckinInput {
  workoutLogId: string
  message: string
}

export type EnergyLevel = 'NORMAL' | 'LOW'

export interface AdaptationRequest {
  workoutId: string
  minutesAvailable: number
  equipment: string[]
  energy: EnergyLevel
}

export interface AdaptedExercise {
  workoutExerciseId: string
  exerciseName: string
  originalExerciseName: string
  sets: number
  reps: number
  restSeconds: number
  change: 'UNCHANGED' | 'SUBSTITUTED' | 'REDUCED' | 'REMOVED'
  note: string
}

export interface AdaptationProposal {
  id: string
  workoutId: string
  explanation: string
  exercises: AdaptedExercise[]
}
