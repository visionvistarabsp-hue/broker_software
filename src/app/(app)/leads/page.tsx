import { requireUser } from "@/lib/authz";
import { listLeads } from "@/lib/services/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LEAD_STATUSES } from "@/lib/validation/crm";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  CONTACTED: "bg-cyan-100 text-cyan-800",
  QUALIFIED: "bg-violet-100 text-violet-800",
  SITE_VISIT: "bg-amber-100 text-amber-800",
  NEGOTIATION: "bg-orange-100 text-orange-800",
  CONVERTED: "bg-emerald-100 text-emerald-800",
  LOST: "bg-slate-200 text-slate-600",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const { rows, total } = await listLeads(user, { q: sp.q ?? "", status: sp.status || undefined });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">{total} lead{total === 1 ? "" : "s"} in your scope</p>
        </div>
        <Link href="/leads/new">
          <Button className="bg-gradient-to-r from-indigo-600 to-cyan-500">+ New Lead</Button>
        </Link>
      </div>

      <form className="flex flex-col sm:flex-row gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or lead code…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium text-slate-900">No leads yet</p>
            <p className="text-sm text-slate-500 mt-1">Submit your first referral to get started.</p>
            <Link href="/leads/new" className="inline-block mt-4">
              <Button>Submit a lead</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`}>
              <Card className="hover:shadow-md hover:border-indigo-200 transition-all">
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 truncate">{l.customer.fullName}</span>
                      <Badge className={STATUS_COLORS[l.status] ?? ""}>{l.status}</Badge>
                      {l.duplicateReview && l.duplicateReview.status === "PENDING" && (
                        <Badge className="bg-amber-100 text-amber-800">Duplicate review</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-mono">{l.leadCode} · submitted by {l.submittedBy.brokerProfile?.fullName ?? l.submittedById.slice(0, 6)}</div>
                  </div>
                  <div className="text-sm text-slate-600 sm:text-right">
                    {l.property ? <div className="font-medium">{l.property.title}</div> : <div className="text-slate-400">No property</div>}
                    <div className="text-xs">Priority: {l.priority}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
