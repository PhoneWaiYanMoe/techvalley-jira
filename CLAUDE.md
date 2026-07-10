@AGENTS.md

# TechValley Jira Lite MVP — Project Context

Single source of truth for this project across Claude Code and Claude Desktop/Cowork.
When this file changes, re-paste it into the claude.ai Project's knowledge base
(see `claude/claude-sync-workflow.md` if present, or ask the maintainer) — there is
no automatic sync between the two.

## Tech stack

- **Framework**: Next.js 16 (App Router, `src/` dir, TypeScript, ESLint) — scaffolded
  via `create-next-app`. Note: `AGENTS.md` above flags this as a Next.js version with
  breaking changes vs. training data — check `node_modules/next/dist/docs/` before
  writing framework-specific code.
  - **Known breaking change**: `middleware.ts` is deprecated and renamed to
    `proxy.ts` in Next.js 16 (exported function is `proxy`, not `middleware`). The
    Day 1 "protected route middleware / auth guard" task must use `proxy.ts`, not
    `middleware.ts` — the old convention silently won't run.
- **Styling**: Tailwind CSS v4 (no `tailwind.config.js` — config lives in
  `postcss.config.mjs` / CSS, this is expected for v4, not a missing file).
- **DB / Auth**: Supabase (Postgres 15+, Supabase Auth for email/password + Google
  OAuth — do not roll custom password storage/reset).
- **Deployment**: Vercel.
- **AI provider**: flexible (Claude/GPT/Gemini) — not yet chosen.

## Spec and planning docs

- `PRD.md` — **committed**, full functional spec (FR-001 through FR-091), data limits,
  technical requirements. Authoritative for scope/behavior questions.
- `docs/api.md` — **committed**, draft Next.js API route contract (paths, bodies,
  responses, error codes, pagination shape, ownership per route). Implement against
  this; once a route exists in code, treat mismatches between `api.md` and the code
  as the doc being stale — update `api.md` to match, not the other way around.
- `schema.sql` — **committed** at repo root. Full Supabase Postgres schema, applied to
  the live Supabase project (`hnxbcqbezkypgvpaaddv`) on 2026-07-01. RLS is enabled on
  every table with **no policies defined** — this deny-alls the `anon`/`authenticated`
  roles (blocking direct PostgREST access from the browser's anon key) while the
  `service_role` key (used server-side via `src/lib/supabase/admin.ts`) bypasses RLS
  entirely and remains the actual access-control layer. FR-070 (team membership check,
  404/403 rules) is enforced in Next.js API routes, not via granular RLS policies.
  Once time permits, this should be promoted into a real, committed migration at
  `supabase/migrations/0001_init.sql` per `folder-structure.md` — not yet done as of
  2026-07-01.
- `task-division.md`, `timeline.md`, `folder-structure.md` — present locally at repo
  root but **gitignored, not committed**. Eric shares these with Dev B via Google
  Drive directly, not git. Don't assume they exist on a fresh clone or another dev's
  machine.
  - `task-division.md` — which developer owns which feature slice.
  - `timeline.md` — day-by-day checklist per developer, daily log table.
  - `folder-structure.md` — canonical `src/` layout (App Router routes, `lib/`
    services, `components/`, `validation/`, `types/`) with per-folder ownership tags
    and refactor rules (thin route handlers, one service file per resource,
    centralized permission guard, single AI provider abstraction). Follow this when
    creating new files/folders so both devs' code stays consistent even though the
    doc itself isn't in git.

## Supabase client setup (done)

- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`), for Client
  Components.
- `src/lib/supabase/server.ts` — Server Component / Route Handler client
  (`createServerClient`, async `cookies()` per Next.js 16), respects the current
  user's session/RLS.
- `src/lib/supabase/admin.ts` — service-role client, bypasses RLS. Only call after an
  explicit permission check per FR-070. Never expose `SUPABASE_SERVICE_ROLE_KEY` to
  the client. `lib/permissions/guard.ts` (the general shared guard per
  `folder-structure.md`) still isn't built — Dev B's `lib/team/team.service.ts`
  (`requireTeamMembership`) is filling that role for projects as a stopgap, see
  Day 2 section below.
- `.env.example` documents the required vars (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SITE_URL`, plus placeholders for AI provider and email provider keys
  once chosen). Copy to `.env.local` and fill in real values after creating the
  Supabase project — `.env.local` is gitignored. Already filled in for the live
  project as of 2026-07-01.
- `src/types/db.ts` — **committed**, generated via `supabase gen types typescript`.
  Regenerate after any schema change with:
  `npx supabase gen types typescript --db-url "<session-pooler-URI-with-password>" --schema public > src/types/db.ts`
  — the **direct** connection host (`db.<ref>.supabase.co:5432`) is IPv6-only and
  fails with `ENOTFOUND` on IPv4-only networks; use the **session pooler** URI
  instead (Supabase dashboard → Connect → Session pooler), port 5432,
  `aws-1-ap-southeast-2.pooler.supabase.com` for this project. Requires Docker
  running locally (the CLI pulls `supabase/postgres-meta` to introspect the schema).

## Day 1 — Core auth (done)

- `src/app/(auth)/{layout,login/page,signup/page}.tsx` + `components/auth/{LoginForm,SignupForm,LogoutButton}.tsx`
  — FR-001/002. Signup/login call the Supabase Auth JS client directly (no custom
  API route), per `api.md`.
- **Duplicate-signup UX fix (2026-07-02)**: Supabase never returns an error for a
  signup with an already-registered email (deliberate anti-enumeration behavior) —
  instead it returns `error: null`, `session: null`, and `user.identities: []` (empty
  array). `SignupForm.tsx` checks `identities?.length === 0` to show "This email may
  already be registered..." instead of the misleading "Check your email to confirm"
  notice. Don't rely on `error.message` alone to detect duplicates.
- `src/proxy.ts` + `src/lib/supabase/middleware.ts` — session refresh + route guard
  (redirects unauthenticated requests to `/login`, authenticated requests away from
  `/login`/`/signup`). Remember: Next.js 16 uses `proxy.ts`, not `middleware.ts`.
- `src/app/(app)/layout.tsx` re-checks auth server-side too (defense in depth — Next's
  own docs warn a matcher change could silently remove proxy coverage), then renders
  `components/layout/Navbar.tsx` (extracted per `folder-structure.md`'s
  `components/layout/` convention, not inlined in the layout file). **Superseded
  2026-07-03**: Dev B replaced this globally with `components/layout/Sidebar.tsx` —
  `Navbar.tsx` was deleted (see Day 2 section).
