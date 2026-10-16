import { requireUser } from "@/lib/authz";
import { listProperties } from "@/lib/services/properties";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-slate-200 text-slate-600",
  SOLD: "bg-blue-100 text-blue-800",
  RENTED: "bg-violet-100 text-violet-800",
  ARCHIVED: "bg-stone-200 text-stone-600",
};

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string; city?: string; status?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { rows, total } = await listProperties(user, { q: sp.q ?? "", city: sp.city, status: sp.status });
  const canAdd = user.role === "ADMIN" || user.role === "MAIN_BROKER";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500">{total} propert{total === 1 ? "y" : "ies"}</p>
        </div>
        {canAdd && <Link href="/properties/new"><Button className="bg-gradient-to-r from-indigo-600 to-cyan-500">+ New Property</Button></Link>}
      </div>

      <form className="flex flex-col sm:flex-row gap-2" method="get">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title, code, locality…" className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
        <input name="city" defaultValue={sp.city ?? ""} placeholder="City" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-40" />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SOLD">Sold</option>
          <option value="RENTED">Rented</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>

      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">No properties match your filters.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((p) => {
            const r = p as Record<string, unknown>;
            return (
              <Card key={String(r.id)} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900">{String(r.title)}</div>
                    <Badge className={STATUS_COLORS[String(r.status)] ?? ""}>{String(r.status)}</Badge>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{String(r.locality ?? "")} {String(r.city ?? "")}</div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="font-bold text-indigo-700">₹{Number(r.price).toLocaleString("en-IN")}</div>
                    <div className="text-xs text-slate-500 font-mono">{String(r.propertyCode)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
