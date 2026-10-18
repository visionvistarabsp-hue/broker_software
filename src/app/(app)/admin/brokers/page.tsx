import { requireRole } from "@/lib/authz";
import { listBrokers } from "@/lib/services/brokers";
import { approveBrokerAction, suspendBrokerAction, reactivateBrokerAction } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/utils";

export default async function AdminBrokersPage() {
  const admin = await requireRole("ADMIN");
  const brokers = await listBrokers(admin);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Partners</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr><th className="p-3">Name</th><th className="p-3">Code</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {brokers.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">{b.brokerProfile?.fullName ?? "—"}</td>
                <td className="p-3 font-mono text-xs">{b.brokerProfile?.brokerCode ?? "—"}</td>
                <td className="p-3">{roleLabel(b.role)}</td>
                <td className="p-3"><Badge>{b.status}</Badge></td>
                <td className="flex gap-2 p-3">
                  {b.status === "PENDING" && (
                    <form action={approveBrokerAction.bind(null, b.id)}><Button variant="outline" type="submit">Approve</Button></form>
                  )}
                  {b.status === "ACTIVE" && (
                    <form action={suspendBrokerAction.bind(null, b.id)}><Button variant="destructive" type="submit">Suspend</Button></form>
                  )}
                  {b.status === "SUSPENDED" && (
                    <form action={reactivateBrokerAction.bind(null, b.id)}><Button variant="outline" type="submit">Reactivate</Button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
