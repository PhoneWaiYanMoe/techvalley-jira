import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

// Wraps a route handler body: maps ApiError/ZodError to the api.md error
// envelope, lets anything else bubble up as an unhandled 500.
export async function withApiErrorHandling(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.status, err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResponse(422, "VALIDATION_ERROR", err.issues[0]?.message ?? "Invalid input");
    }
    throw err;
  }
}
