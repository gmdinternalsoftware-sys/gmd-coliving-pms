"use client";

import { useState } from "react";
import type { Profile, AppRole } from "@/lib/types/database";
import { createEmployeeAction, toggleEmployeeStatusAction } from "@/lib/actions/employees";
import { formatDateIST } from "@/lib/utils";
import { UserPlus, Shield, UserCheck, UserX, Loader2, X } from "lucide-react";

interface EmployeeDirectoryProps {
  initialEmployees: Profile[];
  currentUserId: string;
}

const roleColors: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200",
  sales: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
  noc: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200",
  accounts: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
  maintenance: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200",
  electricity: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
};

export function EmployeeDirectory({
  initialEmployees,
  currentUserId,
}: EmployeeDirectoryProps) {
  const [employees, setEmployees] = useState<Profile[]>(initialEmployees);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales");
  const [password, setPassword] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createEmployeeAction({
        full_name: fullName,
        email,
        role,
        password,
      });

      if (!res.success) {
        setError(res.error || "Failed to create employee.");
      } else {
        setIsModalOpen(false);
        setFullName("");
        setEmail("");
        setRole("sales");
        setPassword("");
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(employee: Profile) {
    if (employee.id === currentUserId) return;
    setTogglingId(employee.id);

    try {
      const res = await toggleEmployeeStatusAction(
        employee.id,
        employee.is_active
      );

      if (res.success) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === employee.id
              ? { ...emp, is_active: !emp.is_active }
              : emp
          )
        );
      } else {
        alert(res.error || "Failed to update status");
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Manage company team members, access roles, and account status.
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Employees Table (Desktop) / Cards (Mobile) */}
      <div className="rounded-lg border bg-card shadow-sm">
        {/* Mobile View */}
        <div className="divide-y md:hidden">
          {employees.map((emp) => {
            const isMe = emp.id === currentUserId;
            return (
              <div key={emp.id} className="p-5 sm:p-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-base">{emp.full_name}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      roleColors[emp.role]
                    }`}
                  >
                    {emp.role.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Joined: {formatDateIST(emp.created_at)}</span>
                  <span
                    className={`font-medium ${
                      emp.is_active ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {emp.is_active ? "● Active" : "○ Inactive"}
                  </span>
                </div>

                {!isMe && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleToggleStatus(emp)}
                      disabled={togglingId === emp.id}
                      className={`w-full py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${
                        emp.is_active
                          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                          : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
                      }`}
                    >
                      {togglingId === emp.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                      ) : emp.is_active ? (
                        "Deactivate Account"
                      ) : (
                        "Reactivate Account"
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Department / Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => {
                const isMe = emp.id === currentUserId;
                return (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        {emp.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {emp.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          roleColors[emp.role]
                        }`}
                      >
                        {emp.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          emp.is_active
                            ? "text-emerald-600"
                            : "text-muted-foreground line-through"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            emp.is_active ? "bg-emerald-500" : "bg-muted-foreground"
                          }`}
                        />
                        {emp.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {formatDateIST(emp.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isMe ? (
                        <span className="text-xs text-muted-foreground italic">
                          (Current User)
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          disabled={togglingId === emp.id}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            emp.is_active
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {togglingId === emp.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : emp.is_active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" /> Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" /> Reactivate
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b">
              <h2 className="text-lg font-bold">Add New Employee</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@gmd.co.in"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Department / Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="sales">Sales (Tokens & Pipeline)</option>
                  <option value="noc">NOC (Verification & Holds)</option>
                  <option value="accounts">Accounts (Payments & Invoices)</option>
                  <option value="maintenance">Maintenance (Inspections)</option>
                  <option value="electricity">Electricity (Meters & Billing)</option>
                  <option value="admin">Admin (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Creating…" : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
