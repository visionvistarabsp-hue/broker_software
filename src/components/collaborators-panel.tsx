"use client";

import { useState } from "react";
import { addCollaboratorAction, removeCollaboratorAction } from "@/lib/actions/collaboration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CollaboratorView {
  brokerId: string;
  brokerName: string | null;
  brokerRole: string;
  role: string;
}

interface CollaboratorsPanelProps {
  leadId: string;
  initial: CollaboratorView[];
  canManage: boolean;
}

export function CollaboratorsPanel({ leadId, initial, canManage }: CollaboratorsPanelProps) {
  const [items, setItems] = useState<CollaboratorView[]>(initial);
  const [brokerId, setBrokerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const add = async () => {
    if (!brokerId.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("leadId", leadId);
      fd.set("brokerId", brokerId.trim());
      fd.set("role", "CO_BROKER");
      const res = await addCollaboratorAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed to add collaborator.");
      } else {
        setItems((prev) => [...prev, { brokerId: brokerId.trim(), brokerName: null, brokerRole: "—", role: "CO_BROKER" }]);
        setBrokerId("");
        setMessage("Collaborator added.");
      }
    } catch {
      setError("Unexpected error.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (bid: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await removeCollaboratorAction(leadId, bid);
      if (!res.ok) {
        setError(res.error ?? "Failed to remove collaborator.");
      } else {
        setItems((prev) => prev.filter((c) => c.brokerId !== bid));
        setMessage("Collaborator removed.");
      }
    } catch {
      setError("Unexpected error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Collaborators</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-500">No collaborators on this lead yet.</p>}
        {items.map((c) => (
          <div key={c.brokerId} className="flex items-center justify-between border rounded-lg p-3 text-sm">
            <div>
              <span className="font-medium">{c.brokerName ?? c.brokerId}</span>
              <Badge className="ml-2">{c.role}</Badge>
            </div>
            {canManage && (
              <Button variant="outline" onClick={() => remove(c.brokerId)} disabled={busy}>
                Remove
              </Button>
            )}
          </div>
        ))}

        {canManage && (
          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1">
              <Label htmlFor="collab-broker-id">Add broker by ID</Label>
              <Input
                id="collab-broker-id"
                value={brokerId}
                onChange={(e) => setBrokerId(e.target.value)}
                placeholder="Broker user ID"
              />
            </div>
            <Button onClick={add} disabled={busy || !brokerId.trim()}>
              Add
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </CardContent>
    </Card>
  );
}
