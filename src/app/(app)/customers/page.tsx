import { requireRole } from "@/lib/authz";
import { listCustomers } from "@/lib/services/customers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomerAction } from "@/lib/actions/crm";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole("ADMIN", "MAIN_BROKER", "REFERRAL_BROKER");
  const sp = await searchParams;
  const { rows, total } = await listCustomers(user, { q: sp.q ?? "" });
  const canAdd = user.role === "ADMIN" || user.role === "MAIN_BROKER";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">{total} customer{total === 1 ? "" : "s"} visible to you</p>
        </div>
        <form className="flex gap-2" method="get">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, phone, code…" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-64" />
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      {canAdd && (
        <Card>
          <CardContent className="py-4">
            <form action={createCustomerAction} className="grid gap-3 sm:grid-cols-5">
              <div className="space-y-1"><Label htmlFor="fullName">Name *</Label><Input id="fullName" name="fullName" required placeholder="Full name" /></div>
              <div className="space-y-1"><Label htmlFor="phone">Phone *</Label><Input id="phone" name="phone" required placeholder="+91…" /></div>
              <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="Optional" /></div>
              <div className="space-y-1"><Label htmlFor="city">City</Label><Input id="city" name="city" placeholder="Optional" /></div>
              <div className="flex items-end"><Button type="submit" className="w-full">Add</Button></div>
            </form>
            <p className="text-[11px] text-slate-500 mt-2">Existing numbers are flagged as duplicates — original broker attribution is always preserved.</p>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">No customers found.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Phone</th><th className="p-3">City</th><th className="p-3">Leads</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{c.fullName}</td>
                  <td className="p-3 font-mono text-xs">{c.customerCode}</td>
                  <td className="p-3 font-mono text-xs">{c.phoneOriginal}</td>
                  <td className="p-3">{c.city ?? "—"}</td>
                  <td className="p-3"><Badge>{c._count.leads}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
