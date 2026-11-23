import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { PageLoader } from "@/components/page-loader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <PageLoader />
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
