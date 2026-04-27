import { getTranslations } from "next-intl/server";

const TIERS = [
  { days: 30, off: 20, color: "var(--teal)", k: "30" as const },
  { days: 60, off: 15, color: "var(--sky)", k: "60" as const },
  { days: 90, off: 10, color: "var(--gold)", k: "90" as const },
];

interface SubscriptionTeaserProps {
  locale?: string;
}

export async function SubscriptionTeaser({ locale = "es" }: SubscriptionTeaserProps) {
  const t = await getTranslations({ locale, namespace: "pages.home.subscription_teaser" });
  return (
    <section className="px-4 py-20">
      <div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] p-10 lg:p-16"
        style={{ background: "linear-gradient(135deg, #0D1B35 0%, #1A2D4D 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 400px at 20% 30%, rgba(242,92,84,0.18), transparent 60%), radial-gradient(700px 400px at 80% 80%, rgba(30,177,188,0.18), transparent 60%)",
          }}
        />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
            <h2 className="mt-3 font-outfit text-4xl font-black text-white lg:text-5xl">
              {t("title_a")}{" "}
              <span className="font-newsreader italic font-normal text-[var(--gold)]">
                {t("title_b_italic")}
              </span>
            </h2>
            <p className="mt-4 max-w-md text-white/80">{t("lead")}</p>
            <a
              href="#productos"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white hover:bg-coral/90"
            >
              {t("cta")} →
            </a>
            <p className="mt-3 text-xs text-white/60">{t("no_commitment")}</p>
          </div>

          <ul className="space-y-3">
            {TIERS.map((tier) => (
              <li
                key={tier.k}
                className="flex items-center justify-between rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
              >
                <div>
                  <p className="font-outfit text-lg font-black text-white">
                    {t(`tiers.${tier.k}.freq`)}
                  </p>
                  <p className="text-xs text-white/60">{t(`tiers.${tier.k}.tag`)}</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 font-outfit text-sm font-black"
                  style={{ background: tier.color, color: "var(--navy)" }}
                >
                  {t("discount_format", { percent: tier.off })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
