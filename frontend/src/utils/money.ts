import type { Money } from '../services/types'

/**
 * Amounts travel as decimal strings (the backend uses BigDecimal). They are only
 * converted to a number here, for display; the client never does money arithmetic.
 */
export function formatMoney(money: Money, locale?: string): string {
  const value = Number(money.amount)
  if (!Number.isFinite(value)) return `${money.currency} ${money.amount}`
  if (value === 0) return 'Free'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: money.currency }).format(value)
  } catch {
    return `${money.currency} ${money.amount}`
  }
}

/** A non-negative decimal with at most two fraction digits, e.g. "349" or "349.00". */
export function isValidAmount(amount: unknown): amount is string {
  return typeof amount === 'string' && /^\d{1,7}(\.\d{1,2})?$/.test(amount.trim())
}
