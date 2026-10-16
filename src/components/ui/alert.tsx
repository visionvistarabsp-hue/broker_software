import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn("rounded-md border p-3 text-sm", className)} {...p} />;
}
