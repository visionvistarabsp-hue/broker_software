import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Broker CRM",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-slate-500">Last updated: 16 October 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Acceptance</h2>
        <p>Using this software (the &quot;Platform&quot;) means you agree to these terms. The Platform is a productivity tool for real-estate channel partners and referral partners; it does not provide legal, financial, or property advice.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Accounts and eligibility</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Only channel partners and referral partners may hold an active account.</li>
          <li>Accounts are PENDING until an administrator (ADMIN role) approves them.</li>
          <li>You are responsible for the phone and password you use and for keeping them confidential.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. What you may not do</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>No scraping, bulk export, or automated access outside the platform interface.</li>
          <li>No attempt to impersonate another broker, the platform owner, or a customer.</li>
          <li>No use of the Platform to store data you are not legally allowed to store.</li>
          <li>No attempt to circumvent rate limits, CSP, or other security controls.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Referral links and share pages</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Each broker has a public share link (and QR code) that exposes only name/city/company and accepts referral submissions.</li>
          <li>Submissions are attributed to the broker who owns the link and come with their own privacy notice.</li>
          <li>You are responsible for the content people submit through your link.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Data and backups</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Your records are stored in the Platform&apos;s hosted database. Export to CSV is available through the Import/Export page.</li>
          <li>Daily/session backups are managed by the operator; restore procedures are documented separately.</li>
          <li>No automatic deletion is promised beyond your explicit export/delete actions.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Pricing, cancellation, liability</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Pricing is configured by the operator and not enforced by this software.</li>
          <li>The Platform is provided &quot;as is&quot;. The operator is not liable for indirect or consequential losses arising from the Platform, including lost revenue or misaligned property matches.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Changes</h2>
        <p>The terms may be updated. Material changes will be announced in-app. Continued use after the change counts as acceptance.</p>
      </section>
    </main>
  );
}
