import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Broker CRM",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-slate-500">Last updated: 16 October 2026</p>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Who we are</h2>
        <p>Broker CRM (&quot;we&quot;, &quot;our&quot;, &quot;the platform&quot;) is the real-estate partner CRM operated by the platform owner. This policy explains how we handle data you place in the platform.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. What we collect</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li><strong>Broker accounts:</strong> name, phone, email (where configured), role, status, referral profile (name, city, company).</li>
          <li><strong>Lead data:</strong> lead code, customer name/phone/email/city, submitted by, assigned to, status, notes.</li>
          <li><strong>Property &amp; customer records:</strong> titles, addresses, photos and documents you upload.</li>
          <li><strong>Usage data:</strong> page views, calendar and follow-up activity, site visits, share-link referrals (broker code).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. How we use it</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>Operate the referral and lead workflow (submission, matching, duplicate review, status changes).</li>
          <li>Feature broker reputation scoring (conversion, follow-ups, site visits, payouts) — publicly visible summary only.</li>
          <li>Send notifications and reminders about your own records.</li>
          <li>Provide support and maintain the platform.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Sharing and third parties</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>We do <strong>not</strong> sell your personal data.</li>
          <li>Share the public broker profile (name, city, company, broker code) on referral share pages and QR codes; private contact details are never shown there.</li>
          <li>We trust third-party services (email, hosting, analytics) to operate with equivalent care and do not give them unrestricted data access.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Data you own</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm">
          <li>You may export or delete your leads, customers, properties, and documents at any time.</li>
          <li>Broker profiles can be deactivated by an administrator; deletion is not guaranteed for records that already exist in third-party backups.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. Security</h2>
        <p>Credentials are hashed (Argon2id), sessions are opaque and hashed, and all writes are authorized server-side with audit logging. This policy describes our practices, not guarantees of absolute security.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">7. Your rights</h2>
        <p className="text-sm text-slate-600">You may request access, correction, or deletion of your personal data. Contact the platform administrator through the app.</p>
      </section>
    </main>
  );
}
