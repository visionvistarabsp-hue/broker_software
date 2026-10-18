"use client";

import { useState } from "react";
import type { MatchResult } from "@/lib/services/matching";
import { matchLeadAction } from "@/lib/actions/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LeadMatchPanelProps {
  leadId: string;
}

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

export function LeadMatchPanel({ leadId }: LeadMatchPanelProps) {
  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFind = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await matchLeadAction(leadId);
      if (!res.ok) {
        setError(res.error ?? "Failed to find matches.");
        setMatches(null);
      } else {
        setMatches(res.matches ?? []);
      }
    } catch {
      setError("Unexpected error while finding matches.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Matching Properties</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={handleFind} disabled={loading}>
          {loading ? "Finding matches…" : "Find matching properties"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {matches === null ? null : (
          <>
            {matches.length === 0 && (
              <p className="text-sm text-slate-500">
                No matching active properties found.
              </p>
            )}
            {matches.map((m) => (
              <div key={m.propertyId} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium">{m.title}</span>
                  <Badge className={m.available ? "border-green-200 bg-green-100 text-green-800" : "border-slate-200 bg-slate-100 text-slate-600"}>
                    {m.available ? "Available" : "Unavailable"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-slate-500 mb-1">
                  <span>{m.city}</span>
                  <span>{INR(m.price)}</span>
                  <span className="font-mono">Score {m.score}</span>
                </div>
                {m.matchReasons.length > 0 && (
                  <div className="mb-1">
                    <span className="text-xs font-semibold text-green-700 block mb-0.5">
                      Why it matches
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                      {m.matchReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {m.mismatches.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-amber-700 block mb-0.5">
                      Gaps
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                      {m.mismatches.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 font-mono mt-1">
                  Updated{" "}
                  {new Date(m.lastUpdated).toLocaleDateString("en-IN")}
                </p>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
