# Domain Glossary

Ubiquitous language for TechValley Jira Lite. Terms only — no implementation
details. See `PRD.md` for full functional requirements.

## Kanban

- **Status (Column)** — a per-project workflow state; each status is one kanban
  column. Issues always have exactly one status.
- **Default status** — one of `Backlog`, `In Progress`, `Done`, seeded with every
  project. Default statuses cannot be renamed or deleted; they can be reordered
  and given WIP limits like any other column.
- **Custom status** — a project-defined status beyond the defaults, max 5 per
  project (8 columns total). Deleting a custom status moves its issues to
  Backlog.
- **Position** — an issue's ordering slot within its column. New issues join the
  bottom of their column.
- **WIP limit** — an advisory per-column cap on issue count (1–50, or unlimited).
  Exceeding it shows a visual warning; it never blocks a move.

## Issues

- **Label** — a per-project colored tag (max 20 per project); an issue carries at
  most 5.
- **Subtask** — a checklist item under an issue (max 20 per issue), orderable,
  complete/incomplete only — no assignee, dates, or nesting.
- **Change history** — the per-issue audit trail of status / assignee / priority /
  title / due-date changes: field, old value, new value, who, when.
- **Archived project** — a project whose issues (and everything under them) are
  read-only. Archiving is reversible; deleting is soft-delete.

## Comments

- **Comment** — text (1–1000 chars) on an issue, listed chronologically.
  Editable by its author only; deletable by author, issue owner, project owner,
  or team OWNER/ADMIN.

## AI

- **AI cache** — a stored AI result on an issue (summary, suggestion, comment
  summary). A cached summary/suggestion goes **stale** when the description
  changes; a cached comment summary goes stale when a new comment is added.
  Stale results require regeneration; fresh ones are served without an AI call.
- **AI rate limit** — per-user ceiling on AI requests: 10 per minute and 100 per
  day. Exceeding either returns an error with the remaining wait time/count.
