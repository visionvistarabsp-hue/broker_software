import { requireUser } from "@/lib/authz";
import { CsvImportExport } from "@/components/csv-import-export";

export default async function ImportExportPage() {
  await requireUser();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import / Export</h1>
        <p className="text-sm text-slate-500">
          Move leads, properties and customers in and out of the broker software as CSV.
        </p>
      </div>
      <CsvImportExport />
    </div>
  );
}
