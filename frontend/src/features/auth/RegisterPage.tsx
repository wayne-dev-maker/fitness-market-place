import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Field, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api } from '../../services/api'
import { errorMessage, fieldError, isApiError } from '../../services/http'
import { homeFor, useMe } from './session'
import { useSignedIn } from './useSignedIn'

const MIN_PASSWORD = 10

export default function RegisterPage() {
  useTitle('Create an account')
  const me = useMe()
  const location = useLocation()
  const onSignedIn = useSignedIn()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const register = useMutation({ mutationFn: api.register, onSuccess: onSignedIn })

  if (me.data && !register.isSuccess) return <Navigate to={homeFor(me.data.role)} replace />

  const clientErrors = {
    displayName: displayName.trim().length < 2 ? 'Enter your name.' : undefined,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Enter a valid email address.',
    password: password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : undefined,
  }
  const errorFor = (field: keyof typeof clientErrors) =>
    (touched ? clientErrors[field] : undefined) ?? fieldError(register.error, field)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (register.isPending || Object.values(clientErrors).some(Boolean)) return
    register.mutate({ displayName: displayName.trim(), email: email.trim(), password })
  }

  // Field-level problems are shown next to the field; anything else goes in the banner.
  const bannerError = register.isError && !(isApiError(register.error, 422) && register.error.details.length > 0)

  return (
    <div className="page page-narrow">
      <div className="card auth-card">
        <h1>Create an account</h1>
        <p className="lead">Buy programmes, follow your schedule and log every session.</p>
        {bannerError && <Notice tone="danger">{errorMessage(register.error)}</Notice>}

        <form onSubmit={submit} className="stack" noValidate>
          <Field label="Name" htmlFor="reg-name" error={errorFor('displayName')}>
            <input
              id="reg-name" className="input" autoComplete="name" required
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={Boolean(errorFor('displayName'))}
            />
          </Field>
          <Field label="Email" htmlFor="reg-email" error={errorFor('email')}>
            <input
              id="reg-email" className="input" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errorFor('email'))}
            />
          </Field>
          <Field label="Password" htmlFor="reg-password" hint={`At least ${MIN_PASSWORD} characters.`} error={errorFor('password')}>
            <input
              id="reg-password" className="input" type="password" autoComplete="new-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errorFor('password'))} aria-describedby="reg-password-hint"
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={register.isPending}>
            {register.isPending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="hint">
          New accounts are trainee accounts. Trainer accounts are set up separately after verification.
        </p>
        <p className="auth-switch">
          Already have an account? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
