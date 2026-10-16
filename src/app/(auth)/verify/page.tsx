import { VerifyForm } from "@/components/forms/verify-form";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  return <VerifyForm phone={phone ?? ""} />;
}
