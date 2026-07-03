import { z } from "zod";

// FR-001: Sign Up
export const signupSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(50),
});

export type SignupInput = z.infer<typeof signupSchema>;

// FR-002: Login
export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// FR-003: Password Recovery/Reset — request step
export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// FR-003: Password Recovery/Reset — confirmation step
export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6).max(100),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
