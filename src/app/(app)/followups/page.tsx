import { requireUser } from "@/lib/authz";
import { listFollowUps, type FollowUpScope } from "@/lib/services/followups";
import { listLeads } from "@/lib/services/leads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createFollowUpAction, completeFollowUpAction, cancelFollowUpAction, rescheduleFollowUpAction } from "@/lib/actions/productivity";

const SCOPES: FollowUpScope[] = ["today", "upcoming", "overdue", "all"];
const EMPTY: Record<FollowUpScope, string> = { today: "Nothing due today.", upcoming: "No upcoming follow-ups.", overdue: "No overdue follow-ups.", all: "No follow-ups yet." };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: FollowUpScope = SCOPES.includes(sp.filter as FollowUpScope) ? (sp.filter as FollowUpScope) : "today";
  const [rows, leadPage] = await Promise.all([listFollowUps(user, { scope }), listLeads(user, { pageSize: 50 })]);
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-sm text-slate-500">{rows.length} items · IST (Asia/Kolkata)</p></div>
        <Link href="/calendar"><Button variant="outline">Calendar</Button></Link>
      </div>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filters">
        {SCOPES.map((s) => (<Link key={s} href={`/followups?filter=${s}`}><Button variant={scope === s ? "default" : "outline"}>{s}</Button></Link>))}
      </div>
      {rows.length === 0 ? (<Card><CardContent className="py-12 text-center"><p className="font-medium">{EMPTY[scope]}</p></CardContent></Card>) : (
      <div className="grid gap-3">{rows.map((f) => (
        <Card key={f.id}><CardContent className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{f.title}</span>
                {f.isOverdue && <Badge className="bg-red-100 text-red-800">Overdue</Badge>}
                <Badge className="bg-blue-100 text-blue-800">{f.priority}</Badge>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {f.lead ? (<Link href={`/leads/${f.lead.id}`} className="font-mono text-indigo-700 hover:underline">{f.lead.customer?.fullName ?? "Lead"} · {f.lead.leadCode}</Link>) : f.leadId.slice(0, 8)}
                {" · "}{new Date(f.dueAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
              {f.description && <p className="text-sm text-slate-600 mt-1">{f.description}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <form action={completeFollowUpAction.bind(null, f.id)}><Button variant="outline">Done</Button></form>
              <form action={cancelFollowUpAction.bind(null, f.id)}><Button variant="outline">Cancel</Button></form>
            </div>
          </div>
          <details className="rounded-lg bg-slate-50 border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">Reschedule</summary>
            <form action={rescheduleFollowUpAction.bind(null, f.id)} className="mt-2 flex flex-col sm:flex-row gap-2">
              <input type="datetime-local" name="newDueAt" required aria-label="New due date" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <input type="text" name="reason" placeholder="Reason" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
              <Button type="submit">Save</Button>
            </form>
          </details>
        </CardContent></Card>))}
      </div>)}
      <Card><CardContent className="pt-6">
        <form action={createFollowUpAction} className="grid gap-3 sm:grid-cols-2">
          <select name="leadId" required aria-label="Lead" className="rounded-lg border px-3 py-2 text-sm">
            <option value="">Select lead…</option>
            {leadPage.rows.map((l) => (<option key={l.id} value={l.id}>{(l.customer as unknown as { fullName: string })?.fullName ?? "Lead"} · {l.leadCode}</option>))}
          </select>
          <input name="title" required placeholder="Title" aria-label="Title" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="dueAt" type="datetime-local" required aria-label="Due at" className="rounded-lg border px-3 py-2 text-sm" />
          <select name="priority" defaultValue="MEDIUM" aria-label="Priority" className="rounded-lg border px-3 py-2 text-sm">
            <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
          </select>
          <Button type="submit" className="sm:col-span-2 bg-gradient-to-r from-indigo-600 to-cyan-500">Create follow-up</Button>
        </form>
      </CardContent></Card>
    </div>);
}
