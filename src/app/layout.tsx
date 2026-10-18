import type { Metadata } from "next";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "Broker CRM",
  description: "Real estate referral and lead management",
};

// Render every route per-request so the per-request CSP nonce from
// src/middleware.ts can be applied to Next.js/React inline scripts.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
       <body className="min-h-screen bg-background text-foreground antialiased">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
