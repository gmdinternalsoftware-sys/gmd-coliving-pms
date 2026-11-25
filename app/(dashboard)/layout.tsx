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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden">
      <PageLoader />
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-y-auto bg-muted/30 px-3 py-4 sm:p-6 md:p-8 lg:p-10">
        <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
