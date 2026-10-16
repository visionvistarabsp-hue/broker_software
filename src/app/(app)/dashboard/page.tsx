import { requireUser } from "@/lib/authz";
import { getDashboardStats } from "@/lib/services/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanSquare, Users, Building2, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireUser();
  const stats = await getDashboardStats(user);

  const cards = [
    { label: "Total leads", value: stats.leadsTotal, icon: KanbanSquare, href: "/leads", gradient: "from-indigo-600 to-cyan-500" },
    { label: "New leads", value: stats.leadsNew, icon: KanbanSquare, href: "/leads?status=NEW", gradient: "from-blue-600 to-sky-500" },
    { label: "Customers", value: stats.customersTotal, icon: Users, href: "/customers", gradient: "from-emerald-600 to-teal-500" },
    { label: "Active properties", value: stats.propertiesActive, icon: Building2, href: "/properties", gradient: "from-violet-600 to-fuchsia-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 capitalize">{user.role.replaceAll("_", " ").toLowerCase()} overview · all numbers from live data</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-slate-900">{stats.conversionRate}%</span>
          <span className="text-slate-500">conversion ({stats.leadsConverted}/{stats.leadsTotal})</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all">
              <CardContent className="py-5 flex items-center gap-3">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${c.gradient} flex items-center justify-center shadow`}>
                  <c.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{c.value}</div>
                  <div className="text-xs text-slate-500">{c.label}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Leads by status</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {stats.leadsByStatus.length === 0 && <p className="text-sm text-slate-500">No leads yet. Submit your first referral from the Leads page.</p>}
            {stats.leadsByStatus.map((s) => (
              <Link key={s.status} href={`/leads?status=${s.status}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-indigo-50">
                <span className="text-sm font-medium">{s.status}</span>
                <Badge>{s.count}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attention needed</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {user.role === "ADMIN" && stats.duplicatesPending > 0 && (
              <Link href="/duplicates" className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-amber-900 hover:bg-amber-100">
                <AlertTriangle className="h-4 w-4" />
                {stats.duplicatesPending} duplicate{stats.duplicatesPending === 1 ? "" : "s"} awaiting review
              </Link>
            )}
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-center justify-between">
              <span>Converted</span><Badge className="bg-emerald-100 text-emerald-800">{stats.leadsConverted}</Badge>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-center justify-between">
              <span>Lost</span><Badge className="bg-slate-200 text-slate-600">{stats.leadsLost}</Badge>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 flex items-center justify-between">
              <span>Total properties</span><Badge>{stats.propertiesTotal}</Badge>
            </div>
            {user.status === "PENDING" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Your account is awaiting admin approval — some actions may be limited.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}