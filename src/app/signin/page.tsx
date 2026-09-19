import { Suspense } from 'react';
import { Brand } from '@/components/ui';
import { AuthForm } from '@/components/auth-form';
import { mode } from '@/server/config';
export const dynamic = 'force-dynamic';
export default function SignIn() {
  return (
    <div className="auth-page">
      <Brand href="/" />
      <Suspense>
        <AuthForm local={mode() === 'local'} />
      </Suspense>
    </div>
  );
}
