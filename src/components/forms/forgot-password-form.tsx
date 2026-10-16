"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetRequestAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-4" action={(fd) => start(async () => {
      const res = await resetRequestAction(fd);
      if (res.ok) router.push(`/reset-password?phone=${encodeURIComponent(res.data.phone)}`);
      else setError(res.error);
    })}>
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" name="phone" required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending..." : "Send reset code"}</Button>
    </form>
  );
}
