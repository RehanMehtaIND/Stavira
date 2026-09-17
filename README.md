# Stavira

**Big goals. Right next step.**

Stavira turns a goal into an editable phase → task → microtask plan, then recommends one executable action based on time, energy, urgency, dependencies, and prior execution. Completing, skipping, and postponing actions changes the next recommendation. Replanning is proposed for review, with before/after history and preservation of completed work.

## Run locally

The frontend is pinned to **Next.js 15.5.25**, within Amplify’s documented SSR support range. PostCSS is overridden to patched 8.5.28; `npm audit` reports no vulnerabilities. Use **Node.js 22.13+** (24 LTS recommended) and npm. SQLite is built into Node; no database service is required for local development.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:3000**. Set `APP_ORIGIN=http://127.0.0.1:3000` in `.env.local` (the hostname must match your browser). Create an account with any test email and a password of at least 10 characters. Local accounts do not send verification emails. Accounts, hashed passwords, opaque sessions, goals, and history persist in `.data/stavira.sqlite`. This directory is ignored by Git and excluded from deployment output.

**Local planning uses clearly labeled deterministic fixtures. It does not call an AI model.** The fixture is tailored to the portfolio demonstration; other goal titles receive a generic development plan. For meaningful arbitrary goal decomposition, use AWS mode. Local adapters are refused when `NODE_ENV=production`; `npm start` is for AWS mode, not a local demo.

## Working product

- Landing, signup/signin, Cognito email confirmation, private workspace, session refresh, signout.
- Goal creation, context, optional deadline and priority, confirmation before generation.
- Structured plan generation with schema and dependency validation, one controlled AI retry.
- Editable phases, root tasks, executable microtasks, order, estimates, energy, priority, impact, categories, deadlines, and prerequisites. Completed task records cannot be rewritten or deleted.
- Today check-in: 15/30/60/120 minutes or custom time, low/medium/high energy, optional interest.
- Deterministic recommendations, stored score factors and grounded explanations, alternatives.
- Focus view; start, complete, skip with a reason, postpone, event history, measured or manually supplied duration.
- Behavioral duration calibration and contextual skip penalties; visible blocked-work, repeated-skip, and overdue signals.
- Bedrock-assisted adjustment proposals, acceptance/dismissal, stale-proposal protection, before/after history.
- Goal/phase progress, recent activity, goal archival/restoration, account information.
- Responsive layouts, keyboard focus styles, semantic form controls, loading/error/empty states.

## Architecture

```text
Browser → Next.js App Router / same-origin backend-for-frontend
                ├── Cognito: signup, confirmation, session tokens
                └── API Gateway HTTP API (Cognito JWT authorizer)
                       ├── Goals Lambda
                       ├── Planning Lambda → Bedrock
                       ├── Context/workspace Lambda
                       ├── Recommendations Lambda → Bedrock
                       ├── Execution Lambda
                       └── Adaptation Lambda → Bedrock
                              ↓
                         DynamoDB
```

The browser never receives AWS credentials or auth tokens through JavaScript. The BFF holds Cognito access and refresh tokens in HTTP-only, SameSite cookies and forwards the access token to API Gateway. Lambda derives the user solely from validated JWT claims. Mutation requests require an exact Origin match. Data lookup always includes the authenticated owner key. UI state is transient; database state is authoritative.

Local development uses the same `Service`, schemas, and scoring with SQLite and a deterministic AI provider. It uses salted scrypt password hashes, hashed opaque session tokens, and prepared queries. This adapter is for a private local machine, not internet hosting.

### Persistence and concurrency

DynamoDB keys are `PK=USER#<Cognito sub>` and `SK=<kind>#<id>`. Kinds: goal, checkIn, recommendation, event, adaptation. All normal reads are owner-partition `Query` or exact-key `GetItem`; no scans or unnecessary indexes. Query results are paginated internally and strongly consistent. Each goal holds its bounded editable hierarchy as a single aggregate, with at most 100 tasks, 20 phases, and 120 KB of plan JSON. Related task/event/recommendation writes are transactional. Conditional revisions prevent lost updates; execution request IDs provide idempotency. Local SQLite uses the equivalent transaction and revision contract.

Completed root tasks and phases are derived from executable leaves. Dependencies are within a goal and must form an acyclic graph, including parent-to-child completion edges. Changes to completed leaf objects are rejected. Goal completion is automatic once all leaves complete. An archived goal is excluded from recommendation.

