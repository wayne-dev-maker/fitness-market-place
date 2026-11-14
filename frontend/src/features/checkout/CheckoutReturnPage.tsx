import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { isApiError } from '../../services/http'
import { formatMoney } from '../../utils/money'

const POLL_MS = 2000
const SLOW_AFTER_MS = 45_000

/**
 * Where the payment provider sends the buyer back to.
 *
 * Arriving here proves nothing: the redirect can be reached without paying. The page
 * only reports what the server says. It polls the purchase until the server has a
 * verified outcome, and shows "unlocked" only once the server also returns the
 * enrolment itself.
 */
export default function CheckoutReturnPage() {
  useTitle('Payment status')
  const [params] = useSearchParams()
  const purchaseId = params.get('purchase') ?? ''
  const queryClient = useQueryClient()

  const purchase = useQuery({
    queryKey: qk.purchase(purchaseId),
    queryFn: () => api.getPurchase(purchaseId),
    enabled: Boolean(purchaseId),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? POLL_MS : false),
  })
  const paid = purchase.data?.status === 'PAID'
  const planId = purchase.data?.planId

  // Separate, always-fresh read of access: a cached "no enrolments" answer must not be trusted here.
  const access = useQuery({
    queryKey: ['enrolments', 'verify', purchaseId],
    queryFn: api.listMyEnrolments,
    enabled: paid,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) =>
      query.state.data?.some((e) => e.planId === planId && e.status === 'ACTIVE') ? false : POLL_MS,
  })
  const enrolment = access.data?.find((e) => e.planId === planId && e.status === 'ACTIVE')

  useEffect(() => {
    if (!enrolment) return
    void queryClient.invalidateQueries({ queryKey: qk.enrolments })
    void queryClient.invalidateQueries({ queryKey: qk.today })
  }, [enrolment, queryClient])

  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!purchaseId) {
    return (
      <div className="page page-narrow">
        <EmptyState title="No payment to show" action={<Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>}>
          This page is missing its payment reference. Programmes you own are always on your dashboard.
        </EmptyState>
      </div>
    )
  }
  if (purchase.isPending) return <LoadingState label="Checking your payment…" />
  if (purchase.isError) {
    return (
      <div className="page page-narrow">
        {isApiError(purchase.error, 404) ? (
          <EmptyState title="We couldn’t find that payment" action={<Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>}>
            It may belong to a different account. Programmes you own are always on your dashboard.
          </EmptyState>
        ) : (
          <ErrorState error={purchase.error} onRetry={() => purchase.refetch()} title="We couldn’t check your payment" />
        )}
      </div>
    )
  }

  const { status, planTitle, amount } = purchase.data
  const summary = <p className="hint">{planTitle} · {formatMoney(amount)}</p>

  return (
    <div className="page page-narrow">
      <div className="card status-card" aria-live="polite">
        {status === 'PENDING' && (
          <>
            <span className="spinner spinner-lg" aria-hidden="true" />
            <h1>Confirming your payment…</h1>
            {summary}
            <p>We’re waiting for confirmation from the payment provider. This usually takes a few seconds.</p>
            {slow && (
              <Notice tone="warn" title="This is taking longer than usual">
                You can safely leave this page. You won’t be charged twice, and the programme will appear on
                your dashboard once the payment is confirmed.
              </Notice>
            )}
          </>
        )}

        {paid && !enrolment && (
          <>
            <span className="spinner spinner-lg" aria-hidden="true" />
            <h1>Payment received. Unlocking your programme…</h1>
            {summary}
            {access.isError && (
              <Notice tone="warn">
                We couldn’t confirm your access just now. It will appear on your dashboard shortly.
              </Notice>
            )}
          </>
        )}

        {paid && enrolment && (
          <>
            <span className="status-mark status-ok" aria-hidden="true">✓</span>
            <h1>You’re in.</h1>
            {summary}
            <p>Your payment is confirmed and the programme is unlocked. Week 1 starts today.</p>
            <Link className="btn btn-accent btn-block" to={`/programmes/${enrolment.id}`}>Open programme</Link>
          </>
        )}

        {(status === 'FAILED' || status === 'CANCELLED') && (
          <>
            <span className="status-mark status-bad" aria-hidden="true">!</span>
            <h1>{status === 'FAILED' ? 'Payment didn’t go through' : 'Payment cancelled'}</h1>
            {summary}
            <p>
              {status === 'FAILED'
                ? 'The payment provider declined the payment, so the programme was not unlocked. You can try again with a different payment method.'
                : 'The payment was cancelled before it completed, so the programme was not unlocked.'}
            </p>
            <Link className="btn btn-primary btn-block" to={`/plans/${purchase.data.planId}`}>Back to the programme</Link>
          </>
        )}

        {status === 'REFUNDED' && (
          <>
            <span className="status-mark status-bad" aria-hidden="true">!</span>
            <h1>This payment was refunded</h1>
            {summary}
            <Link className="btn btn-primary btn-block" to="/">Browse programmes</Link>
          </>
        )}
      </div>
    </div>
  )
}
