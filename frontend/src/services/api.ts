import { isApiError, request } from './http'
import type {
  AdaptationProposal,
  AdaptationRequest,
  Checkin,
  CheckinInput,
  CheckoutSession,
  Enrolment,
  Exercise,
  LoginInput,
  Page,
  PlanDetail,
  PlanDraftInput,
  PlanFilters,
  PlanSummary,
  ProgressSummary,
  Purchase,
  RegisterInput,
  ScheduledWorkout,
  TrainerPlan,
  User,
  WeightEntry,
  WorkoutLog,
  WorkoutLogInput,
  WorkoutSession,
} from './types'

function toQuery(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

const id = encodeURIComponent

// Endpoints marked (proposed) are not in docs/04_API_CONTRACTS.md yet; the screens
// in docs/06_FRONTEND_AND_UX.md cannot be built without them. See docs/09_HANDOFF_LOG.md.
export const api = {
  // Identity
  register: (input: RegisterInput) => request<User>('POST', '/auth/register', input),
  login: (input: LoginInput) => request<User>('POST', '/auth/login', input),
  logout: () => request<null>('POST', '/auth/logout'),
  getMe: () => request<User>('GET', '/users/me'),

  // Marketplace
  listPlans: (filters: PlanFilters) => request<Page<PlanSummary>>('GET', `/plans${toQuery(filters)}`),
  getPlan: (planId: string) => request<PlanDetail>('GET', `/plans/${id(planId)}`),

  // Trainer authoring
  listTrainerPlans: () => request<TrainerPlan[]>('GET', '/trainer/plans'), // (proposed)
  getTrainerPlan: (planId: string) => request<TrainerPlan>('GET', `/trainer/plans/${id(planId)}`), // (proposed)
  createTrainerPlan: (title: string) => request<TrainerPlan>('POST', '/trainer/plans', { title }),
  updateTrainerPlan: (planId: string, input: PlanDraftInput) =>
    request<TrainerPlan>('PATCH', `/trainer/plans/${id(planId)}`, input),
  publishTrainerPlan: (planId: string) => request<TrainerPlan>('POST', `/trainer/plans/${id(planId)}/publish`),
  listExercises: () => request<Exercise[]>('GET', '/exercises'), // (proposed)

  // Purchase and access. The client sends only the plan id: price is server-owned.
  createCheckout: (planId: string) => request<CheckoutSession>('POST', '/checkout', { planId }),
  getPurchase: (purchaseId: string) => request<Purchase>('GET', `/purchases/${id(purchaseId)}`), // (proposed)
  listMyEnrolments: () => request<Enrolment[]>('GET', '/enrolments/me'),
  getSchedule: (enrolmentId: string) =>
    request<ScheduledWorkout[]>('GET', `/enrolments/${id(enrolmentId)}/schedule`), // (proposed)

  // Training
  listTodayWorkouts: () => request<ScheduledWorkout[]>('GET', '/workouts/today'),
  getWorkoutSession: (workoutId: string) => request<WorkoutSession>('GET', `/workouts/${id(workoutId)}`), // (proposed)
  createWorkoutLog: (input: WorkoutLogInput) => request<WorkoutLog>('POST', '/workout-logs', input),
  getProgress: () => request<ProgressSummary>('GET', '/progress/me'),
  recordWeight: (weightKg: number) => request<WeightEntry>('POST', '/progress/weight', { weightKg }),

  // P1
  listCheckins: (planId: string) => request<Checkin[]>('GET', `/plans/${id(planId)}/checkins`),
  createCheckin: (planId: string, input: CheckinInput) =>
    request<Checkin>('POST', `/plans/${id(planId)}/checkins`, input),
  requestAdaptation: (input: AdaptationRequest) => request<AdaptationProposal>('POST', '/assistant/adapt', input),
  acceptAdaptation: (adaptationId: string) =>
    request<{ id: string; acceptedAt: string }>('POST', `/assistant/adaptations/${id(adaptationId)}/accept`), // (proposed)
}

/** Current user, or null when nobody is logged in. */
export async function getMeOrNull(): Promise<User | null> {
  try {
    return await api.getMe()
  } catch (error) {
    if (isApiError(error, 401)) return null
    throw error
  }
}

export const qk = {
  me: ['me'] as const,
  plans: (filters: PlanFilters) => ['plans', filters] as const,
  plan: (planId: string) => ['plan', planId] as const,
  trainerPlans: ['trainer-plans'] as const,
  trainerPlan: (planId: string) => ['trainer-plan', planId] as const,
  exercises: ['exercises'] as const,
  purchase: (purchaseId: string) => ['purchase', purchaseId] as const,
  enrolments: ['enrolments'] as const,
  schedule: (enrolmentId: string) => ['schedule', enrolmentId] as const,
  today: ['workouts-today'] as const,
  workout: (workoutId: string) => ['workout', workoutId] as const,
  progress: ['progress'] as const,
  checkins: (planId: string) => ['checkins', planId] as const,
}
