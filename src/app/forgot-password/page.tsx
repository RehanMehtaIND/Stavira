import { ForgotForm } from '@/components/forgot-form';
import { Brand } from '@/components/ui';
import { mode } from '@/server/config';
export const dynamic = 'force-dynamic';
export default function ForgotPassword() {
  return (
    <div className="auth-page">
      <Brand />
      <ForgotForm local={mode() === 'local'} />
    </div>
  );
}
