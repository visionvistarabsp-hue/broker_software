import { requireRole } from "@/lib/authz";
import { duplicateQueue } from "@/lib/services/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveDuplicateAction } from "@/lib/actions/crm";

export default async function DuplicatesPage() {
  const admin = await requireRole("ADMIN");
  const queue = await duplicateQueue(admin);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Duplicate review</h1>
        <p className="text-sm text-slate-500">{queue.length} pending · original broker attribution is always preserved</p>
      </div>

      {queue.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-slate-500">Queue is clear. New duplicate phone submissions will appear here.</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {queue.map((r) => (
            <Card key={r.id} className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  {r.lead.customer.fullName}
                  <Badge className="bg-amber-100 text-amber-800">Matches {r.candidateCustomer.fullName}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid sm:grid-cols-2 gap-3 text-slate-600">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-500">NEW SUBMISSION ({r.lead.leadCode})</div>
                    <div className="mt-1">Broker: {r.lead.submittedBy.brokerProfile?.fullName}</div>
                    <div>Phone: {r.lead.customer.phoneOriginal}</div>
                    <div className="text-xs">{new Date(r.createdAt).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-500">EXISTING ({r.candidateCustomer.customerCode})</div>
                    <div className="mt-1">Name: {r.candidateCustomer.fullName}</div>
                    <div>Phone: {r.candidateCustomer.phoneOriginal}</div>
                    <div className="text-xs">Since {new Date(r.candidateCustomer.createdAt).toLocaleString("en-IN")}</div>
                  </div>
                </div>
                <form action={resolveDuplicateAction.bind(null, r.leadId)} className="flex flex-col sm:flex-row gap-2">
                  <input name="reason" placeholder="Decision reason (required)" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="submit" name="decision" value="LINKED" variant="outline">Link</Button>
                    <Button type="submit" name="decision" value="DISTINCT_APPROVED" variant="outline">Distinct</Button>
                    <Button type="submit" name="decision" value="REJECTED" variant="destructive">Reject</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
