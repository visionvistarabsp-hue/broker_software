"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyOtpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function VerifyForm({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          fd.set("email", email);
          const res = await verifyOtpAction(fd);
          if (res.ok) router.push(`/set-password?token=${encodeURIComponent(res.data.token)}`);
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <p className="text-sm text-muted-foreground">We sent a 6-digit code to {email}.</p>
      <div className="space-y-2"><Label htmlFor="code">Verification code</Label><Input id="code" name="code" inputMode="numeric" maxLength={6} required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Verifying..." : "Verify"}</Button>
    </form>
  );
}
