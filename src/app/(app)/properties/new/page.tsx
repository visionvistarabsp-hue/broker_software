import { requireRole } from "@/lib/authz";
import { PropertyForm } from "@/components/forms/property-form";

export default async function NewPropertyPage() {
  await requireRole("ADMIN", "MAIN_BROKER");
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New property</h1>
        <p className="text-sm text-slate-500">Only ACTIVE properties can be attached to new leads. Sold/rented/archived stay in history.</p>
      </div>
      <PropertyForm />
    </div>
  );
}
