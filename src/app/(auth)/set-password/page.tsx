import { SetPasswordForm } from "@/components/forms/set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const { userId } = await searchParams;
  return <SetPasswordForm userId={userId ?? ""} />;
}