### Recommendation engine

`src/domain/recommendation.ts` centralizes weights:

| Factor                          | Weight |
| ------------------------------- | -----: |
| Energy fit                      |     24 |
| Time fit                        |     18 |
| Deadline urgency                |     14 |
| Task and goal priority          |     10 |
| Impact                          |     10 |
| Interest fit                    |      7 |
| Recent contextual skip behavior |      7 |
| Dependent work unlocked         |      6 |
| Momentum / in-progress work     |      4 |

Scores are weighted sums of normalized factors (0–100). First, eligibility excludes inactive goals, completed/blocked work, future postponements, incomplete prerequisites, excluded alternatives, and actions whose adjusted duration exceeds available time. Ties use order then task ID. Category duration ratios are clamped to 0.5–2×; recent same-goal/task skips in the same energy context lower suitability. No LLM chooses the task.

### Bedrock

`AIProvider` has three methods: plan, explain, adapt. The production `BedrockAIProvider` uses the AWS SDK v3 Converse API and sends JSON Schema instructions. Responses are parsed and validated with Zod; graph and application-state validation run before persistence. Invalid output gets one controlled retry within a 23-second operation budget. Planning failures preserve the draft for retry.

Explanations are intentionally grounded: Bedrock selects indices of supplied deterministic evidence sentences. The application renders those sentences, preventing model-generated unsupported claims. If explanation generation fails, it uses the same evidence directly. Adaptation can change estimates, energy, priority, or introduce a prerequisite preparation action; it cannot delete or replace completed work. Proposals require explicit acceptance and a matching goal revision.

## Project structure

```text
src/app/                   Next.js routes, BFF, authentication endpoints
src/components/            Product screens and shared UI
src/domain/                Runtime schemas, hierarchy/progress, ranking
src/server/                Application transitions, auth, AI, repositories
functions/                 Six domain-specific Lambda entry points
infrastructure/app.ts      AWS CDK stack
scripts/amplify-env.mjs     Validated Amplify runtime configuration
tests/                    Domain, security, API and browser tests
```

## Configuration

| Variable               | Local                   | AWS                                            |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| `STAVIRA_MODE`         | `local`                 | `aws` (required for deployment)                |
| `APP_ORIGIN`           | `http://127.0.0.1:3000` | Exact frontend HTTPS origin, no trailing slash |
| `STAVIRA_DATA_DIR`     | `.data` default         | Unused                                         |
| `AWS_REGION`           | Unused                  | Region containing your user pool/API/Bedrock   |
| `COGNITO_USER_POOL_ID` | Unused                  | CDK UserPoolId output                          |
| `COGNITO_CLIENT_ID`    | Unused                  | CDK ClientId output                            |
| `STAVIRA_API_URL`      | Unused                  | CDK ApiUrl output                              |
| `STAVIRA_TABLE`        | Unused                  | Injected into Lambda by CDK                    |
| `BEDROCK_MODEL_ID`     | Unused                  | Injected by CDK BedrockModelId parameter       |

Use normal AWS CLI profiles/SSO for deployment. Never put AWS access keys in frontend configuration or Git. `amplify-env.mjs` writes only the allowlisted runtime settings; it deliberately excludes credentials. The Amplify SSR runtime calls Cognito's public client endpoints and the authenticated API, so it needs no DynamoDB or Bedrock IAM permission.

## Deploy to AWS

No cloud resources are provisioned by `npm run infra:synth`. Actual deployment needs an AWS account, authenticated CLI/SSO profile, permissions to create the CDK resources, and access to the chosen Bedrock model.

1. Configure AWS CLI v2 and authenticate to the desired account. Use a supported Bedrock region. The stack defaults to the regional `amazon.nova-lite-v1:0` model; confirm availability and enable model access in that account. The template restricts InvokeModel to the selected regional foundation-model ARN. Cross-region inference profiles require explicitly extending the model ARN policy; they are not enabled by default.
2. Create an Amplify Hosting app connected to this repository, select the Next.js SSR platform and Node 22 or newer, and note the assigned HTTPS origin. `amplify.yml` defines the build. Set `STAVIRA_MODE=aws` and the final environment variables before the successful deployment. Alternatively use an existing Amplify app/custom domain.
3. Deploy the backend, replacing the origin with the exact assigned Amplify domain:

