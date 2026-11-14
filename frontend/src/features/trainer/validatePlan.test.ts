import { describe, expect, it } from 'vitest'
import { formatMoney, isValidAmount } from '../../utils/money'
import { validatePlanForPublish, type PublishablePlan } from './validatePlan'

function validPlan(): PublishablePlan {
  return {
    title: 'Foundations Strength',
    description: 'A four-week introduction to strength training.',
    price: { amount: '349.00', currency: 'ZAR' },
    weeks: [{
      workouts: [{
        title: 'Lower body', dayNumber: 1, durationMinutes: 40, description: '',
        exercises: [{ exerciseId: 'ex_goblet_squat', prescribedSets: 3, prescribedReps: 10, restSeconds: 60, instructions: '' }],
      }],
    }],
  }
}

describe('validatePlanForPublish', () => {
  it('accepts a complete plan', () => {
    expect(validatePlanForPublish(validPlan())).toEqual([])
  })

  it('requires a title, a real description, a price and at least one week', () => {
    const fields = validatePlanForPublish({
      title: ' ', description: 'Too short', price: { amount: '12.345', currency: 'ZAR' }, weeks: [],
    }).map((issue) => issue.field)
    expect(fields).toEqual(['title', 'description', 'price', 'weeks'])
  })

  it('flags empty weeks, empty workouts and two workouts on the same day', () => {
    const plan = validPlan()
    plan.weeks[0].workouts.push({ title: 'Clash', dayNumber: 1, durationMinutes: 30, description: '', exercises: [] })
    plan.weeks.push({ workouts: [] })

    const messages = validatePlanForPublish(plan).map((issue) => issue.message)
    expect(messages).toContain('Week 1 has two workouts on day 1.')
    expect(messages).toContain('Week 1, Clash has no exercises.')
    expect(messages).toContain('Week 2 has no workouts.')
  })

  it('flags unfinished exercise rows, including cleared number fields', () => {
    const plan = validPlan()
    plan.weeks[0].workouts[0].exercises[0] = {
      exerciseId: '', prescribedSets: Number.NaN, prescribedReps: 0, restSeconds: 5000, instructions: '',
    }
    expect(validatePlanForPublish(plan)).toHaveLength(4)
  })
})

describe('money', () => {
  it('accepts only non-negative amounts with up to two decimals', () => {
    expect(['0', '349', '349.5', '349.00'].every(isValidAmount)).toBe(true)
    expect(['', '-1', '12.345', '1e3', 'abc', ' '].some(isValidAmount)).toBe(false)
    expect(isValidAmount(349)).toBe(false)
  })

  it('formats with the currency and shows zero as free', () => {
    expect(formatMoney({ amount: '349.00', currency: 'ZAR' }, 'en-ZA')).toMatch(/349/)
    expect(formatMoney({ amount: '0.00', currency: 'ZAR' })).toBe('Free')
    expect(formatMoney({ amount: 'oops', currency: 'ZAR' })).toBe('ZAR oops')
  })
})
