"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function SetPasswordForm({ userId }: { userId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          fd.set("userId", userId);
          const res = await setPasswordAction(fd);
          if (res.ok) router.push("/dashboard");
          else setError(res.error);
        })
      }
    >
      {error && <Alert className="border-destructive text-destructive">{error}</Alert>}
      <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required /></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required /></div>
      <p className="text-xs text-muted-foreground">At least 10 characters, including a letter and a digit.</p>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving..." : "Set password & continue"}</Button>
    </form>
  );
}