- `src/app/(app)/profile/page.tsx` + `components/profile/{ProfileForm,PasswordChangeForm}.tsx`
  + `src/app/api/profile/route.ts` (GET/PATCH) + `src/app/api/profile/password/route.ts`
  (PATCH) — FR-005/FR-006. Routes are thin (parse/validate → call
  `lib/profile/profile.service.ts` → map to response), per `folder-structure.md`'s
  refactor rules — refactored 2026-07-02 after the first pass put logic directly in
  the route files. `changePassword()` verifies the current password via a throwaway
  anon-key client, then updates via `admin.auth.admin.updateUserById`. Disabled (422)
  for accounts with no `email` identity (Google-only).
- `src/lib/auth/session.ts` — shared `requireUser()` (401 if not logged in). Not the
  same as `lib/permissions/guard.ts` (team-membership 404/403, FR-070) — that's a
  separate concern for once team-scoped resources exist.
- `src/types/api.ts` — response DTOs matching `api.md` (request bodies are covered by
  `validation/*.schema.ts`'s `z.infer` types).
- `src/validation/{auth,profile}.schema.ts`, `src/lib/utils/errors.ts` (shared
  `ApiError` + `{ error: { code, message } }` envelope helper), `src/components/ui/{Button,Input}.tsx`.
- `components/profile/` and `lib/supabase/middleware.ts` aren't explicitly named in
  `folder-structure.md` but are consistent extensions of it (profile forms clearly
  belong to Dev A; the middleware helper is required for `proxy.ts` to work).
- **Bug found + fixed during testing (2026-07-02)**: `handle_new_user()` trigger was
  `SECURITY DEFINER` with no `search_path` set, and referenced `profiles` unqualified.
  `supabase_auth_admin` (the role GoTrue uses to insert into `auth.users`) has its
  `search_path` locked to `auth` only — so every signup 500'd with a generic "Database
  error saving new user" until the function set `search_path = public` and qualified
  the insert as `public.profiles`. Fixed on the live DB and in `schema.sql`.
- **Known constraint**: "Confirm email" is enabled on the Supabase project (Eric's
  choice — only ~2 people will test, so the low free-tier email-send rate limit is
  acceptable). This means signup does NOT auto-login; it queues a confirmation email
  and requires clicking the link before login works. Don't "fix" this by disabling
  email confirmation without checking with Eric first.
- E2E-tested via a scratch Playwright driver (dev server + headless Chromium, since
  neither `chromium-cli` nor a project run-skill existed) — full flow (signup →
  email-confirm notice → login → profile prefill/edit/persist → wrong/right password
  change → logout → protected-route redirect) verified working.

## Day 2 — OAuth, reset, account deletion (done)

- `src/components/auth/GoogleSignInButton.tsx` (used on both login/signup pages) +
  `src/app/auth/callback/route.ts` — FR-004. `signInWithOAuth({ provider: 'google' })`
  redirects to Google, which redirects to Supabase's own callback (configured in
  Google Cloud Console per Day 0), which redirects to our `/auth/callback?code=...`
  Route Handler, which calls `exchangeCodeForSession(code)` (PKCE flow) and redirects
  to `/dashboard`. Not automatable in this environment (needs a real Google login) —
  verify manually: click "Continue with Google" on `/login`, complete the consent
  screen, confirm you land on `/dashboard` with a session.
- `src/components/auth/{ForgotPasswordForm,ResetPasswordForm}.tsx` +
  `(auth)/{forgot-password,reset-password}/page.tsx` — FR-003. Request step calls
  `resetPasswordForEmail()` directly (client-side, no custom API route, matches
  `api.md`'s FR-001..004 note). Always shows the same success message regardless of
  whether the email exists (anti-enumeration, same reasoning as the FR-001 duplicate
  fix).
  - **Real bug found + fixed**: Supabase's recovery email link uses the older
    **implicit/hash-token flow** (`#access_token=...&refresh_token=...&type=recovery`),
    not the PKCE `?code=` flow that `/auth/callback` uses for Google. `@supabase/ssr`'s
    browser client is built around PKCE and does **not** reliably auto-detect hash
    tokens via `onAuthStateChange`'s `PASSWORD_RECOVERY` event — waiting on that event
    left the reset form stuck forever. Fixed by parsing `window.location.hash` directly
    in `ResetPasswordForm` and calling `supabase.auth.setSession({ access_token,
    refresh_token })` explicitly, then stripping the tokens from the URL bar via
    `history.replaceState`. If any other recovery-link-style flow gets added later
    (e.g. magic links), expect the same issue and apply the same fix.
  - **Guard fix**: `/reset-password` must be reachable regardless of auth state — a
    user following the email link gets a temporary Supabase session, which would
    otherwise make `proxy.ts`'s "redirect authenticated users away from public auth
    pages" rule bounce them to `/dashboard` before they can set a new password. Split
    `lib/supabase/middleware.ts`'s path list into `AUTH_ONLY_PATHS` (login/signup/
    forgot-password — redirect away if logged in) and `ALWAYS_ACCESSIBLE_PATHS`
    (reset-password, auth/callback — never redirected either direction).
