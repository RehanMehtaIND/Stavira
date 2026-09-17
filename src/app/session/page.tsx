'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function Session() {
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => {
        if (mounted) {
          router.replace(r.ok ? '/today' : '/signin');
          router.refresh();
        }
      })
      .catch(() => {
        if (mounted) router.replace('/signin');
      });
    return () => {
      mounted = false;
    };
  }, [router]);
  return (
    <main className="loading" role="status">
      Restoring your session…
    </main>
  );
}
