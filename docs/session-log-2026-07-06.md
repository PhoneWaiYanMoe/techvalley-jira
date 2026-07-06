# Session Log — 2026-07-06 (Dev B, Day 2 — Issues core)

## Overview

Implemented **Issues core** (FR-030, FR-031, FR-032, FR-033 partial, FR-034, FR-035) per
`docs/timeline.md` Dev B Day 2, mirroring the Project feature's architecture exactly
(thin routes → service → DTO). Also fixed two integration issues found along the way
(stale `node_modules` with Next 9; members-endpoint response shape) and cleared the
known `react-hooks/set-state-in-effect` lint errors flagged in CLAUDE.md.

---

## What was built

### 1. Validation & Types

| File | What |
|---|---|
| `src/validation/issue.schema.ts` | `createIssueSchema` (title 1–200, desc ≤5000, assignee uuid, dueDate `YYYY-MM-DD`, priority enum), `updateIssueSchema` (all optional; `description`/`assigneeUserId`/`dueDate` nullable to clear) |
| `src/types/api.ts` | Added `IssueStatusOption`, `IssueResponse`, `IssueListResponse` (incl. `total` for the x/200 counter), `IssueDetailResponse` (incl. server-computed `canDelete`, `subtasks`, `labels: []`, `commentCount`) |

### 2. Service — `src/lib/issue/issue.service.ts`

- `requireProjectAccess` / `requireIssueAccess` — 404 for missing/deleted **and** for
  non-team-members (FR-070, never 403 across teams); reuses Dev A's
  `requireTeamMembership` + `isOwnerOrAdmin`.
- `createIssue` (FR-030): 422 `ISSUE_LIMIT` at 200/project; 422 `PROJECT_ARCHIVED` on
  archived projects; assignee validated as team member (422 `INVALID_ASSIGNEE`, FR-034);
  status = lowest-position seeded default (Backlog); `position` = max+1 in column.
- `listIssues`: keyset cursor pagination (`created_at desc, id desc`), returns `total`.
- `getIssueDetail` (FR-031): status/assignee/creator resolved, real subtask +
  comment-count queries (UIs land Day 4/5), `canDelete` computed server-side.
- `updateIssue` (FR-032, any team member): statusId must belong to the project
  (422 `INVALID_STATUS`, FR-033); moving status re-positions to end of target column;
  **writes `issue_history` rows per changed tracked field** (status/assignee/priority/
  title/due_date, display-friendly old/new values) — FR-039's Day 4 history tab will
  have real data from day one. Archived projects → 422.
- `deleteIssue` (FR-035): issue creator, project owner, or team OWNER/ADMIN; soft delete.

### 3. API Routes

| Method | Route | FR |
|---|---|---|
| POST/GET | `/api/projects/[projectId]/issues` | FR-030 / list (FR-036 filters pending) |
| GET/PATCH/DELETE | `/api/issues/[issueId]` | FR-031 / FR-032+039 / FR-035 |
| GET | `/api/projects/[projectId]/statuses` | FR-033 (CRUD lands with FR-053, Day 3) |

### 4. UI

- `components/projects/ProjectTabs.tsx` — project sub-nav (Dashboard | Issues; Board
  slot reserved for Day 3), wired into `ProjectDashboardPage` and both new pages.
- `/projects/[projectId]/issues` (`IssuesPageClient`) — row list (priority dot, title,
  assignee avatar, status pill, due badge), x/200 counter, Load more, archived notice,
  New issue button (hidden when archived, disabled at limit).
- `components/issues/CreateIssueModal.tsx` — title/desc/priority/due/assignee; assignee
  options from `GET /api/teams/:teamId/members` (FR-034).
- `/projects/[projectId]/issues/[issueId]` (`IssueDetailClient`) — two-column detail:
  click-to-edit title, description editor, Subtasks/Comments placeholder cards, disabled
  AI buttons (Day 5); sidebar selects for status/assignee/priority/due (optimistic PATCH
  with revert); Danger-zone delete only when `canDelete`; fully read-only when archived.
- `components/issues/IssueBadges.tsx` — shared `StatusPill`/`PriorityDot`/`DueBadge`
  (same colors/classes as `ProjectDashboard`'s local helpers).

---

## Fixes outside the day's scope

1. **Stale `node_modules` had Next 9.3.3 installed** (leftover from the `555b9f3`
   package.json accident) even though `package.json`/lockfile were already fixed —
   builds failed with a Next-9 error. Fixed with `npm ci`. If your build errors look
   ancient, check `node -p "require('next/package.json').version"` first.
2. **`GET /api/teams/:teamId/members` returns `{ data: [...] }`**, not a bare array as
   `docs/api.md` claimed — updated `api.md` (doc follows code).
3. **`react-hooks/set-state-in-effect` lint errors cleared repo-wide** — the two known
   offenders from CLAUDE.md (`ProjectsPageClient`, `ProjectDashboard`) plus the two new
   pages now use a `void (async () => { await load(); })()` effect body, which satisfies
   the rule. `npx eslint .` is now 0 errors / 0 warnings.

## Note for Eric

- `origin/main` still has the Next 9 downgrade (PR #3 merged `555b9f3`); the fix only
  exists on `dev/Eric`/`dev/akp`. Needs a PR to main before any Vercel deploy.
- E2E seed data left in the live DB for reuse in Day 3 kanban testing: team
  "AKP E2E Team (day2)", project "Day2 Issues E2E", users `akp.e2e.{owner,admin,creator,member,outsider}@techvalley.test`.
- FR-090 notification triggers (your Day 5): issue assignment happens in
  `createIssue`/`updateIssue` in `src/lib/issue/issue.service.ts` — hook in there.

## Verification

- `npm run build` ✓ (all 3 new routes + 2 new pages registered), `npx eslint .` ✓ clean.
- Scratch-Playwright E2E (headless Chromium against `npm run dev`, direct DB asserts via
  service role): **20/20 passed** — modal create, Backlog+MEDIUM defaults, detail render,
  inline title edit, status/assignee/priority persistence, `issue_history` rows per
  field, 422 invalid assignee/status, `canDelete=false` + hidden delete UI + 403 for
  non-creator MEMBER, MEMBER can still edit, 404 for outsiders (FR-070), creator/ADMIN
  delete paths + soft-delete verified, deleted issue 404s, archived project blocks
  create + read-only UI.
- 200-issue limit: bulk-seeded to 199 live issues → #200 created (201), #201 rejected
  (422 `ISSUE_LIMIT`), UI shows 200/200 with disabled button; bulk rows cleaned up.

## Known gaps (deliberate, per timeline)

- Issue list has no search/filter/sort yet (FR-036, Day 4) and labels are absent
  everywhere (FR-038, Day 4) — `labels: []` in the detail DTO reserves the shape.
- Subtasks/comments/AI are placeholder cards (Day 4/5).
- No kanban board yet (Day 3); status changes work via the detail page (FR-033's
  "detail screen" path).
