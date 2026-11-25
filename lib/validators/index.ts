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

// Nested Flat + Rooms + Beds Schema (used when adding rooms/beds during flat creation)
export const nestedBedInputSchema = z.object({
  bed_label: z.string().trim().min(1, "Bed label is required (e.g. A, B, 1, 2)"),
  base_price: z.coerce.number().min(0, "Base price must be a positive amount"),
  status: bedStatusSchema.default("vacant"),
});

export const nestedRoomInputSchema = z.object({
  room_no: z.string().trim().min(1, "Room number is required"),
  sharing_type: z.coerce
    .number()
    .int()
    .min(1, "Sharing type must be between 1 and 10")
    .max(10, "Sharing type must be between 1 and 10"),
  is_active: z.boolean().default(true),
  beds: z.array(nestedBedInputSchema).default([]),
});

export const flatWithRoomsSchema = flatSchema.extend({
  rooms: z.array(nestedRoomInputSchema).default([]),
});

export type FlatWithRoomsInput = z.infer<typeof flatWithRoomsSchema>;

// =============================================================================
// PHASE 2: EXISTING TENANTS & CLIENTS
// =============================================================================

export const existingTenantSchema = z.object({
  full_name: z.string().min(2, "Client name must be at least 2 characters"),
  aadhaar: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{12}$/.test(val), {
      message: "Aadhaar number must be exactly 12 numeric digits",
    }),
  phone1: indianPhoneSchema,
  phone2: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Secondary phone must be exactly 10 digits",
    }),
  emergency_contact_name: z.string().trim().optional(),
  emergency_contact_phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Emergency contact phone must be exactly 10 digits",
    }),
  photo_path: z.string().optional(),
  bed_id: z.string().uuid("Please select a valid vacant bed"),
  move_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid move-in date"),
  agreed_rent: z.coerce.number().min(0, "Agreed rent must be positive"),
  deposit_amount: z.coerce.number().min(0, "Deposit must be 0 or positive"),
  next_rent_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid next rent due date"),
  opening_dues: z.coerce.number().min(0, "Opening dues must be 0 or positive").default(0),
});

export type ExistingTenantInput = z.infer<typeof existingTenantSchema>;

// Client Manual Correction Schema (Admin only)
export const clientCorrectionSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  phone1: indianPhoneSchema,
  phone2: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Secondary phone must be 10 digits",
    }),
  emergency_contact_name: z.string().trim().optional(),
  emergency_contact_phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Emergency phone must be 10 digits",
    }),
});

export type ClientCorrectionInput = z.infer<typeof clientCorrectionSchema>;

// =============================================================================
// PHASE 4: TOKEN WORKFLOW SCHEMAS
// =============================================================================

export const paymentModeSchema = z.enum([
  "upi_serenity",
  "upi_gmd",
  "upi_platinum_s",
  "cash",
  "bank_transfer",
  "upi",
  "card",
  "other",
]);


export const createTokenSchema = z.object({
  full_name: z.string().min(2, "Client name must be at least 2 characters"),
  phone1: indianPhoneSchema,
  phone2: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Secondary phone must be 10 digits",
    }),
  emergency_name: z.string().trim().optional(),
  emergency_phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Emergency phone must be 10 digits",
    }),
  aadhaar: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{12}$/.test(val), {
      message: "Aadhaar number must be exactly 12 numeric digits",
    }),
  bed_id: z.string().uuid("Please select a valid vacant bed"),
  agreed_rent: z.coerce.number().min(0, "Agreed rent must be positive"),
  token_amount: z.coerce.number().min(0, "Token amount must be positive or 0"),
  move_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expected move-in date").optional(),
  payment_mode: paymentModeSchema.default("upi"),
  payment_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;

export const updateNocSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  status: z.enum(["cleared", "hold", "rejected"]),
  remarks: z.string().min(3, "Remarks are required (at least 3 characters)"),
});

export type UpdateNocInput = z.infer<typeof updateNocSchema>;

