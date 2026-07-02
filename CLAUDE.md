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
  explicit permission check (`lib/permissions/guard.ts`, not yet built) per FR-070.
  Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
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
  `components/layout/` convention, not inlined in the layout file).
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
- No push access to the GitHub repo yet — local commits only, Vercel not yet
  connected. Day 0's "deploy empty shell" checklist item is blocked on this.

## Git commit conventions
Never add a Co-Authored-By: Claude trailer or "Generated with Claude Code" line to commit messages.