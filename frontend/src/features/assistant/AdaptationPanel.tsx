import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Badge, Notice } from '../../components/ui'
import { api } from '../../services/api'
import { USE_MOCK_API } from '../../services/http'
import type { AdaptationProposal, AdaptedExercise, EnergyLevel, Workout } from '../../services/types'

const EQUIPMENT = ['Dumbbells', 'Barbell', 'Pull-up bar', 'Resistance band', 'Kettlebell']

const CHANGE_LABEL: Record<AdaptedExercise['change'], string> = {
  UNCHANGED: 'Unchanged',
  SUBSTITUTED: 'Swapped',
  REDUCED: 'Shortened',
  REMOVED: 'Skipped today',
}

/**
 * Lets a trainee ask for a constrained adjustment to today's session and review it
 * before using it. A suggestion is only ever a proposal for this session: the
 * trainer's programme is not changed, and a failed request leaves the original as is.
 */
export function AdaptationPanel({ workout, onAccept }: {
  workout: Workout
  onAccept: (proposal: AdaptationProposal) => void
}) {
  const [minutes, setMinutes] = useState(String(workout.durationMinutes))
  const [equipment, setEquipment] = useState<string[]>(EQUIPMENT)
  const [energy, setEnergy] = useState<EnergyLevel>('NORMAL')

  const suggest = useMutation({
    mutationFn: () => api.requestAdaptation({
      workoutId: workout.id, minutesAvailable: Number(minutes), equipment, energy,
    }),
  })
  const accept = useMutation({
    mutationFn: (proposal: AdaptationProposal) => api.acceptAdaptation(proposal.id),
    onSuccess: (_result, proposal) => onAccept(proposal),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (suggest.isPending) return
    accept.reset()
    suggest.mutate()
  }
  const toggle = (item: string) =>
    setEquipment((current) => (current.includes(item) ? current.filter((e) => e !== item) : [...current, item]))

  const proposal = suggest.data
  const hasChanges = proposal?.exercises.some((e) => e.change !== 'UNCHANGED') ?? false
  const minutesValid = Number.isInteger(Number(minutes)) && Number(minutes) >= 5 && Number(minutes) <= 300

  return (
    <details className="card adapt">
      <summary>Short on time or equipment today?</summary>
      <form onSubmit={submit} className="stack">
        <p className="hint">
          Get a suggested lighter version of this session. It stays within your trainer’s programme and is not
          medical advice. If something hurts or you feel unwell, stop and speak to a health professional.
        </p>
        <div className="row row-end">
          <div className="field">
            <label htmlFor="adapt-minutes">Minutes available</label>
            <input
              id="adapt-minutes" className="input input-sm" type="number" inputMode="numeric" min={5} max={300}
              value={minutes} onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="adapt-energy">Energy today</label>
            <select id="adapt-energy" className="input" value={energy} onChange={(e) => setEnergy(e.target.value as EnergyLevel)}>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
        <fieldset className="checks">
          <legend>Equipment you have</legend>
          {EQUIPMENT.map((item) => (
            <label key={item} className="check">
              <input type="checkbox" checked={equipment.includes(item)} onChange={() => toggle(item)} />
              {item}
            </label>
          ))}
        </fieldset>
        <div>
          <button type="submit" className="btn btn-primary" disabled={suggest.isPending || !minutesValid}>
            {suggest.isPending ? 'Working on it…' : 'Suggest an adjustment'}
          </button>
        </div>
      </form>

      {suggest.isError && (
        <Notice tone="danger" title="We couldn’t get a suggestion">
          Your original workout is unchanged and ready to go below.
        </Notice>
      )}

      {proposal && (
        <div className="stack proposal" aria-live="polite">
          <h3>Suggested version</h3>
          {USE_MOCK_API && <p className="hint">Demo mode: this is a rule-based sample, not a real AI suggestion.</p>}
          <p>{proposal.explanation}</p>
          {hasChanges && (
            <>
              <ul className="list">
                {proposal.exercises.map((exercise) => (
                  <li key={exercise.workoutExerciseId} className="list-row">
                    <span>
                      <strong>{exercise.exerciseName}</strong>
                      {exercise.change !== 'REMOVED' && <span className="hint"> · {exercise.sets} × {exercise.reps}</span>}
                      {exercise.note && <span className="hint"> · {exercise.note}</span>}
                    </span>
                    <Badge tone={exercise.change === 'UNCHANGED' ? 'neutral' : 'warn'}>{CHANGE_LABEL[exercise.change]}</Badge>
                  </li>
                ))}
              </ul>
              {accept.isError && <Notice tone="danger">We couldn’t apply the suggestion. Your original workout is unchanged.</Notice>}
              <div className="row">
                <button type="button" className="btn btn-accent" disabled={accept.isPending} onClick={() => accept.mutate(proposal)}>
                  {accept.isPending ? 'Applying…' : 'Use this version today'}
                </button>
                <button type="button" className="btn btn-ghost" disabled={accept.isPending} onClick={() => suggest.reset()}>
                  Keep the original
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </details>
  )
}
