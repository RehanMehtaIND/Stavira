'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck } from 'lucide-react';
import { api } from './api';
export function ForgotForm({ local }: { local: boolean }) {
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ devLink?: string }>(
        'auth/forgot',
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setDevLink(result.devLink ?? '');
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-card">
      <p className="eyebrow">ONE STEP BACK ON TRACK</p>
      <h1>{sent ? 'Check your inbox.' : 'Reset your password.'}</h1>
      <p className="muted">
        {sent
          ? 'If that email has a Stavira account, a link to choose a new password is on its way. It expires in one hour.'
          : 'Enter the email you signed up with and we’ll send you a link to choose a new one.'}
      </p>
      {sent ? (
        <>
          <p className="auth-sent">
            <MailCheck size={18} /> Reset link sent
          </p>
          {local && devLink && (
            <p className="dev-note">
              Local development: no email is sent. Open this link to continue —{' '}
              <Link href={devLink.replace(/^.*?\/\/[^/]+/, '')}>reset your password</Link>.
            </p>
          )}
        </>
      ) : (
        <form onSubmit={submit}>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required autoFocus />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />} Send
            reset link
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link href="/signin" className="auth-back">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
