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

// GET /api/projects/:projectId/issues — issue list (FR-036 filters arrive Day 4)
export async function GET(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const result = await listIssues(projectId, user.id, {
      cursor,
      limit: limitParam ? Number(limitParam) : undefined,
    });
    return Response.json(result);
  });
}