export const confirmMoveInSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  actual_move_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid move-in date"),
  deposit_amount: z.coerce.number().min(0, "Deposit amount must be 0 or positive"),
  deposit_mode: paymentModeSchema.default("upi"),
  deposit_reference: z.string().trim().optional(),
  rent_amount: z.coerce.number().min(0, "First month rent must be 0 or positive"),
  rent_mode: paymentModeSchema.default("upi"),
  rent_reference: z.string().trim().optional(),
  next_rent_due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid next rent due date").optional(),
  notes: z.string().trim().optional(),
});

export type ConfirmMoveInInput = z.infer<typeof confirmMoveInSchema>;

// =============================================================================
// PHASE 5: PAYMENTS, DUES & MOVE-OUT SCHEMAS
// =============================================================================

export const paymentTypeSchema = z.enum([
  "token",
  "deposit",
  "rent",
  "electricity",
  "opening_balance",
  "refund",
  "other",
]);

export const recordPaymentSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  rent_due_id: z.string().uuid("Invalid rent due ID").optional(),
  type: paymentTypeSchema.default("rent"),
  amount: z.coerce.number().min(1, "Payment amount must be greater than 0"),
  mode: paymentModeSchema.default("upi"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid payment date").default(() => new Date().toISOString().split("T")[0]),
  for_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid month date").optional(),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const generateMonthlyRentSchema = z.object({
  for_month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Invalid billing month"),
});

export type GenerateMonthlyRentInput = z.infer<typeof generateMonthlyRentSchema>;

export const setNoticeSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  notice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid notice date"),
  expected_move_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid expected move-out date"),
  notes: z.string().trim().optional(),
});

export type SetNoticeInput = z.infer<typeof setNoticeSchema>;

export const processMoveOutSchema = z.object({
  booking_id: z.string().uuid("Invalid booking ID"),
  actual_move_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid move-out date"),
  deductions_amount: z.coerce.number().min(0, "Deductions cannot be negative").default(0),
  deductions_reason: z.string().trim().optional(),
  refund_amount: z.coerce.number().min(0, "Refund amount cannot be negative").default(0),
  refund_mode: paymentModeSchema.default("upi"),
  refund_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type ProcessMoveOutInput = z.infer<typeof processMoveOutSchema>;

// Caretaker Schema
export const caretakerSchema = z.object({
  flat_id: z.string().uuid("Please select a flat"),
  name: z.string().min(2, "Caretaker name must be at least 2 characters"),
  phone: indianPhoneSchema,
  alternate_phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: "Alternate phone must be 10 digits",
    }),
  notes: z.string().trim().optional(),
});

export type CaretakerInput = z.infer<typeof caretakerSchema>;

// Phase 6: Electricity Schemas
export const roomReadingInputSchema = z.object({
  room_id: z.string().uuid("Invalid room ID"),
  prev: z.coerce.number().min(0, "Previous reading must be non-negative"),
  curr: z.coerce.number().min(0, "Current reading must be non-negative"),
});

export const generateElectricityBillSchema = z
  .object({
    flat_id: z.string().uuid("Please select a flat"),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
    rate_per_unit: z.coerce.number().positive("Rate per unit must be greater than 0"),
    common_prev: z.coerce.number().min(0, "Previous common reading must be non-negative"),
    common_curr: z.coerce.number().min(0, "Current common reading must be non-negative"),
    room_readings: z.array(roomReadingInputSchema).min(1, "At least one room reading is required"),
  })
  .refine((data) => data.common_curr >= data.common_prev, {
    message: "Current common meter reading cannot be less than previous reading",
    path: ["common_curr"],
  });

export type GenerateElectricityBillInput = z.infer<typeof generateElectricityBillSchema>;

export const recordElectricityPaymentSchema = z.object({
  due_id: z.string().uuid("Invalid due ID"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  mode: paymentModeSchema.default("upi_gmd"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid payment date"),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export type RecordElectricityPaymentInput = z.infer<typeof recordElectricityPaymentSchema>;






