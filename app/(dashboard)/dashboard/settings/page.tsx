import { requireAuth } from "@/lib/auth";
import { SettingsView, type AuditLogEntry } from "./settings-view";

export default async function SettingsPage() {
  const { profile, supabase } = await requireAuth();

  if (profile.role !== "admin") {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-xl border bg-card p-6 text-center">
        <h2 className="text-xl font-bold text-destructive">Access Restricted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          System settings, audit logs, and backups are restricted to Admin personnel only.
        </p>
      </div>
    );
  }

  let logs: AuditLogEntry[] = [];

  const { data: viewLogs, error: viewErr } = await supabase
    .from("v_audit_log_overview")
    .select("*")
    .limit(150);

  if (!viewErr && viewLogs) {
    logs = viewLogs as AuditLogEntry[];
  } else {
    // Fallback if v_audit_log_overview is not yet applied
    const [rawLogsRes, profilesRes] = await Promise.all([
      supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      supabase.from("profiles").select("id, full_name, email, role"),
    ]);

    const profileMap = new Map<string, { full_name: string; email: string; role: string }>();
    (profilesRes.data || []).forEach((p: any) => {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email, role: p.role });
    });

    logs = (rawLogsRes.data || []).map((l: any) => {
      const actor = l.actor_id ? profileMap.get(l.actor_id) : undefined;
      return {
        id: l.id,
        actor_id: l.actor_id,
        actor_name: actor?.full_name || null,
        actor_email: actor?.email || null,
        actor_role: actor?.role || null,
        action: l.action,
        table_name: l.table_name,
        record_id: l.record_id,
        old_data: l.old_data,
        new_data: l.new_data,
        created_at: l.created_at,
      };
    });
  }

  return <SettingsView initialLogs={logs} />;
}
