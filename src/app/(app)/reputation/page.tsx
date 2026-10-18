import { requireUser } from "@/lib/authz";
import { getReputation } from "@/lib/services/reputation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";

function tierFor(score: number): { label: string; className: string } {
  if (score >= 80) return { label: "Platinum", className: "bg-violet-100 text-violet-800" };
  if (score >= 60) return { label: "Gold", className: "bg-amber-100 text-amber-800" };
  if (score >= 40) return { label: "Silver", className: "bg-slate-200 text-slate-700" };
  return { label: "Bronze", className: "bg-orange-100 text-orange-800" };
}

export default async function ReputationPage() {
  const user = await requireUser();
  const rep = await getReputation(user);
  const tier = tierFor(rep.score);

  const rows = [
    { label: "Conversion", points: rep.breakdown.conversion, max: 35, hint: "Converted leads / total submitted" },
    { label: "Follow-ups", points: rep.breakdown.followUps, max: 15, hint: "Completed / assigned" },
    { label: "Site visits", points: rep.breakdown.siteVisits, max: 15, hint: "Completed / scheduled" },
    { label: "Volume", points: rep.breakdown.volume, max: 15, hint: "Leads submitted (saturates at 50)" },
    { label: "Paid commissions", points: rep.breakdown.payouts, max: 20, hint: "Total paid payouts (saturates at ₹10L)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reputation</h1>
        <p className="text-sm text-slate-500">
          Deterministic performance score computed from your live CRM data — no AI, plain arithmetic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Your score
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl font-black text-slate-900">{rep.score}</div>
            <div>
              <Badge className={tier.className}>{tier.label}</Badge>
              <p className="text-xs text-slate-500 mt-1">out of 100</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-800">{r.label}</span>
                  <span className="text-xs text-slate-400 ml-2">{r.hint}</span>
                </div>
                <span className="font-mono text-slate-700">
                  {r.points}/{r.max}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