- `src/components/profile/DeleteAccountSection.tsx` + `deleteAccount()` in
  `profile.service.ts` + `DELETE /api/profile` — FR-007. Password re-confirmation only
  for accounts with an email identity (Google-only users just click confirm, per PRD).
  409 if the user owns any non-deleted team (`"Please delete owned teams or transfer
  ownership first"`, PRD's exact wording). On success: soft-deletes `profiles`
  (`deleted_at`), then **bans the auth user** via
  `admin.auth.admin.updateUserById(id, { ban_duration: '876000h' })` (~100 years)
  rather than hard-deleting `auth.users` — a hard delete would cascade-delete
  `profiles` via its FK (`on delete cascade`), destroying the very soft-delete row
  we're trying to keep, and letting a "deleted" user still authenticate.
- `src/components/ui/Button.tsx` gained a `danger` variant (red, for the delete-account
  button) — the component just string-concatenates variant classes with any passed
  `className`, so overriding `bg-neutral-900` via `className` wasn't reliable; a proper
  variant is the correct fix for any future destructive-action buttons too.
- E2E-tested via scratch Playwright scripts (same pattern as Day 1): password reset
  (request → Supabase admin `generateLink` to simulate clicking the email → set new
  password → redirect to login → re-login with new password → lands in the app) and
  account deletion (both the 409 owned-team block and the full successful-deletion
  path, verified server-side via `profiles.deleted_at` and `auth.users.banned_until`).
  Google OAuth itself was not automated (see above) — confirm manually before Day 8
  submission.

### Day 2 follow-up fixes (found via Eric's manual testing, 2026-07-03)

- **Bug fixed**: `PasswordChangeForm.tsx` used to just show an inline "Password
  changed" notice and leave the user on the page. But changing a password via
  `admin.auth.admin.updateUserById` invalidates the current session server-side —
  so the user looked logged in but would get silently bounced to `/login` on their
  *next* navigation, with no explanation. Fixed to match the reset-password pattern:
  sign out and redirect to `/login?passwordChanged=true` immediately, with a clear
  notice on the login page (shared with the `?reset=success` notice).
- **Bug fixed**: the profile image URL (FR-005) saved correctly to the DB, but
  nothing in the UI ever rendered it as an actual image — `Sidebar.tsx`'s avatar and
  `ProfileForm.tsx` both only ever showed initials. Added `components/ui/Avatar.tsx`
  (plain `<img>`, not `next/image`, since profile image URLs are arbitrary
  user-supplied domains with no fixed allowlist; falls back to initials on missing
  URL or load error) and wired it into both places. `(app)/layout.tsx` now passes
  `profile.profileImage` through to `Sidebar`.
- **Not a bug, confirmed working as designed**: deleting an account (FR-007) and
  then trying to sign up again with the same email correctly shows "may already be
  registered" — because deletion bans the `auth.users` row rather than hard-deleting
  it (see above), so the email is permanently reserved by the soft-deleted account.
  Eric confirmed this is the desired behavior (matches how most real products treat
  account deletion) — don't "fix" this without checking with him first, since making
  emails reusable after deletion would require actively mangling the banned user's
  email server-side, a nontrivial change.
- **Small polish**: `/auth/callback` now forwards Supabase's `error_description`
  (e.g. "User is banned" when someone tries Google OAuth on a deleted account) as an
  `errorMessage` query param, and `LoginForm.tsx` displays it — previously
  `?error=oauth_failed` showed nothing to the user at all.

### Email provider switched to SendGrid (2026-07-03)

Resend's `onboarding@resend.dev` restriction (only delivers to the account owner's own
email, see above) made it unusable for testing signups with arbitrary emails, and
that's a real blocker since FR-003/FR-013 need to reach other testers/graders.
Switched Supabase's custom SMTP to **SendGrid** with **Single Sender Verification**
(verifies one specific "from" address via an emailed confirmation link — no DNS access
needed, unlike full domain authentication) — this lifts the *recipient* restriction
that Resend had, so signups now deliver to any email address. Sender is
`eric.ai@techvalleyvn.net`, verified as a Single Sender in SendGrid (not a fully
authenticated domain — that still needs DNS access to `techvalleyvn.net`, same
constraint as before). SMTP config: host `smtp.sendgrid.net`, port 587, username is
literally the string `apikey` (not a placeholder), password is the SendGrid API key.
Note Eric's first SendGrid account had exhausted its free trial — this is a second,
fresh account.

### UI polish fixes (2026-07-03)

- `(app)/profile/page.tsx` had no padding — Dev B's `Sidebar` layout swap left
  `<main>` in `(app)/layout.tsx` with zero padding by design (each page is expected
  to apply its own, e.g. `/projects` uses `p-6 pb-10` per `DESIGN.md`'s documented
  "Content padding" convention). Profile page just never got that treatment. Fixed by
  adding `p-6 pb-10` to the page's root div, matching `/projects` exactly — don't add
  padding to the shared `<main>` instead, that would double it up on pages that
  already handle their own.

## Day 2 — Dev B's Project Workspace (pulled 2026-07-03)

Dev B (git author "MileFisher") landed the full Project feature set (FR-020..027,
FR-080) directly onto `dev/Eric` as commit `9e4063f` (single parent, not a merge —
worth knowing if branch history looks unusual later). Well-documented in
`docs/session-log-2026-07-03.md` and `DESIGN.md` (typography/color/spacing design
system — read this before building any new UI, both devs should follow it for visual
consistency).

- `src/lib/team/team.service.ts` — **stopgap** team helper (`getUserTeams`,
  `getUserFirstTeam`, `requireTeamMembership`) until Dev A builds real team management
  (FR-010..019, Day 3). `requireTeamMembership` currently does the FR-070 404 job that
  `lib/permissions/guard.ts` was meant to do. When building real teams, either promote
  this into `lib/permissions/guard.ts` per the original plan, or explicitly keep
  `team.service.ts` as the guard's home and update `folder-structure.md`'s mental
  model — coordinate with Dev B either way since `project.service.ts` imports from it.
- `src/lib/project/project.service.ts` + 8 API routes + `components/projects/*` +
  `/projects`, `/projects/[projectId]` pages — full CRUD, favorites, archive, and
  FR-080 dashboard (KPI cards, status donut, priority bars, workload chart). Follows
  the same thin-route + service-layer + `types/api.ts` DTO pattern established in
  Day 1.
- `/dashboard` now redirects to `/projects` (old placeholder retired).
- **Integration fix applied 2026-07-03**: Dev B's new `Sidebar.tsx` (replacing
  `Navbar.tsx`) dropped the link to `/profile` entirely — the user-info block was
  static text with no way to navigate there. Fixed by wrapping it in a `Link` to
  `/profile` (kept `LogoutButton` as a separate sibling so its click doesn't get
  swallowed by the link).
- **Known lint issue (not fixed, flagged for Dev B)**: `ProjectsPageClient.tsx` and
  `ProjectDashboard.tsx` both trigger `react-hooks/set-state-in-effect` errors (calling
  a `setState`-triggering fetch function directly in a `useEffect` body — the classic
  "fetch on mount" pattern, which this stricter lint rule flags even though it's
  functionally fine and very common). `npm run build` doesn't run ESLint in this repo
  so builds aren't blocked, but `npx eslint .` / `npm run lint` will surface these two
  errors. Left for Dev B to fix since it's their component logic — either wrap the
  effect body in an async IIFE, or add a targeted eslint-disable if the team decides
  the rule is too strict for fetch-on-mount.
