import { notFound } from "next/navigation";
import { getPublicBrokerProfile } from "@/lib/services/referral";
import { encodeQr, qrToSvg } from "@/lib/qr";
import { ReferralForm } from "@/components/referral-form";

export default async function SharePage({ params }: { params: Promise<{ brokerCode: string }> }) {
  const { brokerCode } = await params;
  const profile = await getPublicBrokerProfile(brokerCode);
  if (!profile) notFound();

  const shareUrl = `/share/${profile.brokerCode}`;
  let svg = "";
  try {
    svg = qrToSvg(encodeQr(shareUrl), { title: `Refer via ${profile.fullName}` });
  } catch {
    svg = "";
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Refer with {profile.fullName}</h1>
          {profile.city && <p className="text-sm text-slate-500">{profile.city}</p>}
          {profile.company && <p className="text-sm text-slate-500">{profile.company}</p>}
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex flex-col items-center gap-2">
            {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
            <p className="text-xs text-slate-500 font-mono break-all">{shareUrl}</p>
            <p className="text-[11px] text-slate-400">
              Scan the code or share this link with someone looking to buy or rent property.
            </p>
          </div>

          <div className="border-t pt-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Submit a referral</h2>
            <ReferralForm brokerCode={profile.brokerCode} />
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Your details are shared only with this broker to help with your property enquiry.
        </p>
      </div>
    </div>
  );
}
