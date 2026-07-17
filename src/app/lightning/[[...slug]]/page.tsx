import { CrmApp } from "@/components/crm/CrmApp";
import { loadBootstrapData } from "@/lib/bootstrap";
import { AppAuthorizationError } from "@/lib/organization-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LightningPage() {
  try {
    const data = await loadBootstrapData();
    return <CrmApp initialData={data} />;
  } catch (error) {
    if (error instanceof AppAuthorizationError) redirect(error.status === 401 ? "/auth/keycloak?callbackUrl=/lightning/page/home" : "/no-organization");
    throw error;
  }
}
