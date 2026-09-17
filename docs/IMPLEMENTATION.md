# Implementation checklist and decisions

- [x] Account creation, confirmation, sessions and isolated persisted workspaces
- [x] Goals, schema-validated planning and editable hierarchy
- [x] Context check-ins and deterministic recommendations
- [x] Start, complete, skip, postpone, alternative and execution history
- [x] Behavioral duration/skip learning and reviewable adaptation
- [x] Goal/phase progress and responsive product screens
- [x] AWS CDK, deployment instructions, tests, production build and browser flow

Assumptions: only leaf tasks are executable; task/phase progress derives from leaves. Dependencies are local to a goal and must form a DAG. Maximum 100 nodes per goal and 20 phases keeps MVP plans reviewable. Completed nodes cannot be deleted or rewritten. Plan edits use optimistic revisions. Local development uses SQLite and password hashing; deployed authentication uses Cognito, with no production local fallback. AWS resources will be synthesized and deployment attempted only if usable account configuration is available. Bedrock explanations select validated evidence sentences to prevent invented factors. No calendar, scheduler or object storage is needed.

Cloud deployment status: CDK synthesis is complete; no resources were deployed because AWS credentials are unavailable. Live Bedrock/Cognito/Amplify verification remains a deployment acceptance step.
