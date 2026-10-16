import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  return <ResetPasswordForm phone={phone ?? ""} />;
}
