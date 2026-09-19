'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { api } from './api';
export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const linked = Boolean(params.get('email') && params.get('code'));
  const mismatch = confirm.length > 0 && password !== confirm;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError('');
    try {
      await api('auth/reset', {
        ...Object.fromEntries(new FormData(e.currentTarget)),
        email: params.get('email') ?? undefined,
        code: params.get('code') ?? undefined,
      });
      setDone(true);
      setTimeout(() => router.push('/signin'), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="auth-card">
        <p className="eyebrow">ONE STEP BACK ON TRACK</p>
        <h1>Password updated.</h1>
        <p className="muted">
          You’re signed out everywhere else. Taking you to sign in with your new password…
        </p>
        <p className="auth-sent">
          <Check size={18} /> All set
        </p>
      </div>
    );
  return (
    <div className="auth-card">
      <p className="eyebrow">ONE STEP BACK ON TRACK</p>
      <h1>Choose a new password.</h1>
      <p className="muted">
        Enter it twice so we know it’s the one you meant. This signs you out on every other device.
      </p>
      <form onSubmit={submit}>
        {!linked && (
          <>
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Reset code
              <input name="code" autoComplete="one-time-code" required />
              <small>
                Paste the code from the email if your reset link did not open this page.
              </small>
            </label>
          </>
        )}
        <label>
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
          />
          <small>10+ characters, with upper/lowercase letters, a number, and a symbol.</small>
        </label>
        <label>
          Confirm new password
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            required
            minLength={10}
          />
          {mismatch && <small className="mismatch">Both passwords must match.</small>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy || mismatch}>
          {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />} Set new
          password
        </button>
      </form>
      <p className="auth-switch">
        <Link href="/forgot-password" className="auth-back">
          <ArrowLeft size={14} /> Request a new link
        </Link>
      </p>
    </div>
  );
}
