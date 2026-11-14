import type { ApiErrorDetail, Money, PlanWeekInput } from '../../services/types'
import { isValidAmount } from '../../utils/money'

export interface PublishablePlan {
  title: string
  description: string
  price: Money
  weeks: PlanWeekInput[]
}

const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max

/**
 * Readiness checklist shown in the plan builder before publishing.
 * This is guidance only: the server re-validates and is authoritative.
 */
export function validatePlanForPublish(plan: PublishablePlan): ApiErrorDetail[] {
  const issues: ApiErrorDetail[] = []
  const add = (field: string, message: string) => issues.push({ field, message })

  if (plan.title.trim().length < 3) add('title', 'Give the plan a title of at least 3 characters.')
  if (plan.description.trim().length < 20) {
    add('description', 'Describe the plan in at least 20 characters so trainees know what they are buying.')
  }
  if (!isValidAmount(plan.price.amount)) add('price', 'Enter a price such as 349 or 349.00.')
  if (!/^[A-Z]{3}$/.test(plan.price.currency)) add('price', 'Choose a currency.')
  if (plan.weeks.length === 0) add('weeks', 'Add at least one week.')

  plan.weeks.forEach((week, wi) => {
    const weekLabel = `Week ${wi + 1}`
    if (week.workouts.length === 0) add(`weeks[${wi}]`, `${weekLabel} has no workouts.`)

    const days = new Set<number>()
    week.workouts.forEach((workout, oi) => {
      const where = `weeks[${wi}].workouts[${oi}]`
      const label = `${weekLabel}, ${workout.title.trim() || `workout ${oi + 1}`}`
      if (workout.title.trim().length === 0) add(`${where}.title`, `${weekLabel}, workout ${oi + 1} needs a title.`)
      if (!inRange(workout.dayNumber, 1, 7)) add(`${where}.dayNumber`, `${label}: day must be between 1 and 7.`)
      else if (days.has(workout.dayNumber)) {
        add(`${where}.dayNumber`, `${weekLabel} has two workouts on day ${workout.dayNumber}.`)
      }
      days.add(workout.dayNumber)
      if (!inRange(workout.durationMinutes, 5, 300)) {
        add(`${where}.durationMinutes`, `${label}: duration must be 5–300 minutes.`)
      }
      if (workout.exercises.length === 0) add(`${where}.exercises`, `${label} has no exercises.`)

      workout.exercises.forEach((exercise, ei) => {
        const exWhere = `${where}.exercises[${ei}]`
        if (!exercise.exerciseId) add(`${exWhere}.exerciseId`, `${label}: choose an exercise for row ${ei + 1}.`)
        if (!inRange(exercise.prescribedSets, 1, 20)) add(`${exWhere}.prescribedSets`, `${label}: sets must be 1–20.`)
        if (!inRange(exercise.prescribedReps, 1, 200)) add(`${exWhere}.prescribedReps`, `${label}: reps must be 1–200.`)
        if (!inRange(exercise.restSeconds, 0, 900)) add(`${exWhere}.restSeconds`, `${label}: rest must be 0–900 seconds.`)
      })
    })
  })

  return issues
}
