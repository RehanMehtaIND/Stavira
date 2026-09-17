import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="empty">
      <h1>This path ends here.</h1>
      <Link href="/today" className="button primary">
        Back to Today
      </Link>
    </main>
  );
}
