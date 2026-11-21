import type { Profile, AppRole } from "@/lib/types/database";

export const DEMO_USERS: Record<string, { profile: Profile; password: string; title: string }> = {
  "admin@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000001",
      full_name: "Rohan Verma (Admin)",
      email: "admin@gmd.co.in",
      role: "admin",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "admin",
    title: "Full system administration",
  },
  "sales@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000002",
      full_name: "Amit Sharma (Sales)",
      email: "sales@gmd.co.in",
      role: "sales",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "sales",
    title: "Token creation & lead handling",
  },
  "noc@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000003",
      full_name: "Priya Nair (NOC)",
      email: "noc@gmd.co.in",
      role: "noc",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "noc",
    title: "NOC clearance & approvals",
  },
  "accounts@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000004",
      full_name: "Suresh Gupta (Accounts)",
      email: "accounts@gmd.co.in",
      role: "accounts",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "accounts",
    title: "Deposits, rent & move-in confirmation",
  },
  "maint@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000005",
      full_name: "Vikram Singh (Maintenance)",
      email: "maint@gmd.co.in",
      role: "maintenance",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "maint",
    title: "Facility & bed readiness view",
  },
  "power@gmd.co.in": {
    profile: {
      id: "d0000000-0000-0000-0000-000000000006",
      full_name: "Anand Joshi (Electricity)",
      email: "power@gmd.co.in",
      role: "electricity",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    password: "power",
    title: "Meter readings & bill generation",
  },
};

export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes("your-project.supabase.co") || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
