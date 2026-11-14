import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { LoadingState, Notice } from '../../components/ui'
import { api, qk } from '../../services/api'
import { errorMessage, isApiError } from '../../services/http'
import { formatDateTime } from '../../utils/dates'

const MAX_LENGTH = 280

/** Programme-only check-ins: visible to participants, never a public feed. */
export function CheckinList({ planId }: { planId: string }) {
  const checkins = useQuery({ queryKey: qk.checkins(planId), queryFn: () => api.listCheckins(planId) })

  if (checkins.isPending) return <LoadingState label="Loading check-ins…" />
  if (checkins.isError) {
    return (
      <Notice tone="danger">
        {isApiError(checkins.error, 403) ? 'Check-ins are only visible to people on this programme.' : errorMessage(checkins.error)}{' '}
        {!isApiError(checkins.error, 403) && (
          <button type="button" className="link-button" onClick={() => checkins.refetch()}>Try again</button>
        )}
      </Notice>
    )
  }
  if (checkins.data.length === 0) {
    return <p className="hint">No check-ins yet. Finish a session to post the first one.</p>
  }
  return (
    <ul className="list card">
      {checkins.data.map((checkin) => (
        <li key={checkin.id} className="checkin">
          <p className="checkin-head">
            <strong>{checkin.mine ? 'You' : checkin.authorName}</strong>
            <span className="hint"> · {checkin.workoutTitle} · {formatDateTime(checkin.createdAt)}</span>
          </p>
          <p>{checkin.message}</p>
        </li>
      ))}
    </ul>
  )
}

/** Optional note attached to a workout the trainee has just logged. */
export function CheckinComposer({ planId, workoutLogId }: { planId: string; workoutLogId: string }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')
  const post = useMutation({
    mutationFn: () => api.createCheckin(planId, { workoutLogId, message: message.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.checkins(planId) }),
  })

  if (post.isSuccess) return <Notice tone="ok" title="Check-in posted" role="status" />
  if (isApiError(post.error, 409)) return <Notice>You’ve already checked in for this workout.</Notice>

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (post.isPending || !message.trim()) return
    post.mutate()
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="field">
        <label htmlFor="checkin-message">Share a check-in <span className="hint">(optional)</span></label>
        <textarea
          id="checkin-message" className="input" rows={3} maxLength={MAX_LENGTH}
          placeholder="How did it go?" value={message} onChange={(e) => setMessage(e.target.value)}
          aria-describedby="checkin-hint"
        />
        <p className="hint" id="checkin-hint">
          Visible to other people on this programme. {MAX_LENGTH - message.length} characters left.
        </p>
      </div>
      {post.isError && <Notice tone="danger">{errorMessage(post.error)}</Notice>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={post.isPending || !message.trim()}>
          {post.isPending ? 'Posting…' : 'Post check-in'}
        </button>
      </div>
    </form>
  )
}
