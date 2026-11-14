import { toISODate } from '../../utils/dates'
import type * as T from '../types'

// Seed data for the in-browser mock backend. Everything here is fictional demo
// content; the accounts and passwords exist only inside the mock.

export interface StoredUser extends T.User {
  password: string
}

export interface StoredPlan {
  id: string
  trainerId: string
  title: string
  description: string
  difficulty: T.Difficulty
  price: T.Money
  billingType: 'ONE_TIME'
  status: T.PlanStatus
  version: number
  weeks: T.PlanWeek[]
  updatedAt: string
}

export interface StoredPurchase {
  id: string
  userId: string
  planId: string
  amount: T.Money
  status: T.PurchaseStatus
  createdAt: string
  /** Simulated provider webhook: outcome and the time it "arrives". */
  settleAs: T.PurchaseStatus | null
  settleAt: number | null
}

export interface StoredEnrolment {
  id: string
  userId: string
  planId: string
  purchaseId: string | null
  startedAt: string
  expiresAt: string | null
}

export interface StoredLog {
  id: string
  clientRequestId: string
  userId: string
  enrolmentId: string
  planId: string
  workoutId: string
  completedAt: string
  durationMinutes: number | null
  notes: string
  sets: T.ExerciseLogInput[]
}

export interface StoredWeight extends T.WeightEntry {
  userId: string
}

export interface StoredCheckin {
  id: string
  userId: string
  planId: string
  workoutLogId: string
  message: string
  createdAt: string
}

export interface StoredAdaptation {
  id: string
  userId: string
  proposal: T.AdaptationProposal
  acceptedAt: string | null
}

export interface Db {
  seq: number
  /** Stands in for the server-side session behind the HttpOnly cookie. */
  sessionUserId: string | null
  users: StoredUser[]
  exercises: T.Exercise[]
  plans: StoredPlan[]
  purchases: StoredPurchase[]
  enrolments: StoredEnrolment[]
  logs: StoredLog[]
  weights: StoredWeight[]
  checkins: StoredCheckin[]
  adaptations: StoredAdaptation[]
}

export const DEMO_PASSWORD = 'demo-pass-123'
export const DEMO_TRAINEE_EMAIL = 'trainee@example.com'
export const DEMO_TRAINER_EMAIL = 'trainer@example.com'

