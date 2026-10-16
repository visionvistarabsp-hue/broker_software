import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/authz";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <nav className="hidden w-56 shrink-0 border-r p-4 md:block">
        <div className="mb-6 text-lg font-semibold">Broker CRM</div>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard">Dashboard</Link>
          {user.role === "ADMIN" && <Link href="/admin/brokers">Brokers</Link>}
        </div>
        <form action={logoutAction} className="mt-8">
          <Button variant="outline" type="submit" className="w-full">Sign out</Button>
        </form>
      </nav>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
