import { authenticate } from '@/server/auth';
import { mode } from '@/server/config';
import { PageHeading } from '@/components/ui';
export default async function Page() {
  const user = await authenticate();
  return (
    <>
      <PageHeading eyebrow="YOUR SPACE" title="A little about your workspace." />
      <section className="surface settings">
        <h2>{user.name}</h2>
        {user.email && <p>{user.email}</p>}
        <h3>Your data stays yours.</h3>
        <p>
          Goals, check-ins, recommendations, and execution history belong to your account. Sign out
          using the button next to your avatar.
        </p>
        <h3>How Stavira learns</h3>
        <p>
          Completed work helps calibrate duration estimates by category. Repeated skips in similar
          energy conditions reduce a task’s recommendation score. Plan adjustments are always yours
          to review.
        </p>
        <h3>{mode() === 'local' ? 'Local development mode' : 'AWS workspace'}</h3>
        <p>
          {mode() === 'local'
            ? 'This version stores accounts and application data in a local SQLite database. Planning uses a deterministic development fixture, not a live AI model. Production mode requires Cognito, DynamoDB, and Bedrock.'
            : 'Authentication uses Amazon Cognito. Plans and execution history are stored in DynamoDB. Amazon Bedrock creates plans and suggests adjustments.'}
        </p>
      </section>
    </>
  );
}
