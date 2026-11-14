import type { ReactNode } from 'react'
import { errorMessage, isApiError } from '../services/http'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  return (
    <div className="state state-error" role="alert">
      <h2>{title}</h2>
      <p>{errorMessage(error)}</p>
      {isApiError(error) && error.traceId && <p className="hint">Reference: {error.traceId}</p>}
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

type Tone = 'info' | 'ok' | 'warn' | 'danger'

export function Notice({ tone = 'info', title, children, role }: {
  tone?: Tone
  title?: string
  children?: ReactNode
  role?: 'alert' | 'status'
}) {
  return (
    <div className={`notice notice-${tone}`} role={role ?? (tone === 'danger' ? 'alert' : undefined)}>
      {title && <strong>{title}</strong>}
      {children && <div>{children}</div>}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone | 'neutral' | 'accent'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Field({ label, htmlFor, hint, error, children }: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="hint" id={`${htmlFor}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${htmlFor}-error`} role="alert">{error}</p>}
    </div>
  )
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return <span className="avatar" aria-hidden="true">{initials}</span>
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}