```sh
export AWS_PROFILE=your-profile
export AWS_REGION=us-east-1
aws sts get-caller-identity
npx cdk bootstrap
npm run infra:synth
npx cdk deploy Stavira \
  --parameters FrontendOrigin=https://YOUR-BRANCH.YOUR-APP.amplifyapp.com \
  --parameters BedrockModelId=amazon.nova-lite-v1:0 \
  --outputs-file cdk-outputs.json
```

4. In Amplify, set `STAVIRA_MODE=aws`, `APP_ORIGIN` to that exact origin, and `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `STAVIRA_API_URL` from CDK outputs. Trigger the Amplify build.
5. Sign up with a real email, verify the Cognito code, create a goal, and run the demo below with Bedrock. Check Lambda CloudWatch logs for operation/request IDs if an AI call fails. No goal text, passwords, or tokens are logged.

Provisioned resources: one Cognito pool and client, one on-demand DynamoDB table with point-in-time recovery, one HTTP API with JWT auth and origin-specific CORS/throttling, six Lambda functions, scoped IAM policies, and six CloudWatch log groups. User pool and table are retained on stack deletion. No S3, Step Functions, EventBridge, calendar integration, or background scheduler is needed for these synchronous MVP operations. Lambda allows 28 seconds; Bedrock has a 23-second budget so failure can return before API timeout. Long/complex goals should be broken into smaller goals; long-running orchestration is a future improvement.

CDK synthesis is verified locally. Actual AWS provisioning, live Cognito email delivery, Bedrock model access, and Amplify deployment must be verified in the target account; no AWS credentials are available in the build environment.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run infra:synth
# Start npm run dev in another terminal, then:
npx playwright install chromium
npm run test:e2e
```

The browser tests create isolated test accounts and retain their local workspace data. They exercise signup, demo creation, plan editing, acceptance, contextual recommendations, completion, changed energy/time, blocker skip, adaptation acceptance, postponement, progress, signout/signin persistence, anonymous access rejection, and mobile overflow. Screenshots/traces are written to ignored `test-results/`.

## Hackathon demo (about five minutes)

1. Create an account. On Create Goal choose **Try the portfolio demo**.
2. Review the goal, generate the plan, rename a phase or edit an estimate, and **Save plan**.
3. **Accept & start**, then open Today. Choose **30 min / Low**, then **Find my next step**.
4. Start **Write your About section draft**, enter **20** actual minutes, and mark complete. See progress update.
5. Find another step and complete **Choose the projects you want to share**.
6. Check in with **2 hours / High**. The deterministic engine recommends **Implement the portfolio project section**.
7. Skip it with **Missing something**. The task is blocked and the goal offers an adjustment.
8. Open the goal. Explain that you need to sketch project cards, then **Suggest an adjustment**.
9. Review the prerequisite **Create a rough project-card wireframe**, accept it, and return to Today. It is now eligible while project implementation waits for it.
10. Postpone the wireframe until tomorrow, inspect Progress, sign out and back in. Your completed work, postponement, and adaptation history remain.

The exact generated titles differ in live Bedrock mode; the same hierarchy, transitions, filters, and scoring apply.

## MVP limits

- Local AI is a fixture and local auth is development-only. AWS runtime integration is implemented but requires account-level deployment verification.
- Workspace loading reads the bounded user's partition; history has no archival/paginated UI yet. This is suitable for the MVP, not unbounded enterprise usage.
- Replanning is user-triggered with visible signals, and affects up to eight unfinished leaf tasks per proposal. It has no background scheduler and does not automatically rewrite plans.
- No full calendar, external integrations, collaboration, advanced analytics, or password recovery screen. Cognito email account recovery is configured for future UI support.
- Browser tests cover the local path; cloud acceptance testing remains separate.

Reference documentation used: [Next.js cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), [CDK Cognito HTTP authorizer](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigatewayv2_authorizers.HttpUserPoolAuthorizer.html).

Hosting compatibility reference: [Amplify supported Next.js versions](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-amplify-support.html).

Amplify reserves variable names beginning with `AWS`. Do not manually add `AWS_REGION` in Amplify. The build helper derives it from `COGNITO_USER_POOL_ID` and writes it into the server runtime configuration. Set `AWS_REGION` normally in your local `.env.local` and deployment shell.
