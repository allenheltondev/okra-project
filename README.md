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

## MVP Product Flows

### 1) Public Submit

1. User fills form with map location and optional details.
2. App requests upload intent from API.
3. App uploads image directly to S3 with pre-signed URL.
4. Submission enters `pending_review`.
5. Image processor normalizes/transcodes image.

### 2) Admin Review

1. Admin signs in.
2. Views pending submissions.
3. Approves or denies each submission.
4. Optional: adjusts display pin before approval.

### 3) Public Map

- Show approved submissions on a world map.
- Clicking a pin opens card/gallery with approved details.

## Privacy Model (MVP)

- Users choose display precision:
  - `exact`
  - `nearby`
  - `neighborhood`
  - `city`
- Public map uses only display-safe coordinates.
- Raw location text is private (admin/internal only).

## Repository Layout

- `db/ddl.sql` - Aurora DSQL schema for MVP
- `docs/issues.md` - dependency-ordered issue plan

## Issue Plan

See `docs/issues.md` for implementation order and dependencies.

## Runtime Baseline

- Node.js: **24.x** for all Lambda functions and tooling.
- Keep architecture boring and solo-maintainable.
