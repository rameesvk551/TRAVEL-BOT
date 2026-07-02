// FILE: mobile/src/features/auth/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  agencyName: z.string().min(2, 'Agency name must be at least 2 characters'),
  agencyPhone: z.string().min(10, 'Enter a valid phone number'),
  agencyEmail: z.string().email('Enter a valid email'),
  whatsappNumber: z.string().min(10, 'Enter a valid WhatsApp number'),
  agentName: z.string().min(2, 'Your name must be at least 2 characters'),
  agentEmail: z.string().email('Enter a valid email'),
  agentPassword: z.string().min(8, 'Password must be at least 8 characters'),
  industry: z.enum(['TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY']).default('TRAVEL'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
