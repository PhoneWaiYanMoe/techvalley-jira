# API Contract — TechValley Jira Lite MVP

Draft contract for Next.js API routes. Claude Code should implement against
this and keep it updated as routes get built (this doc, not the other way
around, once code exists — treat mismatches as the doc being stale).

## Conventions

- **Auth**: Supabase session (JWT in `Authorization: Bearer <token>` or
  Supabase's auth cookie, App Router server-side). All routes below require
  auth unless marked public.
- **Errors**: `{ "error": { "code": string, "message": string } }`
  - `401` not authenticated · `403` authenticated but not permitted (FR-070)
  - `404` resource doesn't exist **or** belongs to a team you're not in (FR-070 — never leak existence via 403 across teams)
  - `422` validation failure · `429` rate limited (AI endpoints, FR-042)
- **Pagination**: `?cursor=<id>&limit=20` → `{ "data": [...], "nextCursor": string | null }`
  used for issue list, comment list, activity log, notifications.
- **Soft delete**: DELETE endpoints never hard-delete; they set `deleted_at`.
  All GET/list endpoints filter `deleted_at is null` implicitly.
- **Ownership tag** on each endpoint below = who implements/maintains it per `task-division.md`.

---

## Dev A — Auth, Profile, Teams, Invites, Activity, Notifications, Dashboards

### Auth & Profile
Signup/login/Google OAuth/password reset go through the Supabase Auth JS
client directly from the frontend — no custom API route needed for those
(FR-001..004). Custom routes only for what Supabase doesn't cover:

| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| GET | `/api/profile` | — | `{ id, name, profileImage, email }` | FR-005 |
| PATCH | `/api/profile` | `{ name?, profileImage? }` | updated profile | FR-005 |
| PATCH | `/api/profile/password` | `{ currentPassword, newPassword }` | `204` | FR-006 (disabled for OAuth-only users → `422`) |
| DELETE | `/api/profile` | `{ password? }` (omit for OAuth users) | `204` | FR-007 (`409` if owned teams exist) |

### Teams
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/teams` | `{ name }` | team | FR-010 |
| GET | `/api/teams` | — | teams current user belongs to | FR-021-adjacent |
| GET | `/api/teams/:teamId` | — | team detail | — |
| PATCH | `/api/teams/:teamId` | `{ name }` | updated team | FR-011 (OWNER/ADMIN) |
| DELETE | `/api/teams/:teamId` | — | `204` | FR-012 (OWNER only) |
| GET | `/api/teams/:teamId/members` | — | `{ data: [{ userId, name, email, role, joinedAt }] }` | FR-014 |
| DELETE | `/api/teams/:teamId/members/:userId` | — | `204` | FR-015 (kick; role-scoped) |
| POST | `/api/teams/:teamId/leave` | — | `204` | FR-016 (not OWNER) |
| PATCH | `/api/teams/:teamId/members/:userId/role` | `{ role }` | updated member | FR-018 (OWNER only; transfer-owner sets old owner to ADMIN) |

### Invites
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/teams/:teamId/invites` | `{ email, role }` | invite | FR-013 |
| GET | `/api/teams/:teamId/invites` | — | pending invites (OWNER/ADMIN view) | FR-013 |
| POST | `/api/teams/:teamId/invites/:inviteId/resend` | — | invite (new `expiresAt`) | FR-013 |
| GET | `/api/invites/mine` | — | invites pending for current user's email | FR-013 |
| POST | `/api/invites/:inviteId/accept` | — | `{ teamId }` | FR-013 |

### Activity & Notifications
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| GET | `/api/teams/:teamId/activity?cursor=&limit=` | — | paginated activity log | FR-019 |
| GET | `/api/notifications?cursor=&limit=` | — | paginated, includes `unreadCount` | FR-090 |
| PATCH | `/api/notifications/:id/read` | — | `204` | FR-091 |
| PATCH | `/api/notifications/read-all` | — | `204` | FR-091 |

### Dashboards
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| GET | `/api/dashboard/personal` | — | my issues by status, due soon/today, recent comments, my teams/projects | FR-081 |
| GET | `/api/teams/:teamId/stats?period=7\|30\|90` | — | creation/completion trend, per-member breakdown | FR-082 |

---

## Dev B — Projects, Issues, Kanban, Comments, AI

### Projects
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/teams/:teamId/projects` | `{ name, description? }` | project | FR-020 (`422` if 15/team hit) |
| GET | `/api/teams/:teamId/projects` | — | list, favorites-first then by date | FR-021 |
| GET | `/api/projects/:projectId` | — | project + issue counts by status | FR-022 |
| PATCH | `/api/projects/:projectId` | `{ name?, description? }` | updated project | FR-023 |
| DELETE | `/api/projects/:projectId` | — | `204` | FR-024 |
| PATCH | `/api/projects/:projectId/archive` | `{ archived: boolean }` | updated project | FR-026 |
| POST | `/api/projects/:projectId/favorite` | `{ favorite: boolean }` | `204` | FR-027 |
| GET | `/api/projects/:projectId/dashboard` | — | status/priority breakdown, completion rate, recent + due-soon issues | FR-080 |

### Statuses (kanban columns) & Labels
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| GET | `/api/projects/:projectId/statuses` | — | ordered columns incl. `wipLimit` | FR-033/053 |
| POST | `/api/projects/:projectId/statuses` | `{ name, color?, position }` | status | FR-053 (`422` if 5 custom hit) |
| PATCH | `/api/statuses/:statusId` | `{ name?, color?, position?, wipLimit? }` | updated status | FR-053/054 |
| DELETE | `/api/statuses/:statusId` | — | `204`, issues moved to Backlog | FR-053 |
| GET | `/api/projects/:projectId/labels` | — | labels | FR-038 |
| POST | `/api/projects/:projectId/labels` | `{ name, color }` | label | FR-038 (`422` if 20/project hit) |
| PATCH | `/api/labels/:labelId` | `{ name?, color? }` | updated label | FR-038 |
| DELETE | `/api/labels/:labelId` | — | `204` | FR-038 |

### Issues
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/projects/:projectId/issues` | `{ title, description?, assigneeUserId?, dueDate?, priority?, labelIds? }` | issue | FR-030 (`422` if 200/project hit) |
| GET | `/api/projects/:projectId/issues?status=&assignee=&priority=&label=&hasDueDate=&dueFrom=&dueTo=&search=&sort=&cursor=` | — | paginated issue list, incl. `total` (for the x/200 counter; filters/sort land with FR-036) | FR-036 |
| GET | `/api/issues/:issueId` | — | full detail incl. subtasks, labels, comment count | FR-031 |
| PATCH | `/api/issues/:issueId` | any editable field | updated issue (writes `issue_history` per changed field) | FR-032/039 |
| DELETE | `/api/issues/:issueId` | — | `204` | FR-035 |
| PATCH | `/api/issues/:issueId/move` | `{ statusId, position }` | `204` | FR-051/052 (dedicated endpoint for drag-drop, avoids full PATCH payload) |
| GET | `/api/issues/:issueId/history?cursor=` | — | paginated change log | FR-039 |

### Subtasks
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/issues/:issueId/subtasks` | `{ title }` | subtask | FR-039-2 (`422` if 20/issue hit) |
| PATCH | `/api/subtasks/:subtaskId` | `{ title?, isCompleted?, position? }` | updated subtask | FR-039-2 |
| DELETE | `/api/subtasks/:subtaskId` | — | `204` | FR-039-2 |

### Comments
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| GET | `/api/issues/:issueId/comments?cursor=&limit=` | — | paginated, chronological | FR-061 |
| POST | `/api/issues/:issueId/comments` | `{ content }` | comment | FR-060 |
| PATCH | `/api/comments/:commentId` | `{ content }` | updated comment | FR-062 (author only) |
| DELETE | `/api/comments/:commentId` | — | `204` | FR-063 |

### AI (all rate-limited per FR-042: `429` + `Retry-After` header when exceeded)
| Method | Path | Body | Response | FR |
|---|---|---|---|---|
| POST | `/api/issues/:issueId/ai/summary` | — | `{ summary }`, cached until description changes | FR-040 (`422` if description ≤10 chars) |
| POST | `/api/issues/:issueId/ai/suggestion` | — | `{ suggestion }`, same caching | FR-041 |
| POST | `/api/projects/:projectId/ai/auto-label` | `{ title, description }` | `{ labelIds: [] }` (max 3, from existing project labels) | FR-043 |
| POST | `/api/projects/:projectId/ai/duplicate-check` | `{ title }` | `{ similarIssues: [{ id, title, similarity }] }` (max 3) | FR-044 |
| POST | `/api/issues/:issueId/ai/comment-summary` | — | `{ summary, keyDecisions? }`, cached until new comment added | FR-045 (`422` if <5 comments) |

---

## Cross-cutting middleware (either dev, whoever builds it first)

- Team-membership guard: resolve `teamId` for the requested resource, check
  `team_members` before touching data; return `404` if not a member (FR-070).
- Rate-limit guard for `/api/*/ai/*`: query `ai_request_logs`, enforce
  10/min and 100/day per user (FR-042).
- Zod (or similar) validation matching the length/enum limits in `schema.sql`
  and the PRD's data-limits table — reject with `422` before hitting the DB.
