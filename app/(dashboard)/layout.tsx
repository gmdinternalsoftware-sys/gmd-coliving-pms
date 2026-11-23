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
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-8 lg:p-10">
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
