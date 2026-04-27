import { PlanBuilder } from "@/components/plan/plan-builder";

export default async function SuscripcionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main>
      <PlanBuilder locale={locale} />
    </main>
  );
}
