import { z } from "zod";

// FR-005: Profile Management
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  profileImage: z.string().max(2048).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// FR-006: Password Change
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
