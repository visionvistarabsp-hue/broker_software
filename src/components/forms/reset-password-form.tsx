"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetConfirmAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form className="space-y-4" action={(fd) => start(async () => {
      fd.set("email", email);
      const res = await resetConfirmAction(fd);
      if (res.ok) router.push("/login");
      else setError(res.error);
    })}>
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="code">Code</Label><Input id="code" name="code" inputMode="numeric" maxLength={6} required /></div>
      <div className="space-y-2"><Label htmlFor="password">New password</Label><Input id="password" name="password" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required /></div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving..." : "Reset password"}</Button>
    </form>
  );
}
