import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchOrders, ApiError } from "@/lib/api";
import { OrdersList } from "@/components/cuenta/orders-list";

export default async function PedidosPage({
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
    const orders = await fetchOrders({ token, apiUrl });
    return <OrdersList orders={orders} locale={locale} />;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw err;
  }
}
