// Database types matching our schema
export type AppRole = "admin" | "sales" | "noc" | "accounts" | "maintenance" | "electricity";
export type BedStatus = "vacant" | "reserved" | "occupied" | "notice" | "blocked";
export type BookingStatus = "token" | "noc_hold" | "noc_cleared" | "active" | "rejected" | "cancelled" | "moved_out";
export type BookingSource = "token" | "existing";
export type NocStatus = "pending" | "cleared" | "hold" | "rejected";
export type PaymentType = "token" | "deposit" | "rent" | "electricity" | "opening_balance" | "refund" | "other";
export type PaymentMode = 
  | "upi_serenity"
  | "upi_gmd"
  | "upi_platinum_s"
  | "cash"
  | "bank_transfer"
  | "upi"
  | "card"
  | "other";

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  upi_serenity: "UPI - Serenity",
  upi_gmd: "UPI - GMD",
  upi_platinum_s: "UPI - Platinum S",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  upi: "UPI",
  card: "Card",
  other: "Other",
};


export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Flat {
  id: string;
  name: string;
  address: string | null;
  owner_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  flat_id: string;
  room_no: string;
  sharing_type: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Bed {
  id: string;
  room_id: string;
  bed_label: string;
  base_price: number;
  status: BedStatus;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  aadhaar_encrypted: string | null;
  aadhaar_last4: string | null;
  aadhaar_hash: string | null;
  phone1: string;
  phone2: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_path: string | null;
  aadhaar_doc_path: string | null;
  profile_complete: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  client_id: string;
  bed_id: string;
  source: BookingSource;
  status: BookingStatus;
  token_amount: number;
  agreed_rent: number;
  deposit_amount: number;
  move_in_date: string | null;
  move_out_date: string | null;
  next_rent_due: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  type: PaymentType;
  amount: number;
  mode: PaymentMode | null;
  for_month: string | null;
  paid_on: string;
  reference: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryBedItem {
  id: string;
  bed_label: string;
  base_price: number;
  status: BedStatus;
  room_id: string;
  room_no: string;
  sharing_type: number;
  flat_id: string;
  flat_name: string;
  flat_address: string | null;
  tenant_name: string | null;
  tenant_phone: string | null;
  booking_status: BookingStatus | null;
}

export interface TokenWorkflowItem {
  booking_id: string;
  source: string;
  booking_status: BookingStatus;
  token_amount: number;
  agreed_rent: number;
  deposit_amount: number;
  move_in_date: string | null;
  next_rent_due: string | null;
  token_created_at: string;
  booking_updated_at: string;
  client_id: string;
  client_name: string;
  client_phone1: string;
  client_phone2: string | null;
  aadhaar_last4: string | null;
  photo_path: string | null;
  bed_id: string;
  bed_label: string;
  bed_base_price: number;
  bed_status: BedStatus;
  room_id: string;
  room_no: string;
  sharing_type: number;
  flat_id: string;
  flat_name: string;
  noc_id: string | null;
  noc_status: NocStatus | null;
  noc_remarks: string | null;
  noc_updated_at: string | null;
  noc_done_by_name: string | null;
  created_by_name: string | null;
}

export interface RentDue {
  id: string;
  booking_id: string;
  for_month: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: "pending" | "partial" | "paid" | "overdue" | "waived";
  created_at: string;
  updated_at: string;
}

export interface DueOverviewItem {
  due_id: string;
  booking_id: string;
  for_month: string;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  balance_due: number;
  calculated_status: "pending" | "partial" | "paid" | "overdue" | "waived";
  days_overdue: number;
  demand_generated_at: string;
  client_id: string;
  client_name: string;
  client_phone1: string;
  bed_id: string;
  bed_label: string;
  bed_status: BedStatus;
  room_id: string;
  room_no: string;
  flat_id: string;
  flat_name: string;
  booking_status: BookingStatus;
  agreed_rent: number;
  deposit_amount: number;
  move_in_date: string | null;
  next_rent_due: string | null;
  notice_date: string | null;
}

export interface Caretaker {
  id: string;
  flat_id: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  flat_name?: string;
  flat_address?: string | null;
}

export interface ElectricityReading {
  id: string;
  flat_id: string;
  room_id: string | null;
  reading_date: string;
  meter_type: "room" | "common";
  previous_meter_value: number;
  meter_value: number;
  units_consumed: number;
  photo_path: string | null;
  entered_by: string | null;
  created_at: string;
}

export interface ElectricityBill {
  id: string;
  flat_id: string;
  period_start: string;
  period_end: string;
  rate: number;
  units: number;
  total_amount: number;
  common_units: number;
  common_amount: number;
  rooms_total_units: number;
  rooms_total_amount: number;
  total_occupied_beds: number;
  status: "draft" | "generated" | "finalized";
  created_by: string | null;
  created_at: string;
  flat_name?: string;
}

export interface TenantElectricityDue {
  id: string;
  bill_id: string;
  booking_id: string;
  client_id: string;
  room_id: string;
  room_units: number;
  room_share_count: number;
  room_amount: number;
  common_units: number;
  common_share_count: number;
  common_amount: number;
  total_due: number;
  paid_amount: number;
  status: "pending" | "partial" | "paid" | "waived";
  created_at: string;
  updated_at: string;
}

export interface ElectricityDueOverview {
  due_id: string;
  bill_id: string;
  booking_id: string;
  client_id: string;
  room_id: string;
  room_units: number;
  room_share_count: number;
  room_amount: number;
  common_units: number;
  common_share_count: number;
  common_amount: number;
  total_due: number;
  paid_amount: number;
  balance_due: number;
  status: "pending" | "partial" | "paid" | "waived";
  created_at: string;
  client_name: string;
  client_phone: string;
  room_no: string;
  flat_id: string;
  flat_name: string;
  period_start: string;
  period_end: string;
  rate_per_unit: number;
  bill_total_amount: number;
}

export interface FlatOccupancyReport {
  flat_id: string;
  flat_name: string;
  flat_address: string | null;
  is_active: boolean;
  total_rooms: number;
  total_beds: number;
  occupied_beds: number;
  vacant_beds: number;
  reserved_beds: number;
  notice_beds: number;
  blocked_beds: number;
  occupancy_rate: number;
  potential_revenue: number;
  current_occupied_revenue: number;
}

export interface DashboardStats {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  reservedBeds: number;
  noticeBeds: number;
  blockedBeds: number;
  occupancyRate: number;
  tokensThisMonthCount: number;
  tokensThisMonthAmount: number;
  collectionsThisMonth: number;
  totalOverdueAmount: number;
  overdueTenantsCount: number;
  flatsOccupancy: FlatOccupancyReport[];
}





