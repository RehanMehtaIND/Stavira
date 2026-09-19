import { Suspense } from 'react';
import { ResetForm } from '@/components/reset-form';
import { Brand } from '@/components/ui';
export const dynamic = 'force-dynamic';
export default function ResetPassword() {
  return (
    <div className="auth-page">
      <Brand />
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
