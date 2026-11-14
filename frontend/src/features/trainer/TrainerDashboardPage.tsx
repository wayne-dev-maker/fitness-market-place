import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Badge, ErrorState, Field, LoadingState } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api, qk } from '../../services/api'
import { errorMessage, fieldError } from '../../services/http'
import type { TrainerPlan } from '../../services/types'
import { formatMoney } from '../../utils/money'

function PlanRow({ plan }: { plan: TrainerPlan }) {
  const workouts = plan.weeks.reduce((sum, week) => sum + week.workouts.length, 0)
  return (
    <li className="list-row plan-row">
      <div>
        <Link to={`/trainer/plans/${plan.id}`}><strong>{plan.title}</strong></Link>
        <p className="hint">
          {plan.durationWeeks} week{plan.durationWeeks === 1 ? '' : 's'} · {workouts} workout{workouts === 1 ? '' : 's'} · {formatMoney(plan.price)}
        </p>
      </div>
      <div className="row">
        {plan.status === 'PUBLISHED' && (
          <span className="hint">{plan.enrolmentCount} enrolled</span>
        )}
        <Badge tone={plan.status === 'PUBLISHED' ? 'ok' : plan.status === 'DRAFT' ? 'warn' : 'neutral'}>
          {plan.status === 'PUBLISHED' ? 'Published' : plan.status === 'DRAFT' ? 'Draft' : 'Archived'}
        </Badge>
      </div>
    </li>
  )
}

export default function TrainerDashboardPage() {
  useTitle('Studio')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const plans = useQuery({ queryKey: qk.trainerPlans, queryFn: api.listTrainerPlans })
  const [title, setTitle] = useState('')

  const create = useMutation({
    mutationFn: (newTitle: string) => api.createTrainerPlan(newTitle),
    onSuccess: (plan) => {
      void queryClient.invalidateQueries({ queryKey: qk.trainerPlans })
      queryClient.setQueryData(qk.trainerPlan(plan.id), plan)
      navigate(`/trainer/plans/${plan.id}`)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (create.isPending || title.trim().length < 3) return
    create.mutate(title.trim())
  }

  if (plans.isPending) return <LoadingState label="Loading your plans…" />
  if (plans.isError) {
    return <div className="page"><ErrorState error={plans.error} onRetry={() => plans.refetch()} title="We couldn’t load your plans" /></div>
  }

  const drafts = plans.data.filter((p) => p.status === 'DRAFT')
  const published = plans.data.filter((p) => p.status === 'PUBLISHED')
  const enrolled = published.reduce((sum, p) => sum + p.enrolmentCount, 0)

  return (
    <div className="page page-medium stack-lg">
      <header className="page-head">
        <h1>Studio</h1>
        <p className="lead">Write, price and publish your training programmes.</p>
      </header>

      <div className="tiles">
        <div className="tile"><span className="tile-value">{published.length}</span><span className="tile-label">published</span></div>
        <div className="tile"><span className="tile-value">{drafts.length}</span><span className="tile-label">drafts</span></div>
        <div className="tile"><span className="tile-value">{enrolled}</span><span className="tile-label">active enrolments</span></div>
      </div>

      <form onSubmit={submit} className="card stack">
        <h2>Start a new plan</h2>
        <div className="row row-end">
          <div className="field-grow">
            <Field
              label="Plan title" htmlFor="new-plan-title"
              error={create.isError ? (fieldError(create.error, 'title') ?? errorMessage(create.error)) : undefined}
            >
              <input
                id="new-plan-title" className="input" maxLength={120} placeholder="e.g. 8-Week Strength Base"
                value={title} onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary" disabled={create.isPending || title.trim().length < 3}>
            {create.isPending ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>

      <section aria-labelledby="drafts-heading">
        <h2 id="drafts-heading">Drafts</h2>
        {drafts.length === 0
          ? <p className="hint">No drafts. Start a new plan above.</p>
          : <ul className="list card">{drafts.map((plan) => <PlanRow key={plan.id} plan={plan} />)}</ul>}
      </section>

      <section aria-labelledby="published-heading">
        <h2 id="published-heading">Published</h2>
        {published.length === 0
          ? <p className="hint">Nothing published yet. Published plans appear in the marketplace.</p>
          : <ul className="list card">{published.map((plan) => <PlanRow key={plan.id} plan={plan} />)}</ul>}
      </section>
    </div>
  )
}
