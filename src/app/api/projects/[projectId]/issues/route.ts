import { requireUser } from "@/lib/auth/session";
import { createIssue, listIssues } from "@/lib/issue/issue.service";
import { createIssueSchema } from "@/validation/issue.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/issues — FR-030
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = createIssueSchema.parse(await request.json());
    const issue = await createIssue(projectId, user.id, body);
    return Response.json(issue, { status: 201 });
  });
}

// GET /api/projects/:projectId/issues — issue list with search/filter/sort (FR-036)
export async function GET(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const q = new URL(request.url).searchParams;

    const sortParam = q.get("sort");
    const sort =
      sortParam === "due" || sortParam === "priority" || sortParam === "updated"
        ? sortParam
        : "created";
    const priorityParam = q.get("priority");
    const priority =
      priorityParam === "HIGH" || priorityParam === "MEDIUM" || priorityParam === "LOW"
        ? priorityParam
        : undefined;

    const limitParam = q.get("limit");
    const result = await listIssues(projectId, user.id, {
      cursor: q.get("cursor"),
      limit: limitParam ? Number(limitParam) : undefined,
      status: q.get("status") ?? undefined,
      assignee: q.get("assignee") ?? undefined,
      priority,
      label: q.get("label") ?? undefined,
      hasDueDate: q.get("hasDueDate") === "true" ? true : undefined,
      dueFrom: q.get("dueFrom") ?? undefined,
      dueTo: q.get("dueTo") ?? undefined,
      search: q.get("search") ?? undefined,
      sort,
    });
    return Response.json(result);
  });
}
