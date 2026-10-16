import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, variant, ...p }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border p-3 text-sm",
        variant === "destructive" ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-slate-50 text-slate-700",
        className
      )}
      {...p}
    />
  );
}
