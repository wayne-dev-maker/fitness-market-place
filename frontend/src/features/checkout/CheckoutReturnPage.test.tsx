import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../services/api'
import type { Enrolment, Purchase, PurchaseStatus } from '../../services/types'
import CheckoutReturnPage from './CheckoutReturnPage'

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>()
  return { ...actual, api: { ...actual.api, getPurchase: vi.fn(), listMyEnrolments: vi.fn() } }
})

const getPurchase = vi.mocked(api.getPurchase)
const listMyEnrolments = vi.mocked(api.listMyEnrolments)

const purchase = (status: PurchaseStatus): Purchase => ({
  id: 'pur_1', planId: 'pln_1', planTitle: 'Foundations Strength',
  amount: { amount: '349.00', currency: 'ZAR' }, status, createdAt: '2026-11-14T08:00:00Z',
})

const enrolment: Enrolment = {
  id: 'enr_1', planId: 'pln_1', planTitle: 'Foundations Strength', trainerName: 'Thandi Mokoena',
  status: 'ACTIVE', startedAt: '2026-11-14T08:00:05Z', expiresAt: null, completedWorkouts: 0, totalWorkouts: 12,
}

function renderPage(url = '/checkout/return?purchase=pur_1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <CheckoutReturnPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CheckoutReturnPage', () => {
  beforeEach(() => {
    getPurchase.mockReset()
    listMyEnrolments.mockReset()
  })

  it('does not promise access while the payment is unconfirmed', async () => {
    getPurchase.mockResolvedValue(purchase('PENDING'))

    renderPage()

    expect(await screen.findByRole('heading', { name: /Confirming your payment/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open programme/ })).not.toBeInTheDocument()
    expect(listMyEnrolments).not.toHaveBeenCalled()
  })

  it('keeps waiting when the payment is confirmed but the enrolment is not there yet', async () => {
    getPurchase.mockResolvedValue(purchase('PAID'))
    listMyEnrolments.mockResolvedValue([])

    renderPage()

    expect(await screen.findByRole('heading', { name: /Unlocking your programme/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open programme/ })).not.toBeInTheDocument()
  })

  it('links to the programme only once the server returns the enrolment', async () => {
    getPurchase.mockResolvedValue(purchase('PAID'))
    listMyEnrolments.mockResolvedValue([enrolment])

    renderPage()

    const link = await screen.findByRole('link', { name: /Open programme/ })
    expect(link).toHaveAttribute('href', '/programmes/enr_1')
    expect(screen.getByRole('heading', { name: /You’re in/ })).toBeInTheDocument()
  })

  it.each([
    ['FAILED', /Payment didn’t go through/],
    ['CANCELLED', /Payment cancelled/],
  ] as const)('explains a %s payment and unlocks nothing', async (status, heading) => {
    getPurchase.mockResolvedValue(purchase(status))

    renderPage()

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open programme/ })).not.toBeInTheDocument()
    expect(listMyEnrolments).not.toHaveBeenCalled()
  })

  it('handles a return link with no payment reference', () => {
    renderPage('/checkout/return')

    expect(screen.getByRole('heading', { name: /No payment to show/ })).toBeInTheDocument()
    expect(getPurchase).not.toHaveBeenCalled()
  })
})
