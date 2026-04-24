import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchCustomer, ApiError } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function CuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cuenta" });

  const { userId, getToken } = await auth();
  if (!userId) {
    // Middleware should have caught this; defensive redirect.
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

  return (
    <main className="min-h-screen p-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          {customer ? (
            <CardDescription>{customer.email}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive text-sm">
              {error.code}: {error.message}
            </p>
          ) : customer ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("email_label")}</dt>
              <dd>{customer.email}</dd>
              <dt className="text-muted-foreground">{t("member_since_label")}</dt>
              <dd>{new Date(customer.createdAt).toLocaleDateString(locale)}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">{t("loading")}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
