import { requireUser } from "@/lib/authz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader><CardTitle>Signed in</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Role: {user.role}. Account status: {user.status}.
          {user.status === "PENDING" && " Your account is awaiting admin approval."}
        </CardContent>
      </Card>
    </div>
  );
}
