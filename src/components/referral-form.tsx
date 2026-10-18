"use client";

import { useState } from "react";
import { submitReferralAction } from "@/lib/actions/collaboration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReferralForm({ brokerCode }: { brokerCode: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setReference(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await submitReferralAction(brokerCode, fd);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong. Please try again.");
      } else {
        setReference(res.reference ?? null);
        e.currentTarget.reset();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-semibold">Thank you — your referral has been received.</p>
        <p className="mt-1">
          Reference: <span className="font-mono font-semibold">{reference}</span>
        </p>
        <p className="mt-1 text-green-800">Our team will get in touch with you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="customerName">Your name *</Label>
        <Input id="customerName" name="customerName" required maxLength={120} placeholder="Full name" />
      </div>
      <div>
        <Label htmlFor="customerPhone">Phone *</Label>
        <Input id="customerPhone" name="customerPhone" required placeholder="+91 98765 43210" />
      </div>
      <div>
        <Label htmlFor="customerEmail">Email (optional)</Label>
        <Input id="customerEmail" name="customerEmail" type="email" placeholder="you@example.com" />
      </div>
      <div>
        <Label htmlFor="city">City (optional)</Label>
        <Input id="city" name="city" maxLength={120} placeholder="e.g. Mumbai" />
      </div>
      <div>
        <Label htmlFor="message">What are you looking for? (optional)</Label>
        <Input id="message" name="message" maxLength={2000} placeholder="Budget, location, property type…" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Submitting…" : "Submit referral"}
      </Button>
      <p className="text-[11px] text-slate-500">
        By submitting, you agree to be contacted about your property enquiry.
      </p>
    </form>
  );
}