- Dev B's own noted limitations (see session log for full list): no real project data
  seeded yet for manual testing, AI summary is a hardcoded placeholder (real FR-040..045
  integration pending AI provider choice), no issue CRUD yet, DB only seeds 3 default
  statuses but the design uses 4 ("In Review" — can be added as a custom status per
  FR-053), Members/Activity sidebar links are stubs pending Dev A's FR-014/FR-019.

## Incident: Next.js accidentally downgraded to v9 (2026-07-05)

Dev B's commit `555b9f3` ("update package.json") on branch `dev/akp`, merged into
`dev/Eric` via `0fc771f`, changed `"next": "^16.2.10"` to `"next": "^9.3.3"` in
`package.json` (and regenerated `package-lock.json` to match) — almost certainly an
accidental edit, not intentional. Next.js 9 predates the App Router entirely
(introduced in v13), so this would have broken the *entire* app — `proxy.ts`, route
groups, Route Handlers, everything — the moment anyone ran `npm install`/`npm ci`
fresh (a new clone, CI, or a Vercel deploy). Local `node_modules` still had 16.2.10
installed at the time so nothing broke immediately, but this was a live landmine.
**Fixed immediately** by restoring `"next": "^16.2.10"` and regenerating the lockfile.
If a similar unexplained dependency version change shows up in a future pull, check
`package.json`'s diff line-by-line before trusting it — don't assume `npm install`
succeeding locally means the committed lockfile is safe.

## Day 3 — Teams (done)

FR-010 (create), FR-011 (update, OWNER/ADMIN), FR-012 (delete + cascade soft delete,
OWNER only), FR-014 (member list), FR-015 (kick, role-scoped), FR-016 (leave,
not OWNER).

- `src/lib/team/team.service.ts` — Dev B's stopgap (`getUserTeams`, `getUserFirstTeam`,
  `requireTeamMembership`) is now the **permanent home** for all team logic; extended
  in place with `createTeam`, `getTeam`, `updateTeam`, `deleteTeam`, `listMembers`,
  `kickMember`, `leaveTeam` rather than creating a competing `lib/teams/` (plural)
  file per `folder-structure.md`'s original plan — avoids breaking Dev B's existing
  `project.service.ts` import and matches the doc's own "one service file per
  resource" rule better than splitting it would have.
- `src/lib/permissions/team-role.ts` — small `isOwner`/`isOwnerOrAdmin` helpers used
  throughout the service for permission checks (FR-011/012/015/016).
- `deleteTeam()` cascades soft-delete three levels deep: team → its projects → those
  projects' issues → those issues' comments, matching PRD's "all sub-projects, issues,
  comments, etc. are Soft Deleted." Verified via direct DB checks in testing.
- `listMembers()` fetches email per member via `admin.auth.admin.getUserById` (looped,
  not batched — fine at this team-size scale; `profiles` has no email column, it only
  lives in `auth.users`).
- **Bug found + fixed during manual testing**: `getUserTeams()` (backing `GET
  /api/teams`) still returned the old stopgap shape (`{teamId, teamName, role}`) after
  the rest of the team feature moved to the `TeamResponse` DTO — crashed
  `TeamsPageClient`/`TeamCard` with `Cannot read properties of undefined (reading
  'charAt')` since `team.name` didn't exist. Fixed by rewriting `getUserTeams()` to
  return `TeamResponse[]` like every other team endpoint. This is a **shared
  contract** — Dev B's `ProjectsPageClient.tsx` also calls `GET /api/teams` (to look
  up a `teamId` for project creation) and read the old `.teamId` field; updated that
  one line to read `.id` instead. Flag this specific change to Dev B since it's their
  file — verified their project-creation flow still works against the new shape.
- API routes: `POST /api/teams`, `GET/PATCH/DELETE /api/teams/:teamId`,
  `POST /api/teams/:teamId/leave`, `GET /api/teams/:teamId/members`,
  `DELETE /api/teams/:teamId/members/:userId` — all thin, matching the established
  pattern.
- UI: `/teams` (list + create modal), `/teams/:teamId` (layout with Overview/Members/
  Settings tabs + overview stats), `/teams/:teamId/members` (table with role-scoped
  kick buttons + leave button), `/teams/:teamId/settings` (rename + danger-zone
  delete, OWNER/ADMIN gated both in the layout's tab visibility and again server-side
  in the page itself for defense in depth). Sidebar's old "Members" stub (`href="#"`)
  repointed to `/teams` — a standalone global "Members" page doesn't make sense until
  there's a team-switcher/context; "Activity" stays a stub (FR-019, Day 4).
- No invite flow yet (FR-013, Day 4) — admin/member test accounts were added directly
  via `team_members` inserts during E2E testing, simulating an already-accepted invite.
- E2E-tested via Playwright: full permission matrix (owner/admin/member kick rules,
  self-kick prevention, owner-cannot-leave, non-owner-cannot-delete, FR-070 404 for
  non-members) plus the three-level cascade-delete, all verified via direct DB
  assertions — 20/20 passed. Separate UI smoke test through the actual create → tabs
  → rename → delete flow — 7/7 passed.

## Day 4 — Roles, invites, activity log (done)

- `src/lib/activity-log/activity-log.service.ts` — `logActivity()` (best-effort, never
  throws — a logging failure must not block the action that triggered it) and
  `listActivity()` (cursor-paginated, newest first). Wired into `team.service.ts`'s
  `updateTeam`/`kickMember`/`leaveTeam`/`changeRole` and `invite.service.ts`'s
  `createInvite`/`acceptInvite`. Membership check for the activity API route lives in
  the route itself (`requireTeamMembership`), not inside `activity-log.service.ts`,
  to avoid a circular import with `team.service.ts` (which itself calls
  `logActivity`).
- **FR-018 role change** — `changeRole()` in `team.service.ts`, OWNER only. Promote/
  demote MEMBER↔ADMIN freely; setting a target's role to `OWNER` is a special
  transfer path (target becomes OWNER, acting owner becomes ADMIN, `teams.owner_id`
  updated) — this is how "at least 1 OWNER" is maintained, since a demote-only demote
  of the current OWNER is rejected (`CANNOT_DEMOTE_OWNER`) unless done via transfer.
  Cannot act on your own role. UI: a `<select>` per member row in the Members table
  (OWNER only), with an extra confirm step specifically for the OWNER-transfer option
  since it's the one destructive-to-self choice.
