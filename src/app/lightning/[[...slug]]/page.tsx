import { CrmApp } from "@/components/crm/CrmApp";
import { loadBootstrapData } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function LightningPage() {
  const data = await loadBootstrapData();
  return <CrmApp initialData={data} />;
}
