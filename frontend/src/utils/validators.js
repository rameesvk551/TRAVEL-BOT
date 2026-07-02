// FILE: /frontend/src/utils/validators.js
// DEPS: zod

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm your new password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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

export const packageSchema = z.object({
  name: z.string().min(2, 'Package name is required'),
  category: z.enum(['DOMESTIC', 'INTERNATIONAL']).optional(),
  duration: z.string().optional(),
  destinations: z.string().optional(),
  basePrice: z.string().min(1, 'Price is required'),
  summary: z.string().optional(),
  inclusions: z.string().optional(),
  exclusions: z.string().optional(),
  itinerary: z.string().optional(),
  brochureUrl: z.string().optional(),
});

export const bookingSchema = z.object({
  totalAmount: z.string().min(1, 'Total amount is required'),
  travelDate: z.string().min(1, 'Travel date is required'),
  returnDate: z.string().min(1, 'Return date is required'),
  travellers: z.string().min(1, 'Number of travellers is required'),
});
