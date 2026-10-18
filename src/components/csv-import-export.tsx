"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  exportLeadsAction,
  exportPropertiesAction,
  exportCustomersAction,
  importLeadsAction,
  importPropertiesAction,
  importCustomersAction,
  type ImportResult,
  type ExportResult,
} from "@/lib/actions/csv";

type Kind = "lead" | "property" | "customer";

const KIND_LABELS: Record<Kind, string> = {
  lead: "Leads",
  property: "Properties",
  customer: "Customers",
};

const EXPORT_ACTIONS: Record<Kind, () => Promise<{ ok: boolean; data?: ExportResult; error?: string; fieldErrors?: Record<string, string[]> }>> = {
  lead: exportLeadsAction,
  property: exportPropertiesAction,
  customer: exportCustomersAction,
};

const IMPORT_ACTIONS: Record<Kind, (csv: string) => Promise<{ ok: boolean; data?: ImportResult; error?: string; fieldErrors?: Record<string, string[]> }>> = {
  lead: importLeadsAction,
  property: importPropertiesAction,
  customer: importCustomersAction,
};

export function CsvImportExport() {
  const [kind, setKind] = useState<Kind>("lead");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await EXPORT_ACTIONS[kind]();
      setLoading(false);
      if (result.ok && result.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage(`Exported ${result.data.rowCount} ${KIND_LABELS[kind]} to "${result.data.filename}".`);
      } else {
        setError(result.error ?? "Export failed.");
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }, [kind]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsvText(null);
    setError(null);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
    };
    reader.onerror = () => {
      setError("Could not read the uploaded file.");
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await IMPORT_ACTIONS[kind](csvText);
      setLoading(false);
      if (result.ok && result.data) {
        const { imported, totalRows, skipped } = result.data;
        setCsvText(null);
        setFileName(null);
        if (fileInput.current) fileInput.current.value = "";
        setMessage(
          `Imported ${imported} of ${totalRows} ${KIND_LABELS[kind]}${skipped ? ` (skipped ${skipped})` : ""}.`
        );
      } else {
        setError(result.error ?? "Import failed.");
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Import failed.");
    }
  }, [csvText, kind]);

  const clear = useCallback(() => {
    setCsvText(null);
    setFileName(null);
    setError(null);
    setMessage(null);
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const previewLines = csvText ? csvText.split(/\r?\n/).slice(0, 6) : [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Import / Export (CSV)</h2>
        <p className="text-sm text-slate-500">
          Export your leads, properties or customers to CSV, or import new records from a CSV file.
        </p>
      </div>

      <div className="flex gap-2">
        {(["lead", "property", "customer"] as Kind[]).map((k) => (
          <Button
            key={k}
            onClick={() => setKind(k)}
            className={`text-sm ${kind === k ? "bg-indigo-600 text-white" : "bg-white border border-slate-200"}`}
          >
            {KIND_LABELS[k]}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{`${KIND_LABELS[kind]} — Export`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Downloads a CSV of all {kind === "lead" ? "leads in your scope" : kind === "property" ? "properties you created" : "customers in your scope"}.
          </p>
          <Button onClick={handleExport} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Exporting…" : `Download ${kind === "lead" ? "Leads" : kind === "property" ? "Properties" : "Customers"} CSV`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`${KIND_LABELS[kind]} — Import`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Upload a CSV file with a header row. Required columns are highlighted in the template below.
          </p>

          <div className="flex items-center gap-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input id="csv-file" type="file" accept=".csv" ref={fileInput} onChange={handleFileChange} disabled={loading} />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-900">{fileName}</span>
              <Button variant="outline" onClick={clear}>
                Change file
              </Button>
            </div>
          )}

          {csvText && (
            <div className="border rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-700 overflow-x-auto max-h-48 overflow-y-auto">
              {previewLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {csvText.split(/\r?\n/).length > 6 && <div className="text-slate-500">…</div>}
            </div>
          )}

          {error && <Alert variant="destructive">{error}</Alert>}
          {message && <Alert>{message}</Alert>}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleImport}
              disabled={loading || !csvText}
              className="w-full sm:w-auto"
            >
              {loading ? "Importing…" : "Import CSV"}
            </Button>
            <p className="text-xs text-slate-500">Max 500 rows per file.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {kind === "lead" && (
            <>
              <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                customerName,customerPhone,customerEmail,city,budgetMin,budgetMax,priority,source{"\n"}
                {'"Aanya Sharma","+91 98765 43210","aanya@example.com","Mumbai","8000000","12000000","HIGH","REFERRAL"'}
              </div>
              <p className="text-xs text-slate-500">
                Required: customerName, customerPhone. Optional: customerEmail, customerAddress, customerCity,
                propertyId, budgetMin, budgetMax, preferredLocation, requirements, notes, priority
                (LOW|MEDIUM|HIGH|URGENT), source, assignedToId (admin only).
              </p>
            </>
          )}
          {kind === "property" && (
            <>
              <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                title,type,listingType,address,city,price,area,bedrooms,bathrooms,status{"\n"}
                {'"3BHK Sea View","APARTMENT","SALE","Marine Drive, Mumbai","Mumbai","25000000","1200","3","3","ACTIVE"'}
              </div>
              <p className="text-xs text-slate-500">
                Required: title, city, price. Optional: type (APARTMENT|VILLA|HOUSE|PLOT|COMMERCIAL|OFFICE|SHOP|LAND|OTHER),
                listingType (SALE|RENT|LEASE), address, locality, priceMin, priceMax, area, bedrooms, bathrooms,
                furnishing, description, ownerContact, status (ACTIVE|INACTIVE|SOLD|RENTED|ARCHIVED).
              </p>
            </>
          )}
          {kind === "customer" && (
            <>
              <div className="text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                fullName,phone,email,address,city{"\n"}
                {'"Rohan Mehta","+91 98765 12345","rohan@example.com","Bandra West","Mumbai"'}
              </div>
              <p className="text-xs text-slate-500">
                Required: fullName, phone. Optional: email, address, city.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

