'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty">
      <h1>Let’s try that again.</h1>
      <p>We couldn’t open this page. Your saved work is still there.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a href="/signin">Sign in again</a>
    </main>
  );
}