const EXERCISES: T.Exercise[] = [
  { id: 'ex_goblet_squat', name: 'Goblet Squat', muscleGroup: 'Legs', equipment: 'Dumbbells', description: 'Hold one dumbbell at the chest and squat to a comfortable depth.' },
  { id: 'ex_back_squat', name: 'Back Squat', muscleGroup: 'Legs', equipment: 'Barbell', description: 'Bar across the upper back; sit down and back, then stand.' },
  { id: 'ex_bw_squat', name: 'Bodyweight Squat', muscleGroup: 'Legs', equipment: 'None', description: 'Feet shoulder width, sit back and stand tall.' },
  { id: 'ex_lunge', name: 'Walking Lunge', muscleGroup: 'Legs', equipment: 'None', description: 'Step forward into a lunge, alternate legs. Reps are per leg.' },
  { id: 'ex_db_rdl', name: 'Dumbbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Dumbbells', description: 'Hinge at the hips with a flat back, dumbbells close to the legs.' },
  { id: 'ex_bb_rdl', name: 'Barbell Romanian Deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell', description: 'Hinge at the hips with a flat back, bar close to the legs.' },
  { id: 'ex_glute_bridge', name: 'Glute Bridge', muscleGroup: 'Hamstrings', equipment: 'None', description: 'Lie on your back, drive the hips up and pause at the top.' },
  { id: 'ex_pushup', name: 'Push-up', muscleGroup: 'Chest', equipment: 'None', description: 'Hands under shoulders, body in one line. Elevate the hands to make it easier.' },
  { id: 'ex_bench', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', description: 'Lower the bar to mid-chest under control and press.' },
  { id: 'ex_db_bench', name: 'Dumbbell Bench Press', muscleGroup: 'Chest', equipment: 'Dumbbells', description: 'Press two dumbbells from chest level to straight arms.' },
  { id: 'ex_db_press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbells', description: 'Press overhead from shoulder height without arching the back.' },
  { id: 'ex_pike_pushup', name: 'Pike Push-up', muscleGroup: 'Shoulders', equipment: 'None', description: 'Hips high, lower the head between the hands and press.' },
  { id: 'ex_db_row', name: 'Single-arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbells', description: 'One hand supported, pull the dumbbell to the hip. Reps are per arm.' },
  { id: 'ex_bb_row', name: 'Bent-over Row', muscleGroup: 'Back', equipment: 'Barbell', description: 'Hinge forward and pull the bar to the lower ribs.' },
  { id: 'ex_band_row', name: 'Band Row', muscleGroup: 'Back', equipment: 'Resistance band', description: 'Anchor a band at chest height and row with both hands.' },
  { id: 'ex_pullup', name: 'Pull-up', muscleGroup: 'Back', equipment: 'Pull-up bar', description: 'From a dead hang, pull the chin over the bar.' },
  { id: 'ex_superman', name: 'Prone Y Raise', muscleGroup: 'Back', equipment: 'None', description: 'Lie face down and lift the arms into a Y shape, pausing briefly.' },
  { id: 'ex_plank', name: 'Plank', muscleGroup: 'Core', equipment: 'None', description: 'Forearms down, body in a straight line. Reps are seconds held.' },
  { id: 'ex_dead_bug', name: 'Dead Bug', muscleGroup: 'Core', equipment: 'None', description: 'On your back, lower opposite arm and leg while keeping the lower back down.' },
  { id: 'ex_kb_swing', name: 'Kettlebell Swing', muscleGroup: 'Hamstrings', equipment: 'Kettlebell', description: 'Hinge and drive the hips to swing the bell to chest height.' },
]

type ExerciseSpec = [exerciseId: string, sets: number, reps: number, restSeconds: number, instructions?: string]

interface WorkoutSpec {
  title: string
  day: number
  minutes: number
  description: string
  exercises: ExerciseSpec[]
}

function exerciseName(exerciseId: string): string {
  return EXERCISES.find((e) => e.id === exerciseId)?.name ?? 'Exercise'
}

function buildWeeks(planId: string, weekCount: number, specs: WorkoutSpec[]): T.PlanWeek[] {
  return Array.from({ length: weekCount }, (_, index) => {
    const weekNumber = index + 1
    return {
      id: `${planId}_w${weekNumber}`,
      weekNumber,
      workouts: specs.map((spec) => {
        const workoutId = `${planId}_w${weekNumber}_d${spec.day}`
        return {
          id: workoutId,
          title: spec.title,
          dayNumber: spec.day,
          durationMinutes: spec.minutes,
          description: spec.description,
          exercises: spec.exercises.map(([exerciseId, sets, reps, restSeconds, instructions], position) => ({
            id: `${workoutId}_e${position + 1}`,
            exerciseId,
            exerciseName: exerciseName(exerciseId),
            position: position + 1,
            prescribedSets: sets,
            prescribedReps: reps,
            restSeconds,
            instructions: instructions ?? '',
          })),
        }
      }),
    }
  })
}

const FOUNDATIONS: WorkoutSpec[] = [
  {
    title: 'Lower body basics', day: 1, minutes: 40,
    description: 'Learn the squat and hinge patterns with light loads.',
    exercises: [
      ['ex_goblet_squat', 3, 10, 60, 'Pick a weight you could lift 3–4 more times.'],
      ['ex_glute_bridge', 3, 12, 45, 'Pause for one second at the top.'],
      ['ex_lunge', 2, 10, 60],
      ['ex_plank', 3, 30, 30, 'Count is seconds held.'],
    ],
  },
  {
    title: 'Push and core', day: 3, minutes: 35,
    description: 'Pressing strength and trunk control.',
    exercises: [
      ['ex_pushup', 3, 8, 60, 'Elevate your hands on a bench if 8 is too many.'],
      ['ex_db_press', 3, 10, 60],
      ['ex_dead_bug', 3, 10, 30, 'Slow and controlled.'],
    ],
  },
  {
    title: 'Pull and hinge', day: 5, minutes: 40,
    description: 'Upper back work and a loaded hip hinge.',
    exercises: [
      ['ex_db_row', 3, 10, 60],
      ['ex_band_row', 3, 12, 45],
      ['ex_db_rdl', 3, 10, 75, 'Stop when you feel a stretch in the hamstrings.'],
    ],
  },
]

const BODYWEIGHT: WorkoutSpec[] = [
  {
    title: 'Full body A', day: 1, minutes: 25, description: 'No equipment. Move well before moving fast.',
    exercises: [['ex_bw_squat', 3, 12, 45], ['ex_pushup', 3, 8, 45], ['ex_glute_bridge', 3, 12, 30], ['ex_plank', 2, 30, 30, 'Count is seconds held.']],
  },
  {
    title: 'Full body B', day: 3, minutes: 25, description: 'Single-leg work and shoulders.',
    exercises: [['ex_lunge', 3, 8, 45], ['ex_pike_pushup', 3, 6, 60], ['ex_superman', 3, 10, 30], ['ex_dead_bug', 3, 8, 30]],
  },
  {
    title: 'Full body C', day: 5, minutes: 30, description: 'A slightly longer session to close the week.',
    exercises: [['ex_bw_squat', 4, 12, 45], ['ex_pushup', 4, 8, 45], ['ex_superman', 3, 12, 30], ['ex_plank', 3, 30, 30, 'Count is seconds held.']],
  },
]

const BARBELL: WorkoutSpec[] = [
  { title: 'Squat focus', day: 1, minutes: 60, description: 'Heavy squats, then accessories.', exercises: [['ex_back_squat', 5, 5, 150], ['ex_bb_rdl', 3, 8, 120], ['ex_plank', 3, 45, 45, 'Count is seconds held.']] },
  { title: 'Bench focus', day: 2, minutes: 55, description: 'Pressing day.', exercises: [['ex_bench', 5, 5, 150], ['ex_db_press', 3, 8, 90], ['ex_pushup', 2, 15, 60]] },
  { title: 'Pull focus', day: 4, minutes: 55, description: 'Rows and pull-ups.', exercises: [['ex_bb_row', 4, 8, 120], ['ex_pullup', 4, 6, 120], ['ex_db_row', 3, 10, 60]] },
  { title: 'Volume day', day: 6, minutes: 60, description: 'Lighter loads, more repetitions.', exercises: [['ex_back_squat', 3, 10, 120], ['ex_bench', 3, 10, 120], ['ex_bb_row', 3, 10, 90]] },
]

const DUMBBELL: WorkoutSpec[] = [
  { title: 'Upper body', day: 1, minutes: 45, description: 'Chest, shoulders and back with dumbbells.', exercises: [['ex_db_bench', 4, 10, 75], ['ex_db_row', 4, 10, 75], ['ex_db_press', 3, 12, 60]] },
  { title: 'Lower body', day: 3, minutes: 45, description: 'Legs and hamstrings.', exercises: [['ex_goblet_squat', 4, 12, 75], ['ex_db_rdl', 4, 10, 75], ['ex_lunge', 3, 10, 60]] },
  { title: 'Full body', day: 5, minutes: 50, description: 'Everything once more before the weekend.', exercises: [['ex_db_bench', 3, 12, 60], ['ex_goblet_squat', 3, 12, 60], ['ex_db_row', 3, 12, 60], ['ex_dead_bug', 3, 10, 30]] },
]

const PUSH_PULL_LEGS: WorkoutSpec[] = [
  { title: 'Push', day: 1, minutes: 70, description: 'Bench-led pressing session.', exercises: [['ex_bench', 5, 5, 180], ['ex_db_press', 4, 8, 90], ['ex_db_bench', 3, 12, 75], ['ex_pushup', 2, 20, 60]] },
  { title: 'Pull', day: 2, minutes: 70, description: 'Weighted pulling and rows.', exercises: [['ex_pullup', 5, 6, 150], ['ex_bb_row', 4, 8, 120], ['ex_db_row', 3, 12, 60], ['ex_band_row', 2, 20, 45]] },
  { title: 'Legs', day: 4, minutes: 75, description: 'Squat and hinge under load.', exercises: [['ex_back_squat', 5, 5, 180], ['ex_bb_rdl', 4, 8, 120], ['ex_lunge', 3, 12, 75], ['ex_plank', 3, 60, 45, 'Count is seconds held.']] },
  { title: 'Upper volume', day: 6, minutes: 60, description: 'Higher-repetition upper body work.', exercises: [['ex_db_bench', 4, 12, 75], ['ex_pullup', 4, 8, 90], ['ex_db_press', 3, 12, 60]] },
]

const CORE: WorkoutSpec[] = [
  { title: 'Core circuit', day: 1, minutes: 15, description: 'Short and repeatable.', exercises: [['ex_plank', 3, 30, 30, 'Count is seconds held.'], ['ex_dead_bug', 3, 10, 30], ['ex_glute_bridge', 3, 12, 30]] },
  { title: 'Back and hips', day: 4, minutes: 15, description: 'Counter a day of sitting.', exercises: [['ex_superman', 3, 10, 30], ['ex_glute_bridge', 3, 15, 30], ['ex_bw_squat', 2, 15, 30]] },
]

function atLocalTime(date: Date, hours: number, minutes = 0): string {
  const copy = new Date(date)
  copy.setHours(hours, minutes, 0, 0)
  return copy.toISOString()
}

function daysAgo(now: Date, days: number): Date {
  const copy = new Date(now)
  copy.setDate(copy.getDate() - days)
  return copy
}

function fullLog(workout: T.Workout): T.ExerciseLogInput[] {
  return workout.exercises.flatMap((exercise) =>
    Array.from({ length: exercise.prescribedSets }, (_, i) => ({
      workoutExerciseId: exercise.id,
      setNumber: i + 1,
      repsCompleted: exercise.prescribedReps,
      weightKg: null,
      completed: true,
    })),
  )
}

export function createSeed(now: Date = new Date()): Db {
  const stamp = daysAgo(now, 30).toISOString()
  const plan = (
    id: string, trainerId: string, title: string, description: string, difficulty: T.Difficulty,
    amount: string, weeks: T.PlanWeek[], status: T.PlanStatus = 'PUBLISHED',
  ): StoredPlan => ({
    id, trainerId, title, description, difficulty, price: { amount, currency: 'ZAR' },
    billingType: 'ONE_TIME', status, version: 1, weeks, updatedAt: stamp,
  })

  const plans: StoredPlan[] = [
    plan('pln_foundations', 'usr_trainer', 'Foundations Strength',
      'A four-week introduction to strength training. Three sessions a week teach the squat, hinge, push and pull with dumbbells and a resistance band, building to confident, repeatable technique.',
      'BEGINNER', '349.00', buildWeeks('pln_foundations', 4, FOUNDATIONS)),
    plan('pln_bodyweight', 'usr_trainer2', 'Home Bodyweight Reset',
      'Six weeks of full-body sessions that need no equipment and under half an hour. Designed for people returning to training who want a routine that fits around work and family.',
      'BEGINNER', '249.00', buildWeeks('pln_bodyweight', 6, BODYWEIGHT)),
    plan('pln_barbell', 'usr_trainer2', 'Barbell Builder',
      'An eight-week barbell programme built around the squat, bench press and row. Four sessions a week with one higher-volume day. You should already be comfortable with the main lifts.',
      'INTERMEDIATE', '599.00', buildWeeks('pln_barbell', 8, BARBELL)),
    plan('pln_dumbbell', 'usr_trainer', 'Dumbbell-Only Muscle',
      'Six weeks of upper, lower and full-body sessions using only a pair of dumbbells. Suits a home setup or a busy gym where barbells are hard to come by.',
      'INTERMEDIATE', '449.00', buildWeeks('pln_dumbbell', 6, DUMBBELL)),
    plan('pln_ppl', 'usr_trainer2', 'Push Pull Legs — Advanced',
      'A twelve-week push, pull, legs split with a fourth upper-volume day. Written for experienced lifters who recover well from four demanding sessions a week.',
      'ADVANCED', '899.00', buildWeeks('pln_ppl', 12, PUSH_PULL_LEGS)),
    plan('pln_core', 'usr_trainer', 'Core Starter',
      'Two weeks of fifteen-minute sessions for trunk strength and hip mobility. A gentle first programme, or an add-on alongside other training.',
      'BEGINNER', '99.00', buildWeeks('pln_core', 2, CORE)),
    plan('pln_kettlebell', 'usr_trainer', 'Kettlebell Conditioning', 'Work in progress.', 'INTERMEDIATE', '0.00', [
      {
        id: 'pln_kettlebell_w1', weekNumber: 1,
        workouts: [{ id: 'pln_kettlebell_w1_d1', title: 'Swing basics', dayNumber: 1, durationMinutes: 30, description: '', exercises: [] }],
      },
    ], 'DRAFT'),
  ]

  // The demo trainee bought Foundations Strength a week ago: today is week 2, day 1.
  const started = daysAgo(now, 7)
  const foundations = plans[0]
  const [firstWorkout, secondWorkout] = foundations.weeks[0].workouts
  const log = (id: string, workout: T.Workout, completedAt: string, minutes: number, notes: string): StoredLog => ({
    id, clientRequestId: `seed-${id}`, userId: 'usr_trainee', enrolmentId: 'enr_seed', planId: foundations.id,
    workoutId: workout.id, completedAt, durationMinutes: minutes, notes, sets: fullLog(workout),
  })

  return {
    seq: 1000,
    sessionUserId: null,
    users: [
      { id: 'usr_trainee', email: DEMO_TRAINEE_EMAIL, role: 'TRAINEE', displayName: 'Alex Dlamini', imageUrl: null, password: DEMO_PASSWORD },
      { id: 'usr_trainer', email: DEMO_TRAINER_EMAIL, role: 'TRAINER', displayName: 'Thandi Mokoena', imageUrl: null, password: DEMO_PASSWORD },
      { id: 'usr_trainer2', email: 'marcus@example.com', role: 'TRAINER', displayName: 'Marcus Bell', imageUrl: null, password: DEMO_PASSWORD },
      { id: 'usr_trainee2', email: 'sam@example.com', role: 'TRAINEE', displayName: 'Sam Khumalo', imageUrl: null, password: DEMO_PASSWORD },
    ],
    exercises: EXERCISES,
    plans,
    purchases: [
      { id: 'pur_seed', userId: 'usr_trainee', planId: foundations.id, amount: foundations.price, status: 'PAID', createdAt: atLocalTime(started, 7, 55), settleAs: null, settleAt: null },
      { id: 'pur_seed2', userId: 'usr_trainee2', planId: foundations.id, amount: foundations.price, status: 'PAID', createdAt: atLocalTime(daysAgo(now, 12), 9), settleAs: null, settleAt: null },
    ],
    enrolments: [
      { id: 'enr_seed', userId: 'usr_trainee', planId: foundations.id, purchaseId: 'pur_seed', startedAt: atLocalTime(started, 8), expiresAt: null },
      { id: 'enr_seed2', userId: 'usr_trainee2', planId: foundations.id, purchaseId: 'pur_seed2', startedAt: atLocalTime(daysAgo(now, 12), 9), expiresAt: null },
    ],
    logs: [
      log('log_seed1', firstWorkout, atLocalTime(started, 18), 42, 'Goblet squats felt steady.'),
      log('log_seed2', secondWorkout, atLocalTime(daysAgo(now, 5), 18, 30), 33, ''),
      {
        ...log('log_seed3', firstWorkout, atLocalTime(daysAgo(now, 10), 7), 40, ''),
        userId: 'usr_trainee2', enrolmentId: 'enr_seed2',
      },
    ],
    weights: [],
    checkins: [
      { id: 'chk_seed1', userId: 'usr_trainee2', planId: foundations.id, workoutLogId: 'log_seed3', message: 'First session done. The plank holds were tougher than I expected!', createdAt: atLocalTime(daysAgo(now, 10), 7, 45) },
    ],
    adaptations: [],
  }
}

/** Local calendar day an enrolment started on; week 1, day 1 of its schedule. */
export function enrolmentStartDay(enrolment: StoredEnrolment): string {
  return toISODate(new Date(enrolment.startedAt))
}
