import { redirect } from 'next/navigation';
import { authenticate } from '@/server/auth';
import { mode } from '@/server/config';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function Layout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await authenticate();
  } catch {
    redirect('/session');
  }
  return (
    <Shell name={user.name} local={mode() === 'local'}>
      {children}
    </Shell>
  );
}
