import { SetPasswordForm } from "@/components/forms/set-password-form";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <SetPasswordForm token={token ?? ""} />;
}
