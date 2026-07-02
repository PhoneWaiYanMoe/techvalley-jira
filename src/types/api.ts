// Response DTOs matching docs/api.md. Request bodies are covered by the zod
// schemas in src/validation/*.schema.ts (via z.infer) — this file is for
// response shapes and anything not 1:1 with a request schema.

export type ProfileResponse = {
  id: string;
  name: string;
  profileImage: string | null;
  email: string | null;
};
