import { VerifyForm } from "@/components/forms/verify-form";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <VerifyForm email={email ?? ""} />;
}
