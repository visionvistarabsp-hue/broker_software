import { requireUser } from "@/lib/authz";
import { activePropertiesForLead } from "@/lib/services/properties";
import { LeadForm } from "@/components/forms/lead-form";

export default async function NewLeadPage() {
  const user = await requireUser();
  const properties = await activePropertiesForLead(user);
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submit a lead</h1>
        <p className="text-sm text-slate-500">Refer a customer — duplicate numbers are flagged for admin review, never overwritten.</p>
      </div>
      <LeadForm properties={properties} />
    </div>
  );
}
