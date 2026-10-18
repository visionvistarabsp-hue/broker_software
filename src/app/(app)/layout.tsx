import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/authz";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { unreadCount, listNotifications } from "@/lib/services/notifications";
import { roleLabel } from "@/lib/utils";
import { Sparkles, LayoutDashboard, Users2, Users, Building2, KanbanSquare, AlertTriangle, Menu, CalendarDays, ClipboardList, Upload, Award } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/leads", label: "Leads", icon: KanbanSquare, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/followups", label: "Follow-ups", icon: ClipboardList, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/customers", label: "Customers", icon: Users, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/properties", label: "Properties", icon: Building2, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/import-export", label: "Import/Export", icon: Upload, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/reputation", label: "Reputation", icon: Award, roles: ["ADMIN", "MAIN_BROKER", "REFERRAL_BROKER"] },
  { href: "/duplicates", label: "Duplicates", icon: AlertTriangle, roles: ["ADMIN"] },
  { href: "/admin/brokers", label: "Brokers", icon: Users2, roles: ["ADMIN"] },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const links = NAV.filter((n) => (n.roles as readonly string[]).includes(user.role));
  const [count, recent] = await Promise.all([unreadCount(user), listNotifications(user, { take: 8 })]);
  return (
    <div className="flex min-h-screen bg-slate-50">
      <nav className="hidden w-64 shrink-0 border-r bg-white md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Broker CRM</div>
            <div className="text-[11px] text-slate-500">{roleLabel(user.role)}</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors"
            >
              <l.icon className="h-4 w-4 text-slate-400" />
              {l.label}
            </Link>
          ))}
        </div>
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500">Notifications</span>
            <NotificationsBell initialUnread={count} recent={recent} />
          </div>
          <form action={logoutAction}>
            <Button variant="outline" type="submit" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </nav>
      <div className="flex flex-1 flex-col min-w-0">
        <header className="hidden md:flex sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-8 py-3 items-center justify-end">
          <NotificationsBell initialUnread={count} recent={recent} />
        </header>
        <header className="md:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Broker CRM</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell initialUnread={count} recent={recent} />
            <details className="relative">
            <summary className="list-none cursor-pointer p-2 rounded-lg hover:bg-slate-100">
              <Menu className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-xl border bg-white shadow-lg p-2 text-sm">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100">
                  <l.icon className="h-4 w-4 text-slate-400" />
                  {l.label}
                </Link>
              ))}
              <form action={logoutAction} className="mt-1 border-t pt-1">
                <button type="submit" className="w-full text-left rounded-lg px-3 py-2 text-red-600 hover:bg-red-50">
                  Sign out
                </button>
              </form>
            </div>
            </details>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}