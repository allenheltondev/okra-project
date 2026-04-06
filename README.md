# Okra Project

A simple, maintainable web app for Olivia's Garden Foundation to show where Clemson Spineless Okra seeds are being grown around the world.

## Goals (MVP)

- Public submission form for growers to share:
  - relative location (map pin)
  - at least one photo (required)
  - optional name and story
  - optional email for a secure edit link
- Admin review queue to approve or deny submissions.
- Public world map showing **approved** submissions only.
- Clickable pins that show photos and optional details.

## Non-goals (MVP)

- No advanced alerting/monitoring workflows.
- No complex role systems.
- No heavy analytics stack.

## Tech Stack (AWS, Node.js 24)

- **Frontend:** Vite + React (static build)
- **Hosting:** S3 + CloudFront
- **API:** API Gateway HTTP API + Lambda (Node.js 24)
- **Database:** Aurora DSQL
- **Auth:** Cognito (optional for non-admin in later phase; admin-ready)
- **Storage:** S3 for image originals + normalized derivatives
- **Image Processing:** Lambda (Node.js 24 + sharp)

## Engineering Baseline (match Good Roots Network style)

- Use **AWS SAM** templates for backend/API/image-processor infrastructure.
- Use **esbuild** for Lambda bundling.
- Include **linting + unit tests** from day one.
- Keep one-repo, one-person-operable workflows (minimal moving parts).
- Prefer explicit env/config outputs over hidden/manual config.

## Cognito Reuse Strategy

- Reuse the **existing Good Roots Network Cognito User Pool** where applicable.
- Infrastructure should support either:
  - importing pool/client IDs as parameters, or
  - reading them from stack exports/SSM parameters.
- For MVP, admin access should work with shared user pool claims/groups.

## Repository Layout

- `frontend/` - Vite + React app (S3/CloudFront deploy target)
- `backend/` - Lambda handlers + tests + linting + SAM template
- `db/ddl.sql` - Aurora DSQL schema for MVP
- `docs/issues.md` - dependency-ordered issue plan

## Quick Start

```bash
npm install
npm run lint
npm run test
```

Backend local invoke example:

```bash
cd backend
sam build
sam local invoke HealthFunction
```

Deploy stack (creates API + frontend/media buckets + CloudFront):

```bash
cd backend
sam deploy --guided
```

For GitHub deploy workflows, add repository secrets:

- `AWS_DEPLOY_ROLE_STAGE` (PR preview/staging deploys)
- `AWS_DEPLOY_ROLE` (main production deploys)

Branch/environment behavior:

- Pull requests -> isolated preview stack: `okra-project-preview-pr-<PR_NUMBER>` (auto-created and auto-deleted on PR close)
- Push to `main`/`master` -> production stack: `okra-project-prod`

Region is hard-coded as `us-east-1`.

## Runtime Baseline

- Node.js: **24.x** for all Lambda functions and tooling.
- Keep architecture boring and solo-maintainable.
- Default backend toolchain: SAM + esbuild + eslint + unit tests.
