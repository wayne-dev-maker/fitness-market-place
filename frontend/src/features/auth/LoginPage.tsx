import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Field, Notice } from '../../components/ui'
import { useTitle } from '../../hooks/useTitle'
import { api } from '../../services/api'
import { errorMessage, USE_MOCK_API } from '../../services/http'
import { homeFor, useMe, useSession } from './session'
import { useSignedIn } from './useSignedIn'

// Shown only in mock mode, where these accounts exist purely in the browser.
const DEMO_ACCOUNTS = [
  { label: 'Demo trainee', email: 'trainee@example.com' },
  { label: 'Demo trainer', email: 'trainer@example.com' },
]
const DEMO_PASSWORD = 'demo-pass-123'

export default function LoginPage() {
  useTitle('Log in')
  const me = useMe()
  const session = useSession()
  const location = useLocation()
  const onSignedIn = useSignedIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = useMutation({ mutationFn: api.login, onSuccess: onSignedIn })

  if (me.data && !login.isSuccess) return <Navigate to={homeFor(me.data.role)} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (login.isPending) return
    login.mutate({ email: email.trim(), password })
  }

  return (
    <div className="page page-narrow">
      <div className="card auth-card">
        <h1>Log in</h1>
        {session.expired && (
          <Notice tone="warn" title="Your session has ended" role="status">
            Log in again to carry on where you left off.
          </Notice>
        )}
        {login.isError && <Notice tone="danger">{errorMessage(login.error)}</Notice>}

        <form onSubmit={submit} className="stack" noValidate>
          <Field label="Email" htmlFor="login-email">
            <input
              id="login-email" className="input" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <input
              id="login-password" className="input" type="password" autoComplete="current-password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-block" disabled={login.isPending || !email || !password}>
            {login.isPending ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {USE_MOCK_API && (
          <div className="demo-accounts">
            <p className="hint">Demo mode accounts:</p>
            <div className="row">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email} type="button" className="btn btn-ghost btn-sm"
                  onClick={() => { setEmail(account.email); setPassword(DEMO_PASSWORD) }}
                >
                  Fill in {account.label.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="auth-switch">
          New here? <Link to="/register" state={location.state}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
