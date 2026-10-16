import { requireUser } from "@/lib/authz";
import { getLead } from "@/lib/services/leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { changeLeadStatusAction } from "@/lib/actions/crm";
import { LEAD_STATUSES } from "@/lib/validation/crm";
import { notFound } from "next/navigation";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let lead;
  try {
    lead = await getLead(user, id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lead.customer.fullName}</h1>
          <p className="text-sm text-slate-500 font-mono">{lead.leadCode} · Priority {lead.priority}</p>
        </div>
        <Badge className="w-fit text-sm px-3 py-1">{lead.status}</Badge>
      </div>

      {lead.duplicateReview && lead.duplicateReview.status === "PENDING" && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm">
            <span className="font-semibold text-amber-900">Duplicate review pending.</span>{" "}
            <span className="text-amber-800">This phone matches {lead.duplicateReview.candidateCustomer.fullName} ({lead.duplicateReview.candidateCustomer.customerCode}). An admin will link, approve as distinct, or reject.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Name:</span> {lead.customer.fullName}</div>
            <div><span className="text-slate-500">Phone:</span> {lead.customer.phoneOriginal}</div>
            {lead.customer.email && <div><span className="text-slate-500">Email:</span> {lead.customer.email}</div>}
            {lead.customer.city && <div><span className="text-slate-500">City:</span> {lead.customer.city}</div>}
            {lead.customer.address && <div><span className="text-slate-500">Address:</span> {lead.customer.address}</div>}
            <div className="text-xs text-slate-400 font-mono pt-1">{lead.customer.customerCode}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Deal info</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Submitted by:</span> {lead.submittedBy.brokerProfile?.fullName ?? "—"}</div>
            {lead.assignedTo && <div><span className="text-slate-500">Assigned to:</span> {lead.assignedTo.brokerProfile?.fullName ?? "—"}</div>}
            <div><span className="text-slate-500">Property:</span> {lead.property ? `${lead.property.title} (${lead.property.propertyCode})` : "—"}</div>
            {(lead.budgetMin != null || lead.budgetMax != null) && (
              <div><span className="text-slate-500">Budget:</span> ₹{(lead.budgetMin ?? 0).toLocaleString("en-IN")} – ₹{(lead.budgetMax ?? 0).toLocaleString("en-IN")}</div>
            )}
            {lead.preferredLocation && <div><span className="text-slate-500">Location:</span> {lead.preferredLocation}</div>}
            {lead.requirements && <div><span className="text-slate-500">Requirements:</span> {lead.requirements}</div>}
            {lead.notes && <div><span className="text-slate-500">Notes:</span> {lead.notes}</div>}
            {lead.lostReason && <div><span className="text-slate-500">Loss reason:</span> {lead.lostReason}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Change status</CardTitle></CardHeader>
        <CardContent>
          <form action={changeLeadStatusAction.bind(null, lead.id)} className="flex flex-col sm:flex-row gap-2">
            <select name="status" defaultValue={lead.status} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input name="reason" placeholder="Reason / note (required for LOST)" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <Button type="submit" variant="outline">Update</Button>
          </form>
          <p className="text-[11px] text-slate-500 mt-2">Invalid transitions are rejected server-side. Every change records actor + timestamp.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {lead.history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <div>
                  <div className="font-medium text-slate-900">
                    {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Created as ${h.toStatus}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {h.changedBy.brokerProfile?.fullName ?? "System"} · {new Date(h.createdAt).toLocaleString("en-IN")}
                    {h.reason ? ` · ${h.reason}` : ""}
                  </div>
                </div>
              </li>
            ))}
            {lead.history.length === 0 && <p className="text-sm text-slate-500">No history yet.</p>}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
