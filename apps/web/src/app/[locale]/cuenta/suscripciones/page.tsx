import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchSubscriptions, ApiError } from "@/lib/api";
import { SubscriptionsList } from "@/components/cuenta/subscriptions-list";

export default async function SuscripcionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const { userId, getToken } = await auth();
  if (!userId) redirect(`/${locale}`);
  const token = await getToken();
  if (!token) redirect(`/${locale}`);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  try {
    const subscriptions = await fetchSubscriptions({ token, apiUrl });
    return (
      <SubscriptionsList
        subscriptions={subscriptions}
        locale={locale}
        apiUrl={apiUrl}
      />
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw err;
  }
}
