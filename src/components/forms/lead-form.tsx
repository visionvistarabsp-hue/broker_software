"use client";

import { useActionState, useState } from "react";
import { submitLeadAction } from "@/lib/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

interface Prop {
  id: string;
  title: string;
  propertyCode: string;
  city: string;
  price: number;
}

export function LeadForm({ properties }: { properties: Prop[] }) {
  const [state, action, pending] = useActionState(async (_: unknown, fd: FormData) => submitLeadAction(fd), null);
  const [phone, setPhone] = useState("");
  const err = state as { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> } | null;
  const fields = err && !err.ok ? err.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Full name *</Label>
            <Input id="customerName" name="customerName" required placeholder="e.g. Ravi Kumar" />
            {fields.customerName && <p className="text-xs text-red-600">{fields.customerName[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerPhone">Phone *</Label>
            <Input id="customerPhone" name="customerPhone" required placeholder="+91…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {fields.customerPhone && <p className="text-xs text-red-600">{fields.customerPhone[0]}</p>}
            <p className="text-[11px] text-slate-500">If this number already exists, the lead goes to duplicate review — original broker keeps credit.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerEmail">Email (optional)</Label>
            <Input id="customerEmail" name="customerEmail" type="email" placeholder="name@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerCity">City</Label>
            <Input id="customerCity" name="customerCity" placeholder="e.g. Pune" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="customerAddress">Address (optional)</Label>
            <Input id="customerAddress" name="customerAddress" placeholder="Street, area…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Requirement</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="propertyId">Property (only ACTIVE shown)</Label>
            <select id="propertyId" name="propertyId" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">No specific property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title} · {p.city} · ₹{p.price.toLocaleString("en-IN")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" name="priority" defaultValue="MEDIUM" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budgetMin">Budget min (₹)</Label>
            <Input id="budgetMin" name="budgetMin" type="number" min={0} placeholder="e.g. 5000000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budgetMax">Budget max (₹)</Label>
            <Input id="budgetMax" name="budgetMax" type="number" min={0} placeholder="e.g. 8000000" />
            {fields.budgetMax && <p className="text-xs text-red-600">{fields.budgetMax[0]}</p>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="preferredLocation">Preferred location</Label>
            <Input id="preferredLocation" name="preferredLocation" placeholder="e.g. Baner, Pune" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="requirements">Requirements</Label>
            <textarea id="requirements" name="requirements" rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="2BHK, near school…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" rows={2} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Anything the team should know…" />
          </div>
        </CardContent>
      </Card>

      {err && !err.ok && <Alert variant="destructive">{err.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-cyan-500">
        {pending ? "Submitting…" : "Submit lead"}
      </Button>
    </form>
  );
}
