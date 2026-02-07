# Contributing

## Workflow Summary
This repository uses issue-driven development for V1 delivery.

- One issue per PR.
- Keep PR scope limited to the issue acceptance criteria.
- Link each PR to its issue using `Closes #<issue-number>`.
- If blocked by dependencies, comment on the issue and stop.

## Setup Before Parallel Agent Work
Complete these checks before agents start implementation:

- `main` is up to date and passing CI.
- Pull requests are required for `main` (no direct pushes).
- Required status checks are enabled (build, test, lint).
- Branch must be up to date with `main` before merge.
- CI secrets/env values required for tests are configured.
- Local/dev database setup instructions are accurate.

Optional but recommended:

- Create a baseline tag before parallel work starts (example: `pre-v1-agents`).

## Agent Lane Model
Use separate lanes to reduce merge conflicts:

- Backend A: DB foundation + random/by-id APIs.
- Backend B: validation + admin ingestion + API integration tests.
- Frontend: home flow + share page + UX states.
- Data/Release: seed dataset + seed pipeline + release checklist.

Each lane should process issues in dependency order.

## Pull Request Requirements
Every PR must include:

- Linked issue (`Closes #...`).
- What changed (short summary).
- Test evidence (commands + results).
- Verification steps (how reviewer can validate behavior).
- Screenshots/GIFs for UI changes.
- Migration notes for DB/API schema changes.

## Review and Merge Gates
Additional human-review gates:

- Database schema or migration changes require explicit approval.
- Admin auth/security changes (for `x-admin-key`) require explicit approval.

Merge only when:

- Required checks pass.
- Review comments are resolved.
- Branch is up to date with `main`.

## Branch and Commit Conventions
- Use branch names prefixed with `codex/` for implementation work.
- Keep commits focused and descriptive.
- Do not force-push after review starts unless requested by reviewer.

## Final Release Pass
After all milestone issues are merged:

- Run the smoke-test checklist.
- Confirm random workout flow, share page, admin ingestion, and seed data behavior.
- Validate required environment variables are documented (`DATABASE_URL`, `ADMIN_API_KEY`).
