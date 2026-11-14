import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { getMockPurchase, simulateProviderOutcome } from '../../services/mock/server'
import { formatMoney } from '../../utils/money'

/**
 * Mock mode only. Stands in for the payment provider's hosted checkout page so the
 * pay-and-return journey can be walked through without a provider account. In a
 * real deployment this route does not exist and the browser leaves the site instead.
 */
export default function MockCheckoutPage() {
  const [params] = useSearchParams()
  const purchaseId = params.get('purchase') ?? ''
  const [purchase] = useState(() => getMockPurchase(purchaseId))
  const [leaving, setLeaving] = useState(false)

  const finish = (outcome: 'PAID' | 'FAILED' | 'CANCELLED') => {
    setLeaving(true)
    // The "provider" confirms to the backend a few seconds later, like a webhook.
    simulateProviderOutcome(purchaseId, outcome)
    window.location.assign(`/checkout/return?purchase=${encodeURIComponent(purchaseId)}`)
  }

  return (
    <div className="provider">
      <main className="provider-card">
        <p className="provider-tag">Simulated payment provider · sandbox</p>
        {purchase ? (
          <>
            <h1>Pay {formatMoney(purchase.amount)}</h1>
            <p>{purchase.planTitle}</p>
            <p className="hint">
              No card details are collected and no money moves. Pick an outcome to see how the app handles it.
            </p>
            <div className="stack">
              <button type="button" className="btn btn-accent btn-block" disabled={leaving} onClick={() => finish('PAID')}>
                Pay (simulate success)
              </button>
              <button type="button" className="btn btn-ghost btn-block" disabled={leaving} onClick={() => finish('FAILED')}>
                Simulate a declined card
              </button>
              <button type="button" className="btn btn-ghost btn-block" disabled={leaving} onClick={() => finish('CANCELLED')}>
                Cancel and return
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Checkout not found</h1>
            <p>This sandbox checkout link is no longer valid.</p>
            <a className="btn btn-primary btn-block" href="/">Back to the marketplace</a>
          </>
        )}
      </main>
    </div>
  )
}
