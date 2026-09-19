# API contract

The browser uses `/api/*` on the frontend. AWS forwards application routes to API Gateway with a Cognito access token. All private endpoints derive identity from the session/JWT. A payload `userId` never grants access. Mutation requests to the BFF require the configured `Origin`.

| Method | Path                       | Body / result                                                                                                            |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth/signup`             | email, password, name → local session or `{confirm:true}`                                                                |
| POST   | `/auth/confirm`            | email, code → verification                                                                                               |
| POST   | `/auth/signin`             | email, password → HTTP-only session                                                                                      |
| POST   | `/auth/refresh`            | refresh session cookie → renewed access cookie                                                                           |
| POST   | `/auth/signout`            | revoke session, clear cookies                                                                                            |
| POST   | `/auth/forgot`             | email → `{sent:true}` whether or not the account exists; a reset link is mailed only to a real account                   |
| POST   | `/auth/reset`              | email, code, password, confirm → `{ok:true}`; rejects a mismatched confirm, consumes the code, revokes existing sessions |
| GET    | `/workspace`               | goals, checkIns, recommendations, events, adaptations                                                                    |
| GET    | `/goals`                   | Goal[]                                                                                                                   |
| POST   | `/goals`                   | title, description?, deadline?, priority? → saved draft                                                                  |
| GET    | `/goals/:id`               | Goal                                                                                                                     |
| PATCH  | `/goals/:id`               | revision, details?, plan?, status? → Goal                                                                                |
| POST   | `/planning/:goalId`        | {} → saved validated draft plan                                                                                          |
| POST   | `/check-ins`               | availableMinutes, energy, interest? → CheckIn                                                                            |
| POST   | `/recommendations`         | exclude?: [goalId_taskId], previousId? → recommendation or null + message                                                |
| POST   | `/execution`               | goalId, taskId, action, requestId, recommendationId?, reason?, actualMinutes?, postponedUntil? → ExecutionEvent          |
| POST   | `/adaptations/:goalId`     | reason → proposed Adaptation                                                                                             |
| POST   | `/adaptations/:id/accept`  | {} → updated Goal; atomic history update                                                                                 |
| POST   | `/adaptations/:id/dismiss` | {} → {ok:true}                                                                                                           |

Shared field definitions: `src/domain/schema.ts`. Energy: low, medium, high. Action: start, complete, skip, postpone. Dates are ISO date strings; timestamps include UTC `Z`. Empty optional deadlines must be `null`. All request IDs and resource IDs use letters, digits, underscores or hyphens (max 80 characters). Recommendation exclusion tokens join goal and task IDs with `_`.

Successful operations currently return HTTP 200. Errors use `{error:{code:number,message:string}}`: 400 validation, 401 authentication, 403 origin, 404 inaccessible/not found, 409 conflict/state, 413 oversized body, 502 invalid/unavailable AI, 500 sanitized infrastructure failure. `requestId` makes execution retries idempotent for the same authenticated user. Other writes rely on explicit revisions; after a 409 refresh before retrying.

A plan consists of `phases` and flat `tasks`; microtasks reference `parentTaskId`. Only leaf tasks are executed. Phase/root completion and overall progress derive from leaf completion, without duplicate state transitions. Goal revisions are incremented on plan edits, details/status edits, execution, and accepted adaptation. Adaptation proposals include `baseRevision` and cannot be accepted after another change.
