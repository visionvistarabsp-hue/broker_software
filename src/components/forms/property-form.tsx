"use client";

import { useActionState } from "react";
import { createPropertyAction } from "@/lib/actions/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export function PropertyForm() {
  const [state, action, pending] = useActionState(async (_: unknown, fd: FormData) => createPropertyAction(fd), null);
  const err = state as { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> } | null;
  const fields = err && !err.ok ? err.fieldErrors ?? {} : {};

  return (
    <form action={action} className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required placeholder="e.g. 2BHK Apartment in Baner" />
            {fields.title && <p className="text-xs text-red-600">{fields.title[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <select id="type" name="type" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
              {["APARTMENT", "VILLA", "HOUSE", "PLOT", "COMMERCIAL", "OFFICE", "SHOP", "LAND", "OTHER"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="listingType">Listing</Label>
            <select id="listingType" name="listingType" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
              <option value="SALE">Sale</option>
              <option value="RENT">Rent</option>
              <option value="LEASE">Lease</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" name="city" required placeholder="e.g. Pune" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locality">Locality</Label>
            <Input id="locality" name="locality" placeholder="e.g. Baner" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="Street address" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Price & size</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (₹) *</Label>
            <Input id="price" name="price" type="number" min={0} required placeholder="e.g. 7500000" />
            {fields.price && <p className="text-xs text-red-600">{fields.price[0]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area (sq.ft.)</Label>
            <Input id="area" name="area" type="number" min={0} placeholder="e.g. 1100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bedrooms">Beds</Label>
              <Input id="bedrooms" name="bedrooms" type="number" min={0} placeholder="2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bathrooms">Baths</Label>
              <Input id="bathrooms" name="bathrooms" type="number" min={0} placeholder="2" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="description">Description</Label>
            <textarea id="description" name="description" rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Facing, floor, amenities…" />
          </div>
        </CardContent>
      </Card>

      {err && !err.ok && <Alert variant="destructive">{err.error}</Alert>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-cyan-500">
        {pending ? "Saving…" : "Save property"}
      </Button>
    </form>
  );
}