- **FR-013 invites** — `src/lib/invite/invite.service.ts` + `src/lib/email/send-invite-email.ts`.
  Key architecture point: invite emails are sent by **our own backend** calling
  SendGrid's HTTP API directly (`EMAIL_PROVIDER_API_KEY` + `EMAIL_SENDER_ADDRESS` env
  vars) — this is separate from Supabase Auth's SMTP config, which only covers
  Supabase's own signup-confirm/password-reset emails, not custom emails our code
  sends. Used plain `fetch`, not `@sendgrid/mail`, to avoid a dependency for one API
  call. `createInvite` upserts on the `(team_id, email)` unique constraint, so
  inviting the same pending email again is a resend (bumps `expires_at` +7 days)
  rather than a duplicate-row error, matching PRD's resend requirement. Accept flow
  (FR-013's "Invite List" approve pattern, not a magic-link auto-join) lives at
  `/invites` — any logged-in user sees invites matching their own email
  (case-insensitive) via `GET /api/invites/mine`, and accepting upserts a
  `team_members` row (`ignoreDuplicates: true` so a double-click can't error) then
  marks the invite `ACCEPTED`. Expired or already-used invites are rejected (422).
- **Email sending gap**: `.env.local` doesn't have `EMAIL_PROVIDER_API_KEY`/
  `EMAIL_SENDER_ADDRESS` set yet as of this writing — `sendInviteEmail()` degrades
  gracefully (logs an error, doesn't throw) when unset, so invite creation/accept
  still works for testing, but no real email goes out until Eric adds these two vars
  (same SendGrid API key already used for Supabase's SMTP, reused here for our own
  backend's direct API calls).
- E2E-tested via scratch Playwright (20/20 passed): promote/demote, self-role-change
  blocked, ownership transfer (`teams.owner_id` + old-owner-demoted verified via
  direct DB read), invite create/resend (expiry bump verified), full accept flow
  (UI visibility → accept click → DB membership row + `ACCEPTED` status, all
  verified directly), activity feed showing all of the above with correct
  human-readable formatting and correct actor attribution.
  - **Test-methodology note**: hit the same "insufficient wait time" false-negative
    pattern as Day 1-3 — the accept flow's client-side `router.push()` to the new
    team page needs several seconds on a cold route compile (multiple sequential
    DB queries in the team layout). Fixed by using Playwright's `waitForURL()`
    instead of a flat `waitForTimeout()`. Worth remembering for any future
    post-mutation-redirect test: prefer `waitForURL`/`waitForResponse` over guessing
    a timeout.
- Sidebar gained an "Invites" nav item (`/invites`, own page — not team-scoped) next
  to "Teams".

## Day 5 — Notifications (done)

- `src/lib/notification/notification.service.ts` — `createNotification()` (best-effort,
  same non-throwing pattern as activity-log), `listNotifications()` (cursor-paginated,
  returns `unreadCount` alongside the page per `api.md`), `markAsRead()`/
  `markAllAsRead()` (FR-091, scoped to the caller's own `user_id`).
- **FR-090 triggers wired to their real sources**:
  - `ROLE_CHANGED` — both branches of `changeRole()` in `team.service.ts` (plain
    promote/demote and the OWNER-transfer path).
  - `TEAM_INVITE` — `createInvite()` in `invite.service.ts`. Only fires if the
    invited email already belongs to a registered user — resolved via a
    `findUserIdByEmail()` helper that pages through `admin.auth.admin.listUsers()`
    (the admin SDK has no direct "get user by email"; fine at this project's scale).
    If the email isn't registered yet, the invite email is still sent — they just
    don't get an in-app notification since there's no account to attach it to.
  - `ISSUE_ASSIGNED` — **touches Dev B's `src/lib/issue/issue.service.ts`**, exactly
    where their Day 2 session log flagged for me: one hook in `createIssue` (fires if
    created with an assignee) and one in `updateIssue` (fires only when the assignee
    actually changes to a non-null value — not on unassignment). Both are minimal,
    additive `createNotification()` calls; no existing logic touched.
  - `ISSUE_COMMENT` — **not wired yet**, comments don't exist in the codebase yet
    (Dev B's Day 5 scope, not landed as of this writing). Hook point once it exists:
    wherever `createComment()` ends up, notify the issue's assignee and creator
    (skip the commenter themselves).
  - `DUE_SOON` / `DUE_TODAY` — structurally different from the others: not fired by
    a user action, needs to run once a day. `src/lib/notification/due-date-check.service.ts`
    does the actual query (skips archived projects and `Done`-status issues) with
    **idempotency built in** (checks for an existing same-day notification of that
    type+issue+user before creating another, since the check might run more than
    once a day). Exposed via `POST /api/notifications/check-due-dates`, protected by
    a `CRON_SECRET` header check (no logged-in "actor" for a scheduled job, so the
    normal `requireUser()` pattern does't apply) — **not yet wired to an actual
    scheduler**. Vercel Cron is the natural fit but needs the app deployed first
    (still pending, see "Known limitations"). Until then this has to be triggered
    manually or via any external HTTP-capable cron pointed at the deployed URL once
    it exists.
- UI: `NotificationBell.tsx` in the sidebar's logo row (bell icon + unread-count
  badge + dropdown of the 8 most recent, "Mark all read" + "View all"), and a full
  paginated `/notifications` page for FR-091's mark-as-read requirements. Clicking a
  notification marks it read and navigates to the related entity — issue
  notifications only store an `issueId`, but the actual route is
  `/projects/:projectId/issues/:issueId`, so the click handler fetches
  `/api/issues/:issueId` first to resolve the `projectId` before navigating.
- E2E-tested via scratch Playwright (22/22 passed, no timing false-negatives this
  time): all four wired triggers verified via direct DB reads, cron endpoint's
  secret check (401 on wrong/missing secret) and idempotency (second run same-day
  creates zero duplicates) verified, mark-all-read verified both in the UI and via
  direct DB read, bell badge confirmed hidden after mark-all-read.

## Dev B — Issues core (pulled 2026-07-06)

Full write-up in `docs/session-log-2026-07-06.md`. Summary:

- `src/lib/issue/issue.service.ts` + API routes (`/api/projects/:projectId/issues`,
  `/api/issues/:issueId`, `/api/projects/:projectId/statuses`) — create/list/detail/
  update/delete (FR-030..035), 200/project limit, assignee validated as a team member
  (reuses Dev A's `requireTeamMembership`), archived projects reject writes,
  `issue_history` rows written per changed field (real data ready for FR-039's Day 4
  history tab).
- UI: `/projects/:projectId/issues` list + create modal, `/projects/:projectId/issues/:issueId`
  detail page (inline edit, optimistic status/assignee/priority updates, danger-zone
  delete gated by server-computed `canDelete`).
- **Fixed the `react-hooks/set-state-in-effect` lint errors** flagged earlier in this
  file (`ProjectsPageClient`, `ProjectDashboard`) — repo-wide `npx eslint .` is now
  clean, 0 errors/0 warnings. Pattern used: wrap the effect body in
  `void (async () => { await load(); })()`.
- **Flag for Eric**: `origin/main` still has the Next 9 downgrade (`555b9f3`, see Day 3
  section above) — the fix only exists on `dev/Eric`. Needs a PR to `main` before any
  Vercel deploy from main.
- **Flag for Eric (Day 5, FR-090 notifications)**: issue assignment happens in
  `createIssue`/`updateIssue` in `issue.service.ts` — hook notification triggers there.
- E2E seed data left in the live DB for Dev B's own Day 3 kanban reuse: team "AKP E2E
  Team (day2)", project "Day2 Issues E2E", users `akp.e2e.{owner,admin,creator,member,
  outsider}@techvalley.test` — don't delete these as stray test data.
- Known gaps (deliberate, per timeline): no search/filter/sort yet (FR-036, Day 4), no
  labels yet (FR-038, Day 4), subtasks/comments/AI are placeholder cards, no kanban
  board yet (Day 3 is next for Dev B).

## Day 6 — Dashboards (done)

FR-081 (personal dashboard), FR-082 (team statistics with 7/30/90-day period
selector).

- `src/lib/dashboard/dashboard.service.ts` — new service, `getPersonalDashboard()`
  and `getTeamStats()`. Didn't extend `team.service.ts` or `project.service.ts` for
  this — `api.md` already groups FR-081/082 under their own "Dashboards" section
  distinct from Teams/Projects, and the personal dashboard in particular spans
  teams + projects + issues + comments, so a dedicated file fit the existing
  "one service file per resource" rule better than bolting it onto an unrelated one.
- **Personal dashboard (FR-081)** — `GET /api/dashboard/personal`. Assigned issues
  are scoped to non-archived projects only (same convention as the FR-090
  due-date-check cron: archived-project work is read-only, so it doesn't belong in
  an actionable "my work" view). Due-today/due-soon exclude `Done`-status issues,
  also matching that cron's logic. **Recent comments**: the `comments` table exists
  in `schema.sql` but has no service/API layer yet — that's Dev B's Day 5 scope,
  not landed as of this writing (confirmed via search, no `comment*` files anywhere
  under `src/`). Read the table directly with the admin client rather than block
  on that service existing; revisit once Dev B's comments feature lands (probably
  fine to leave as-is, just re-verify the query still matches the eventual schema).
- **Team statistics (FR-082)** — `GET /api/teams/:teamId/stats?period=7|30|90`, any
  team member can view (matches other team-scoped GETs). Query param validated with
  a plain `parsePeriod()` function (invalid/missing → defaults to 30), not zod —
  matches the existing convention in the issues list route for filter params.
  Semantics settled on:
  - `creationTrend`/`completionTrend`: period-scoped daily counts, zero-filled for
    every day in range (better for a line chart than sparse points). Completion is
    derived from `issue_history` (`field_name='status' AND new_value='Done'`) since
    `issues` has no `completed_at` column.
  - `assignedPerMember`: **not** period-scoped — a live snapshot of current open
    (non-Done) workload, matching FR-080's `workloadByAssignee` framing.
  - `completedPerMember`: period-scoped, attributed to the issue's **current
    assignee** (not whoever clicked the status dropdown) — kept consistent with
    `assignedPerMember`'s assignee-centric framing rather than a "who did the
    click" audit.
  - `statusPerProject`: live snapshot, one row per team project (even with 0
    issues), status colors fall back to the same `Backlog/In Progress/In
    Review/Done` palette used in `project.service.ts` when a default status's
    `color` column is null (it's seeded null in `schema.sql`).
- UI: `/dashboard` is no longer a redirect to `/projects` — it's now the real
  personal dashboard (`PersonalDashboardClient.tsx`), reusing Dev B's
  `StatusDonut`/`BarChart` components rather than rebuilding them. New "Statistics"
  tab added to the team layout's tab bar (`/teams/:teamId/statistics`,
  `TeamStatsClient.tsx`) with a period-selector pill control, two `LineChart`
  trend graphs (new small SVG component, no chart library — matches the existing
  `StatusDonut`/`BarChart` house style of hand-rolled CSS/SVG over a dependency),
  and reused `BarChart` for the per-member breakdowns.
- E2E-tested via scratch Playwright (31/31 passed): personal dashboard's assigned
  count/status grouping/due-today/due-soon/recent-comments/teams/projects all
  verified against seeded data with direct DB assertions; team stats' creation and
  completion trend totals, assigned/completed-per-member attribution, and
  status-per-project breakdown all verified for both `period=7` and `period=90`;
  UI screenshots confirmed both pages render correctly end-to-end including the
  period-selector click-through.
- **Dev-server gotcha hit during testing**: added `src/app/api/teams/[teamId]/stats/route.ts`
  while a `next dev` (Turbopack) instance was already running — it 404'd on an
  unrelated sibling route (`POST /api/teams/:teamId/projects`) with Next's own
  not-found HTML page (not our JSON error envelope) until the dev server was
  restarted with a cleared `.next` cache. If a route that definitely exists on disk
  404s with an HTML body instead of a JSON error, suspect a stale Turbopack route
  manifest before assuming a real bug — restart `next dev` first.

## Dev B — Kanban, labels, subtasks, issue history, settings (pulled 2026-07-09)

Large drop covering FR-036 (search/filter/sort), FR-038 (labels), FR-039 (issue
history), FR-039-2 (subtasks), FR-050..054 (kanban board incl. custom statuses/WIP
limits/drag-drop), and a project settings page. One merge conflict, resolved:

- **Conflict**: `src/lib/issue/issue.service.ts`'s `createIssue()` — my Day 5
  `ISSUE_ASSIGNED` notification hook (HEAD) vs. Dev B's Day 3 FR-038 label-linking
  (`syncIssueLabels`) touched the same post-insert block. Not mutually exclusive;
  resolved by keeping both (labels linked first, then the assignee notification
  fires) — no logic lost on either side.
- New dependency `@hello-pangea/dnd` (drag-and-drop for the kanban board) — required
  `npm install` after the pull, since the lockfile alone doesn't add it to
  `node_modules`. If a fresh pull ever fails to compile with `Cannot find module
  '@hello-pangea/dnd'`, this is why — run `npm install` first.
- New service files: `src/lib/label/label.service.ts`, `src/lib/status/status.service.ts`,
  `src/lib/subtask/subtask.service.ts` — same thin-route pattern as everything else.
- New UI: `/projects/:projectId/board` (kanban, `components/kanban/*`),
  `/projects/:projectId/settings` (statuses/WIP limits/labels management), plus
  `IssueHistory.tsx`, `SubtaskList.tsx`, `LabelPicker.tsx`/`LabelManager.tsx` wired
  into `IssueDetailClient.tsx`.
- `CONTEXT.md` (new, repo root) — a domain-glossary doc (kanban/issues/comments/AI
  terminology), no code impact.
- Verified after merge: `npx tsc --noEmit` clean, `npx eslint .` clean (0/0), `npm
  run build` succeeds (all 50+ routes compiled). My Day 5 notification hooks in
  `issue.service.ts` (create + reassign) and the Sidebar's `NotificationBell`
  integration confirmed intact and untouched by the drop.
- The merge itself (`git add`/`git commit`) is Eric's to run per the git-authority
  rule below — Claude only resolved the conflicted file's contents.

## Dev B — comments, AI features, dark/light mode + i18n scaffold (pulled 2026-07-10)

Another large drop: FR-060..063 (comments), FR-040..045 (AI summary/suggestion/
auto-label/duplicate-check/comment-summary via Gemini), plus two commits titled
"update the dark/light mode, pre setup for language switch" and "unfinished tasks
for langauge switch" — Dev B explicitly asked that the dark/light + password
eye-toggle + language-switch work be finished, since he'd only partially wired it
up. Investigated and finished:

- **Dark/light mode** — turned out to already be fully built and working:
  `ThemeToggle.tsx` (flips a `.dark` class on `<html>`, persists to
  `localStorage`, matches OS preference on first visit via an inline
  pre-hydration script in `app/layout.tsx` to avoid a flash), Tailwind v4's
  `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`, and it's
  wired into `Sidebar.tsx`. Nothing left to do here — verified working via
  Playwright (toggle flips the class, persists to `localStorage`, survives a
  reload).
- **Password eye-toggle button** — also already fully built and already used
  everywhere: `components/ui/Input.tsx` shows a show/hide icon button whenever
  `type="password"`, and every password field in the app (`LoginForm`,
  `SignupForm`, `ResetPasswordForm`, `PasswordChangeForm`,
  `DeleteAccountSection`) already goes through the shared `Input` component.
  Nothing left to do here either — verified working via Playwright.
- **Language switch (i18n)** — this was the actually-unfinished piece.
  Infrastructure (`src/lib/i18n/{config,client,server,translate}.ts` +
  `dictionaries/en.ts`) is solid: cookie-based locale (`LOCALE_COOKIE`), a
  `useI18n()` client hook and a `getT()` server helper sharing one `translate()`
  lookup, `MessageKey` derived from `en.ts` so a `t("wrong.key")` call is a
  compile error, not a silent runtime miss. Two real gaps:
  1. `ko.ts`/`vi.ts` were just `{ ...en }` aliases (explicitly commented as a
     "temporary" stopgap). Replaced both with full, real translations for
     every key.
  2. Only 29/80 `.tsx` files actually called `t()` — the "unfinished tasks"
     commit covered auth/profile/teams/sidebar (i.e. mostly Dev A's Day 1-4
     area) but not personal dashboard/team stats (my Day 6 work, built after
     Dev B's i18n pass), invites, notifications, or the app shell. Converted
     all of those (`PersonalDashboardClient.tsx`, `LineChart.tsx`,
     `InvitesPageClient.tsx`, `NotificationsPageClient.tsx`,
     `NotificationBell.tsx`, `(app)/layout.tsx`), adding ~35 new keys to
     `en.ts`/`ko.ts`/`vi.ts` (`dashboard.*`, `invites.*`, `notifications.*`,
     plus a few `common.*`/`time.*` additions) along the way.
  - **Left un-converted on purpose**: Dev B's own screens — Projects, Issues,
    Kanban, Labels, Subtasks, Comments, AI — still have hardcoded English
    strings (`ProjectsPageClient`, `IssueDetailClient`, `KanbanBoardPage`,
    `CommentList`, `IssueAiPanel`, etc., ~35 files). Consistent with this
    project's existing dev-ownership split, that's Dev B's to finish, not
    something I converted on his behalf without asking. Flag this to him.
- **Real bug found + fixed while wiring `PersonalDashboardClient.tsx`**: its
  data-fetching `useCallback` had `t` in its dependency array (added for an
  error-message fallback). Since `t`'s identity changes on every locale
  switch, this caused the mount `useEffect` (keyed on that callback) to
  re-fire and re-fetch on every language change — the whole dashboard would
  flash back to a loading spinner just from switching languages. Fixed by
  removing `t` from the fetch path entirely and translating the rare
  error-fallback message at render time instead, where `t` is safe to depend
  on. Worth checking for the same pattern before adding `t()` calls inside any
  other data-fetching `useCallback`/`useEffect` pair.
- `@google/genai` (Gemini) added as a new dependency for the AI features —
  needed `npm install` after the pull, same as `@hello-pangea/dnd` before it.
- Verified after finishing: `npx tsc --noEmit` clean, `npx eslint .` clean
  (0/0), `npm run build` succeeds (all 60+ routes compiled). E2E-tested via
  scratch Playwright (18/18 passed): eye-toggle show/hide, dark-mode toggle +
  `localStorage` persistence + reload persistence, and language switching
  en→ko→vi→en across the Sidebar, personal dashboard, notifications, and
  invites pages, plus locale persistence across reload (cookie-based).
  Screenshots confirmed both themes and all three locales render cleanly with
  no leftover English strings on the converted pages.

### Follow-up fixes (2026-07-10, same day)

- **Removed the dead "Activity" sidebar nav item.** It was a Day 4 stub
  (`href="#"`) predating the real team activity feed — FR-019 was always
  team-scoped (`GET /api/teams/:teamId/activity`, PRD's "Team Activity Log"),
  never a global cross-team feed, and each team already has its own working
  Activity tab (`/teams/:teamId/activity`). Same situation as the old
  "Members" stub link fixed on Day 3 — no sensible single destination exists
  for a standalone global version, so removed rather than repointed. Also
  dropped the now-unused `nav.activity` key from all three dictionaries.
- **Fixed a pre-existing `react-hooks/set-state-in-effect` lint error in
  `ThemeToggle.tsx`** (Dev B's file, not mine, but found while re-verifying
  lint after the Sidebar edit) — its mount effect called `setDark(...)`
  synchronously to read the DOM's actual `.dark` class (for the toggle
  button's `aria-label`/`title` text only; the icons themselves render via
  CSS `dark:` variants, not this state). Fixed with the same "defer the
  setState so it's not a direct statement in the effect body" shape as the
  codebase's existing fetch-on-mount fix, using `queueMicrotask(() =>
  setDark(...))` instead of an async IIFE (there's no actual async work here,
  just a synchronous DOM read that needs to happen post-mount to avoid an
  SSR/hydration mismatch).
- Re-verified after both fixes: `tsc --noEmit` clean, `eslint .` clean (0/0),
  `npm run build` succeeds, and the full Playwright suite re-run at 20/20
  (added two assertions: no `href="#"` links in the sidebar nav, and the nav
  now has exactly 4 items).

## Task division (current)

- **Dev A** (Eric, branch `dev/Eric`): Auth (FR-001..007), Teams (FR-010..019),
  Notifications (FR-090, FR-091), Personal dashboard (FR-081), Team statistics (FR-082).
- **Dev B**: Projects (FR-020..027), Issues (FR-030..039-2), Kanban (FR-050..054),
  Comments (FR-060..063), AI features (FR-040..045), Project dashboard (FR-080).

Update this section if ownership changes or a dev's name changes.

## Coding conventions

- Shared files touched by both devs — change in small, clearly-labeled commits and
  flag it in the PR: `types/db.ts` (shared TS DB types), `schema.sql`, layout/nav
  components, `.env.example`.
- Commit style: one meaningful unit of work per commit (feature/fix/refactor), not
  end-of-day dumps — at least 5/day per FR-review criteria. Reference the FR number
  in the message where applicable (e.g. `feat: signup form + validation (FR-001)`).
- Never commit `.env` or secrets; `.env.example` documents required vars without values.
- Soft delete (`deleted_at`) applies to: profiles, teams, projects, issues, comments —
  never hard-delete these.
- API routes follow `api.md`'s conventions: error body `{ error: { code, message } }`
  (401/403/404/422/429 per FR-070/042), cursor pagination `?cursor=&limit=` →
  `{ data, nextCursor }`, and a shared team-membership guard + AI rate-limit guard
  (either dev builds first, both depend on it — see `api.md`'s cross-cutting section).

## Git / commit authority

**Claude must never run `git commit`, `git push`, or `git merge`** on this repo —
enforced via `claude/settings.json` deny rules. Prepare and stage changes; the human
developer runs commit/push/merge themselves.

## Email sending

- Supabase's built-in mailer has a very low hourly rate limit (hit it during Day 1
  testing) — not meant for real use. Switched to **Resend** as custom SMTP
  (Authentication → Settings → SMTP) on 2026-07-02.
- Sender is currently `onboarding@resend.dev` (Resend's shared test domain) — sending
  from `@techvalleyvn.net` requires DNS-level domain verification (SPF/DKIM/DMARC) in
  Resend, which needs DNS admin access to that domain that Eric doesn't currently have.
  Switching later is just updating the "Sender email" field once verified, no code
  changes. This affects FR-003 (password reset) and FR-013 (team invites), both of
  which need real email delivery.
- **Known constraint confirmed 2026-07-02**: `onboarding@resend.dev` can only send to
  the email address Eric's Resend account was signed up with — Resend's documented
  restriction for the shared test domain (it's for testing your own inbox only, not
  reaching arbitrary recipients). Confirmed via raw API call:
  `{"code":500,"error_code":"unexpected_failure","msg":"Error sending confirmation email"}`
  for any recipient other than Eric's own address. Supabase's project-level email rate
  limit (Authentication → Rate Limits, set to 18/hour) is NOT the bottleneck — plenty
  of headroom there. This means **only Eric can currently receive confirmation/reset/
  invite emails** — Dev B or graders testing signup will hit this wall until a real
  domain is verified in Resend. Don't spend more time debugging this as an app bug;
  it's a Resend account-level restriction that only domain verification resolves.

## Known limitations / open decisions

- RLS is enabled on all tables with no policies (deny-all for anon/authenticated;
  service-role bypasses) — see `schema.sql` note. Granular per-team RLS policies as
  defense-in-depth are optional, not required for MVP grading.
- AI provider not yet selected.
- Merge strategy for Day 8 integration (incremental PRs vs. one big merge) — see
  `task-division.md` git workflow section; prefer incremental PRs per epic.
- **Resolved 2026-07-02/03**: Eric didn't have push access to the original repo
  (`sohyona/techvalley-jira`) — forked to `PhoneWaiYanMoe/techvalley-jira`. Local
  remotes: `origin` = the fork (push here), `upstream` = the original repo (read-only
  reference / eventual PR target). Vercel still not connected — now unblocked by the
  fork, just not done yet.
- **Resolved 2026-07-06**: the `react-hooks/set-state-in-effect` lint errors flagged
  in the Day 2 section were fixed by Dev B — `npx eslint .` is 0 errors/0 warnings
  as of Day 5.
- **FR-090 due-soon/due-today notifications aren't on a real schedule yet** —
  `POST /api/notifications/check-due-dates` (see Day 5 section) needs an external
  cron to call it daily. Vercel Cron is the natural fit but needs the app deployed
  first, which is blocked on the same "Vercel not connected yet" item above. Until
  then, trigger it manually (with the `CRON_SECRET` header) if due-date notifications
  need to be demonstrated.

## Git commit conventions
Never add a Co-Authored-By: Claude trailer or "Generated with Claude Code" line to commit messages.