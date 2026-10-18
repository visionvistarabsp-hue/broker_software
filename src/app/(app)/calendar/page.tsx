import { requireUser } from "@/lib/authz";
import { listFollowUps } from "@/lib/services/followups";
import { listSiteVisits } from "@/lib/services/sitevisits";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ y?: string; m?: string; day?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const y = Number(sp.y) || now.getFullYear();
  const m = Math.min(12, Math.max(1, Number(sp.m) || now.getMonth() + 1));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  const [fus, visits] = await Promise.all([listFollowUps(user, { from: start, to: end }), listSiteVisits(user, { from: start, to: end })]);
  const firstDow = (start.getDay() + 6) % 7;
  const days = end.getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const byDay = new Map<number, { fu: number; visit: number; overdue: number }>();
  for (const f of fus) { const d = new Date(f.dueAt).getDate(); const e = byDay.get(d) ?? { fu: 0, visit: 0, overdue: 0 }; e.fu++; if (f.isOverdue) e.overdue++; byDay.set(d, e); }
  for (const v of visits) { const d = new Date(v.scheduledAt).getDate(); const e = byDay.get(d) ?? { fu: 0, visit: 0, overdue: 0 }; e.visit++; byDay.set(d, e); }
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const selDay = sp.day ? Number(sp.day) : null;
  const shown = selDay ? fus.filter((f) => new Date(f.dueAt).getDate() === selDay) : fus;
  const label = start.toLocaleString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Calendar</h1><p className="text-sm text-slate-500">{label} · IST (Asia/Kolkata)</p></div>
        <div className="flex gap-2">
          <Link href={`/calendar?y=${prev.y}&m=${prev.m}`}><Button variant="outline">Prev</Button></Link>
          <Link href={`/calendar?y=${next.y}&m=${next.m}`}><Button variant="outline">Next</Button></Link>
        </div>
      </div>
      <Card><CardContent className="pt-6">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">{WD.map((w) => (<div key={w} className="py-1">{w}</div>))}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="min-h-16 rounded-lg bg-slate-50" />;
            const s = byDay.get(d);
            return (
              <Link key={i} href={`/calendar?y=${y}&m=${m}&day=${d}`} className={`min-h-16 rounded-lg border p-1 text-left text-sm ${selDay === d ? "border-indigo-500 ring-1 ring-indigo-500" : "border-slate-200"}`}>
                <div className="font-medium">{d}</div>
                {s && (<div className="mt-1 flex flex-wrap gap-1">
                  {s.fu > 0 && <span className="h-2 w-2 rounded-full bg-indigo-500" title={`${s.fu} follow-ups`} />}
                  {s.visit > 0 && <span className="h-2 w-2 rounded-full bg-emerald-500" title={`${s.visit} visits`} />}
                  {s.overdue > 0 && <span className="h-2 w-2 rounded-full bg-red-500" title={`${s.overdue} overdue`} />}
                </div>)}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex gap-3 text-xs text-slate-500">
          <span><span className="inline-block h-2 w-2 rounded-full bg-indigo-500 mr-1" />Follow-up</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />Visit</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1" />Overdue</span>
        </div>
      </CardContent></Card>
      <div className="grid gap-2">
        {shown.length === 0 ? (<Card><CardContent className="py-8 text-center text-sm text-slate-500">No items{selDay ? ` on day ${selDay}` : " this month"}.</CardContent></Card>) :
        shown.map((f) => (<Card key={f.id}><CardContent className="py-3 flex items-center gap-2 text-sm">
          {f.isOverdue ? <Badge className="bg-red-100 text-red-800">Overdue</Badge> : <Badge className="bg-indigo-100 text-indigo-800">Follow-up</Badge>}
          <span className="font-medium truncate">{f.title}</span>
          <span className="ml-auto text-xs text-slate-500 shrink-0">{new Date(f.dueAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
        </CardContent></Card>))}
        {visits.filter((v) => !selDay || new Date(v.scheduledAt).getDate() === selDay).map((v) => (<Card key={v.id}><CardContent className="py-3 flex items-center gap-2 text-sm">
          <Badge className="bg-emerald-100 text-emerald-800">Visit</Badge>
          <span className="font-medium truncate">{v.lead?.customer?.fullName ?? v.leadId.slice(0, 8)}</span>
          <span className="ml-auto text-xs text-slate-500 shrink-0">{new Date(v.scheduledAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
        </CardContent></Card>))}
      </div>
    </div>);
}
