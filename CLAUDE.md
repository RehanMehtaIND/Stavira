# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev            # next dev on 127.0.0.1:3000 (distDir .next-dev)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm test               # node:test via tsx over tests/*.test.ts (NOT tests/e2e)
npm run build          # next build (distDir .next)
npm run infra:synth    # cdk synth — synthesis only, provisions nothing
npm run format         # prettier --write .
```

Single test / filtered test (the `test` script's glob excludes `tests/e2e/`):

```sh
npx tsx --test tests/domain.test.ts
npx tsx --test --test-name-pattern="duration calibration" tests/domain.test.ts
```

E2E requires a separately running dev server — `playwright.config.ts` has no `webServer`:

```sh
npm run dev                        # in another terminal
npx playwright install chromium    # first run only
npm run test:e2e
```

The hostname matters: `APP_ORIGIN` must exactly match what the browser sends, and both `dev` and `start` bind `127.0.0.1` (not `localhost`). A mismatch fails every mutation with 403 from [http.ts](src/server/http.ts).

## Two-mode runtime

`STAVIRA_MODE` (`local` | `aws`) selects adapters in [runtime.ts](src/server/runtime.ts): `LocalRepository` + `LocalDevelopmentAIProvider`, or `DynamoRepository` + `BedrockAIProvider`. [config.ts](src/server/config.ts) hard-refuses local adapters when `NODE_ENV=production`, and defaults to `aws` in production.

The two modes take **different request paths** through [api/[...path]/route.ts](src/app/api/[...path]/route.ts):

- **local** — the route authenticates against SQLite, then calls `service().handle(...)` in-process. No AWS calls.
- **aws** — the route authenticates the Cognito JWT, then _proxies_ the request to API Gateway with the access token. `Service` is never constructed; the Amplify runtime therefore needs no DynamoDB or Bedrock IAM permissions.

So in AWS mode the same domain handler code runs inside Lambda instead, via [functions/shared.ts](functions/shared.ts). **This is the central constraint on `src/server/domains/*`: those handlers execute in both Next.js and Lambda, so they must not import `next/headers`, `next/navigation`, or anything Next-specific.** Request-scoped concerns (cookies, origin checks, Cognito) live in [auth.ts](src/server/auth.ts) and [http.ts](src/server/http.ts), which are BFF-only.

## Adding or changing an API endpoint

A new route needs four coordinated edits, or it 404s in one mode but not the other:

1. Write/extend the handler in [src/server/domains/](src/server/domains/) (a `DomainHandler` — it dispatches on `method` and the parsed `path` segments itself).
2. Register the first path segment in the `handlers` map in [service.ts](src/server/service.ts) — this is the local-mode router.
3. Add the segment to the `domains` allowlist in the relevant [functions/*.ts](functions/) entry point — `handlerFor` rejects any operation not listed.
4. Add it to the matching `groups` entry in [infrastructure/app.ts](infrastructure/app.ts), which creates the API Gateway routes (`/x` and `/x/{proxy+}`) and the Lambda's IAM policy.

`context` intentionally serves two segments (`workspace`, `check-ins`) from one Lambda. Only the three AI groups (`planning`, `recommendations`, `adaptation`) are constructed with a `BedrockAIProvider` and granted `bedrock:InvokeModel`; `ServiceContext.ai` throws for the others, so a non-AI domain cannot quietly acquire AI access.

Also update [docs/API.md](docs/API.md), which is the maintained contract table.

## Persistence contract

[repositories/types.ts](src/server/repositories/types.ts) is a deliberately tiny three-method interface — `list`, `get`, `commit` — and `commit` is the **only** write path. Both implementations honor the same rules:

- Every write carries `expectedRevision`; `0` means create. Mismatch → `AppError(409, 'This work changed in another session...')`. Dynamo uses `attribute_not_exists(PK)` / `revision = :revision` conditions, SQLite uses `BEGIN IMMEDIATE` plus an explicit revision read.
- A `commit` is all-or-nothing (`TransactWriteCommand` / SQLite transaction). Related goal + event + recommendation writes go in one call so execution can never half-apply.
- `list(userId)` returns the user's **entire** partition, paginated internally and strongly consistent. [workspace.ts](src/server/workspace.ts) buckets it by `kind`. Any domain needing cross-goal state calls `workspace()` rather than issuing per-goal reads.
- Owner scoping is structural: `PK=USER#<sub>`, and `ServiceContext.get` always passes the authenticated user. A `userId` in a request body is never read (asserted in [tests/api.test.ts](tests/api.test.ts)).

A goal is a **single bounded aggregate** — its phases and flat task list live in one record, capped at 100 tasks / 20 phases / 120 KB of JSON. There is no separate task record, so any task change is a goal revision bump.

`LocalRepository` opens and closes a fresh `node:sqlite` connection per operation and creates its schema idempotently in `localDb()`, which is also where the local `users`/`sessions` tables live.

## Where the invariants are enforced

Domain rules live in [src/domain/schema.ts](src/domain/schema.ts) and are re-checked on every write — never assume a caller (or the model) already validated:

- `validatePlan()` — Zod parse, size cap, unique IDs, phase existence, two-level hierarchy only (a microtask's parent must be an incomplete root in the same phase), dependency sanity, and a DFS cycle check that walks task deps, **inherited parent deps, and implicit parent→child edges**.
- `leaves()` / `isDone()` / `progress()` — only leaf tasks are executable; root and phase completion is _derived_, never stored. Goal status flips to `completed` automatically at 100%.
- `ready()` — the single eligibility predicate (active goal, not completed/blocked, parent not blocked/postponed, postponement elapsed, own + inherited deps done). Used by both [recommendation.ts](src/domain/recommendation.ts) and [execution.ts](src/server/domains/execution.ts).

Completed work is immutable, and the checks are spread across handlers: `goals` PATCH rejects any edit that changes a completed task or that manufactures execution state (status/timestamps must go through `/execution`, new tasks must be `pending`); `adaptation` re-checks on accept; `planning` only regenerates untouched drafts.

## The determinism boundary

**No LLM chooses a task.** `rank()` in [recommendation.ts](src/domain/recommendation.ts) is a pure weighted sum of nine normalized factors (weights in the `WEIGHTS` table there), with deterministic tie-breaks on `order` then task ID. It also derives the two behavioral signals from event history: per-category duration ratio clamped to 0.5–2×, and recent same-task skips in the same energy context.

The three `AIProvider` methods have narrow, validated roles ([ai/provider.ts](src/server/ai/provider.ts), [ai/bedrock.ts](src/server/ai/bedrock.ts)):

- `plan` — output goes through `validatePlan` before persistence; the draft survives a failure for retry.
- `explain` — the model returns only **indices into deterministic evidence sentences** the app generated. The app renders its own sentences, so the model cannot state an unsupported reason; on failure it falls back to the first two sentences directly.
- `adapt` — may only touch unfinished leaf tasks (estimate, energy, priority, or an added prerequisite). Proposals store `baseRevision` and are rejected on accept if the goal moved.

`BedrockAIProvider.structured()` centralizes the Converse call: JSON Schema from `z.toJSONSchema`, one controlled repair retry, and a 23-second budget so a failure returns before the 28-second Lambda timeout.

## Auth and session handling

Tokens never reach client JavaScript. Cookies `stavira_session` / `stavira_refresh` / `stavira_name` are `httpOnly` + `SameSite=Lax`, set only by [auth.ts](src/server/auth.ts). In AWS mode the BFF forwards the access token as a bearer header; Lambda derives identity solely from `event.requestContext.authorizer.jwt.claims.sub`.

Client fetches go through [components/api.ts](src/components/api.ts), which transparently retries once through `/api/auth/refresh` on a 401 and otherwise redirects to `/signin`. `/session` ([app/session/page.tsx](src/app/session/page.tsx)) is the server-side landing page for the same recovery. The `(workspace)` group layout is `force-dynamic` and redirects to `/session` when `authenticate()` throws.

Local auth (scrypt + hashed opaque session tokens) is development-only by design and is unreachable in production.

## Client conventions

Screens are thin: `src/app/**/page.tsx` renders a component from [src/components/](src/components/). Data loading is one `useWorkspace()` hook fetching `GET /workspace` and a `reload()` after mutations — there is no client cache or store, and database state is authoritative.

Styling is a single ~2000-line [globals.css](src/app/globals.css) with semantic class names and CSS custom properties. **No Tailwind, no CSS modules, no CSS-in-JS** — add classes there rather than introducing a styling dependency. Icons come from `lucide-react`.

## Conventions and gotchas

- Prettier: single quotes, trailing commas, 100 columns. The existing code is intentionally very compact (few blank lines, no decorative comments) — match it.
- `next.config.ts` exports a _function_ of `phase` so dev and prod use different `distDir`s (`.next-dev` / `.next`). Keep both in the ESLint and Prettier ignore lists.
- `node:sqlite` is in `serverExternalPackages`; the `localDb()` resolve carries a `turbopackIgnore` comment. Don't let the local adapter get bundled.
- Errors are sanitized centrally by [errors.ts](src/server/errors.ts): `AppError`/`ZodError` messages are user-facing, everything else becomes a generic 500. Logs carry only operation, status, error type, and request ID — never goal text, passwords, or tokens.
- Pin Next.js deliberately (currently 15.5.25, within Amplify's documented SSR range) and keep the `postcss` override; bumping either has hosting/audit consequences.
- Amplify reserves `AWS_*` variable names, so [scripts/amplify-env.mjs](scripts/amplify-env.mjs) derives `AWS_REGION` from the Cognito pool ID prefix and writes only an allowlist to `.env.production`. Never add credentials to that list.
- `infra:synth` and `cdk deploy` are not equivalent — synthesis is verified locally, but live Cognito email, Bedrock access, and Amplify runtime behavior remain unverified deployment steps (see [docs/VALIDATION.md](docs/VALIDATION.md)).
- Recommendation exclusion tokens are `${goalId}_${taskId}`; all IDs match `/^[a-zA-Z0-9_-]{1,80}$/`.
