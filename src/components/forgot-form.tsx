'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck, TriangleAlert } from 'lucide-react';
import { api } from './api';
export function ForgotForm({ local }: { local: boolean }) {
  const [result, setResult] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(
        await api<{ devLink?: string }>(
          'auth/forgot',
          Object.fromEntries(new FormData(e.currentTarget)),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const missing = local && result !== null && !result.devLink;
  return (
    <div className="auth-card">
      <p className="eyebrow">ONE STEP BACK ON TRACK</p>
      <h1>
        {result === null
          ? 'Reset your password.'
          : missing
            ? 'No account on this computer.'
            : local
              ? 'Your reset link is ready.'
              : 'Check your inbox.'}
      </h1>
      <p className="muted">
        {result === null
          ? 'Enter the email you signed up with and we’ll send you a link to choose a new one.'
          : missing
            ? 'Local development stores accounts in this computer’s database, and no account there uses that email. Create one, or try the address you signed up with.'
            : local
              ? 'Local development has no mail service, so the link is below instead of in your inbox. It expires in one hour.'
              : 'If that email has a Stavira account, a link to choose a new password is on its way. It expires in one hour.'}
      </p>
      {result === null ? (
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
      ) : missing ? (
        <>
          <p className="auth-sent warn">
            <TriangleAlert size={18} /> No local account matched
          </p>
          <p className="auth-switch">
            <Link href="/signin?mode=signup">Create an account</Link> or{' '}
            <button onClick={() => setResult(null)}>try another email</button>
          </p>
        </>
      ) : (
        <>
          <p className="auth-sent">
            <MailCheck size={18} /> {local ? 'Reset link ready' : 'Reset link sent'}
          </p>
          {local && result.devLink && (
            <Link
              className="button secondary full local-link"
              href={result.devLink.replace(/^.*?\/\/[^/]+/, '')}
            >
              Open the reset page <ArrowRight size={16} />
            </Link>
          )}
        </>
      )}
      <p className="auth-switch">
        <Link href="/signin" className="auth-back">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </p>
    </div>
  );
}
