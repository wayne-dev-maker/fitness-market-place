import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import type { Difficulty, PlanFilters, PlanSort } from '../../services/types'
import { PlanCard } from './PlanCard'

const PAGE_SIZE = 9

export default function MarketplacePage() {
  useTitle('Training programmes')
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const difficulty = (params.get('difficulty') ?? '') as Difficulty | ''
  const maxWeeks = params.get('maxWeeks') ?? ''
  const sort = (params.get('sort') ?? 'featured') as PlanSort
  const page = Math.max(Number(params.get('page')) || 1, 1)

  // Filters live in the URL so results can be shared, bookmarked and survive Back.
  const update = (changes: Record<string, string>) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!('page' in changes)) next.delete('page')
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    }, { replace: true })
  }

  const [searchText, setSearchText] = useState(search)
  useEffect(() => {
    if (searchText === search) return
    const timer = setTimeout(() => update({ q: searchText.trim() }), 300)
    return () => clearTimeout(timer)
    // `update` is recreated each render; only the typed text should restart the debounce.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  const filters: PlanFilters = {
    search, difficulty, maxWeeks: maxWeeks ? Number(maxWeeks) : '', sort, page, size: PAGE_SIZE,
  }
  const plans = useQuery({
    queryKey: qk.plans(filters),
    queryFn: () => api.listPlans(filters),
    placeholderData: keepPreviousData,
  })
  const filtered = Boolean(search || difficulty || maxWeeks)

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">Programmes from independent trainers</p>
        <h1>Train with a plan, not a guess.</h1>
        <p className="lead">
          Structured, multi-week programmes written by trainers. Buy once, follow the schedule and log every session.
        </p>
      </section>

      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field field-grow">
          <label htmlFor="plan-search">Search</label>
          <input
            id="plan-search" className="input" type="search" placeholder="Title, trainer or goal"
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="plan-difficulty">Level</label>
          <select id="plan-difficulty" className="input" value={difficulty} onChange={(e) => update({ difficulty: e.target.value })}>
            <option value="">Any level</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="plan-weeks">Length</label>
          <select id="plan-weeks" className="input" value={maxWeeks} onChange={(e) => update({ maxWeeks: e.target.value })}>
            <option value="">Any length</option>
            <option value="4">Up to 4 weeks</option>
            <option value="8">Up to 8 weeks</option>
            <option value="12">Up to 12 weeks</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="plan-sort">Sort by</label>
          <select id="plan-sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value === 'featured' ? '' : e.target.value })}>
            <option value="featured">Featured</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="duration_asc">Shortest first</option>
          </select>
        </div>
      </form>

      {plans.isPending ? (
        <LoadingState label="Loading programmes…" />
      ) : plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => plans.refetch()} title="We couldn’t load the programmes" />
      ) : plans.data.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No programmes match those filters' : 'No programmes yet'}
          action={filtered ? (
            <button type="button" className="btn btn-primary" onClick={() => { setSearchText(''); setParams({}, { replace: true }) }}>
              Clear filters
            </button>
          ) : undefined}
        >
          {filtered ? 'Try a different level or length, or search for something else.' : 'Published programmes will appear here.'}
        </EmptyState>
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {plans.data.totalItems} programme{plans.data.totalItems === 1 ? '' : 's'}
          </p>
          <div className={plans.isPlaceholderData ? 'grid-cards is-stale' : 'grid-cards'}>
            {plans.data.items.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
          {plans.data.totalPages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </button>
              <span>Page {plans.data.page} of {plans.data.totalPages}</span>
              <button type="button" className="btn btn-ghost" disabled={page >= plans.data.totalPages} onClick={() => update({ page: String(page + 1) })}>
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
