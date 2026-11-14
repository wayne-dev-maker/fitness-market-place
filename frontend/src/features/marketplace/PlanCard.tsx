import { Link } from 'react-router'
import { Avatar, Badge } from '../../components/ui'
import type { PlanSummary } from '../../services/types'
import { formatMoney } from '../../utils/money'
import { coverStyle, DIFFICULTY_LABEL } from './planDisplay'

export function PlanCard({ plan }: { plan: PlanSummary }) {
  return (
    <article className="plan-card">
      <Link to={`/plans/${plan.id}`} className="plan-card-link">
        <div className="cover" style={coverStyle(plan.id)} aria-hidden="true">
          <span className="cover-weeks">{plan.durationWeeks}</span>
          <span className="cover-unit">week{plan.durationWeeks === 1 ? '' : 's'}</span>
        </div>
        <div className="plan-card-body">
          <Badge>{DIFFICULTY_LABEL[plan.difficulty]}</Badge>
          <h3>{plan.title}</h3>
          <p className="plan-card-meta">
            {plan.durationWeeks} week{plan.durationWeeks === 1 ? '' : 's'} · {plan.workoutsPerWeek} sessions a week
          </p>
          <div className="plan-card-foot">
            <span className="trainer">
              <Avatar name={plan.trainer.displayName} />
              {plan.trainer.displayName}
            </span>
            <strong className="price">{formatMoney(plan.price)}</strong>
          </div>
        </div>
      </Link>
    </article>
  )
}
