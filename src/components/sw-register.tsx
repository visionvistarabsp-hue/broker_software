"use client";

import { useEffect } from "react";

/**
 * Registers the offline PWA service worker at /sw.js.
 * Idempotent; failures are swallowed so they never break page loads.
 */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
