'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from './api';
export function AuthForm({ local }: { local: boolean }) {
  const params = useSearchParams();
  const [action, setAction] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ confirm?: boolean }>(`auth/${action}`, { ...data, email });
      if (result.confirm) {
        setAction('confirm');
      } else if (action === 'confirm') {
        setAction('signin');
      } else {
        router.push(action === 'signup' ? '/goals/new?welcome=1' : '/today');
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <p className="eyebrow">YOUR NEXT CHAPTER</p>
      <h1>
        {action === 'signup'
          ? 'Make room for progress.'
          : action === 'confirm'
            ? 'Check your inbox.'
            : 'Welcome back.'}
      </h1>
      <p className="muted">
        {action === 'signup'
          ? 'One goal, a little context, and a clear next step.'
          : action === 'confirm'
            ? 'Enter the verification code sent to your email.'
            : 'Let’s find the right next step for today.'}
      </p>
      <form onSubmit={submit}>
        {action === 'signup' && (
          <label>
            Your name
            <input name="name" autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {action === 'confirm' ? (
          <label>
            Verification code
            <input name="code" autoComplete="one-time-code" required />
          </label>
        ) : (
          <label>
            <span className="label-row">
              Password
              {action === 'signin' && <Link href="/forgot-password">Forgot password?</Link>}
            </span>
            <input
              name="password"
              aria-label="Password"
              type="password"
              autoComplete={action === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={10}
            />
            {action === 'signup' && (
              <small>10+ characters, with upper/lowercase letters, a number, and a symbol.</small>
            )}
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}{' '}
          {action === 'signup'
            ? 'Create your account'
            : action === 'confirm'
              ? 'Verify email'
              : 'Sign in'}
        </button>
      </form>
      {action !== 'confirm' && (
        <p className="auth-switch">
          {action === 'signup' ? 'Already have an account?' : 'New to Stavira?'}{' '}
          <button
            onClick={() => {
              setAction(action === 'signup' ? 'signin' : 'signup');
              setError('');
            }}
          >
            {action === 'signup' ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      )}
      {local && (
        <p className="dev-note">
          Local development: accounts and work are saved on this computer. AI uses a deterministic
          example plan.
        </p>
      )}
    </div>
  );
}
