"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          const res = await registerAction(fd);
          if (res.ok) router.push(`/verify?phone=${encodeURIComponent(res.data.phone)}`);
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required /></div>
      <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" name="phone" placeholder="+91 98765 43210" required /></div>
      <div className="space-y-2"><Label htmlFor="email">Email (optional)</Label><Input id="email" name="email" type="email" /></div>
      <div className="space-y-2">
        <Label htmlFor="role">I am registering as</Label>
        <select id="role" name="role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="MAIN_BROKER">Main Broker</option>
          <option value="REFERRAL_BROKER">Referral Broker / Partner</option>
        </select>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" className="mt-1" required />
        <span>I consent to the privacy notice and terms, and to being contacted about my account.</span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending code..." : "Create account"}</Button>
    </form>
  );
}
