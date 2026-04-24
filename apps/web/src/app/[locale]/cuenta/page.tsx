import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchCustomer, ApiError } from "@/lib/api";
import { toBcp47 } from "@/lib/i18n";

export default async function CuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  const { userId, getToken } = await auth();
  if (!userId) {
    redirect(`/${locale}`);
  }
  const token = await getToken();
  if (!token) {
    redirect(`/${locale}`);
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  let customer;
  let error: ApiError | undefined;
  try {
    customer = await fetchCustomer({ token, apiUrl });
  } catch (err) {
    if (err instanceof ApiError) {
      error = err;
    } else {
      throw err;
    }
  }

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {error.code}: {error.message}
      </p>
    );
  }
  if (!customer) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t("email_label")}</dt>
      <dd>{customer.email}</dd>
      <dt className="text-muted-foreground">{t("member_since_label")}</dt>
      <dd>{new Date(customer.createdAt).toLocaleDateString(toBcp47(locale))}</dd>
    </dl>
  );
}
