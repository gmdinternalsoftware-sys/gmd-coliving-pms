import { z } from "zod";

// Indian phone: exactly 10 digits
export const indianPhoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits");

// Aadhaar: exactly 12 digits (validated before encryption)
export const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits");

// Login form
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Role Enum
export const appRoleSchema = z.enum([
  "admin",
  "sales",
  "noc",
  "accounts",
  "maintenance",
  "electricity",
]);

// Employee Creation Form
export const employeeCreateSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: appRoleSchema,
  password: z.string().min(6, "Temporary password must be at least 6 characters"),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

// Flat Schema
export const flatSchema = z.object({
  name: z.string().min(2, "Flat / property name is required"),
  address: z.string().optional().default(""),
  owner_name: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  is_active: z.boolean().default(true),
});

export type FlatInput = z.infer<typeof flatSchema>;

// Room Schema
export const roomSchema = z.object({
  flat_id: z.string().uuid("Invalid flat ID"),
  room_no: z.string().min(1, "Room number is required"),
  sharing_type: z.coerce
    .number()
    .int()
    .min(1, "Sharing type must be between 1 and 10")
    .max(10, "Sharing type must be between 1 and 10"),
  is_active: z.boolean().default(true),
});

export type RoomInput = z.infer<typeof roomSchema>;

// Bed Status Enum
export const bedStatusSchema = z.enum([
  "vacant",
  "reserved",
  "occupied",
  "notice",
  "blocked",
]);

// Bed Schema
export const bedSchema = z.object({
  room_id: z.string().uuid("Invalid room ID"),
  bed_label: z.string().min(1, "Bed label is required (e.g. A, B, 1, 2)"),
  base_price: z.coerce
    .number()
    .min(0, "Base price must be a positive amount"),
  status: bedStatusSchema.default("vacant"),
});

export type BedInput = z.infer<typeof bedSchema>;

