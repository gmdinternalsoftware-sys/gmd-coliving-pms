"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { employeeCreateSchema, type EmployeeCreateInput } from "@/lib/validators";
import { revalidatePath } from "next/cache";

/**
 * Verify current logged-in user has 'admin' role.
 */
async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || profile.role !== "admin") {
    throw new Error("Forbidden: Only active admins can perform this action.");
  }

  return { adminUser: user, supabase };
}

export async function createEmployeeAction(input: EmployeeCreateInput) {
  await verifyAdmin();

  const validated = employeeCreateSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors.map((e) => e.message).join(", "),
    };
  }

  const { full_name, email, role, password } = validated.data;
  const adminClient = createAdminClient();

  // Create auth user
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

  if (authError) {
    return { success: false, error: authError.message };
  }

  const userId = authData.user.id;

  // Insert profile row (or let trigger handle it)
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    full_name,
    email,
    role,
    is_active: true,
  });

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  revalidatePath("/dashboard/employees");
  return { success: true };
}

export async function toggleEmployeeStatusAction(
  employeeId: string,
  currentStatus: boolean
) {
  const { adminUser } = await verifyAdmin();

  if (adminUser.id === employeeId) {
    return { success: false, error: "Cannot deactivate your own admin account." };
  }

  const adminClient = createAdminClient();
  const newStatus = !currentStatus;

  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: newStatus })
    .eq("id", employeeId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/employees");
  return { success: true };
}
