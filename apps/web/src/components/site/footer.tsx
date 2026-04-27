import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface FooterProps {
  locale: string;
}

export async function Footer({ locale }: FooterProps) {
  const t = await getTranslations({ locale, namespace: "site.footer" });
  const base = `/${locale}`;

  const columns = [
    {
      title: t("sections.navega"),
      links: [
        { href: `${base}/tienda`, label: t("links.tienda") },
        { href: `${base}/suscripciones`, label: t("links.suscripciones") },
        { href: `${base}/faq`, label: t("links.faq") },
        { href: `${base}/contacto`, label: t("links.contacto") },
      ],
    },
    {
      title: t("sections.legales"),
      links: [
        { href: `${base}/privacidad`, label: t("links.privacidad") },
        { href: `${base}/terminos`, label: t("links.terminos") },
        { href: `${base}/terminos-influencers`, label: t("links.terminos_influencers") },
        { href: `${base}/garantia`, label: t("links.garantia") },
        { href: `${base}/reembolso`, label: t("links.reembolso") },
      ],
    },
    {
      title: t("sections.novapatch"),
      links: [
        { href: `${base}/nosotros`, label: t("links.nosotros") },
        { href: `${base}/influencers`, label: t("links.influencers") },
      ],
    },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-navy">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            {t("copyright")} · {t("tagline")}
          </p>
          <a
            href={`mailto:${t("contact_email")}`}
            className="hover:text-foreground"
          >
            {t("contact_label")}
          </a>
        </div>
      </div>
    </footer>
  );
}
