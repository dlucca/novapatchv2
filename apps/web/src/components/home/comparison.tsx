import { getTranslations } from "next-intl/server";

const ROWS = ["absorption", "release", "no_liver", "no_sugar", "no_water", "no_forgetting"] as const;
const COLUMNS = ["novapatch", "capsules", "gummies"] as const;

type Cell = boolean | string;
const CELLS: Record<(typeof ROWS)[number], [Cell, Cell, Cell]> = {
  absorption:    ["90%",    "10–20%", "10–20%"],
  release:       ["10–12h", "2–4h",   "2–4h"],
  no_liver:      [true,     false,    false],
  no_sugar:      [true,     true,     false],
  no_water:      [true,     false,    false],
  no_forgetting: [true,     false,    false],
};

interface ComparisonProps {
  locale?: string;
}

export async function Comparison({ locale = "es" }: ComparisonProps) {
  const t = await getTranslations({ locale, namespace: "pages.home.comparison" });
  const renderCell = (v: Cell): string => (v === true ? "✓" : v === false ? "✗" : v);

  return (
    <section id="comparativa" className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">{t("eyebrow")}</span>
        <h2 className="mt-3 font-outfit text-4xl font-black leading-tight text-navy lg:text-5xl">
          {t("title_a")}{" "}
          <span className="font-newsreader italic font-normal text-coral">{t("title_b_italic")}</span>
        </h2>
        <p className="mt-3 text-navy/70">{t("lead")}</p>

        {/* Mobile cards */}
        <div data-layout="mobile" className="mt-10 space-y-4 md:hidden">
          {COLUMNS.map((col, i) => (
            <article
              key={col}
              className={
                i === 0
                  ? "rounded-3xl bg-navy p-6 text-white"
                  : "rounded-3xl border border-navy/10 bg-white p-6 text-navy"
              }
            >
              <div className="flex items-center gap-2">
                {i === 0 && (
                  <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase">
                    {t("winner_badge")}
                  </span>
                )}
                <h3 className="font-outfit text-xl font-black">{t(`columns.${col}.name`)}</h3>
              </div>
              <p className="text-sm opacity-70">{t(`columns.${col}.sub`)}</p>
              <dl className="mt-4 space-y-2 text-sm">
                {ROWS.map((r) => (
                  <div key={r} className="flex justify-between border-t border-current/10 pt-2">
                    <dt className="opacity-70">{t(`rows.${r}`)}</dt>
                    <dd className="font-semibold">{renderCell(CELLS[r][i] as Cell)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        {/* Desktop table grid */}
        <div
          data-layout="desktop"
          className="mt-10 hidden md:grid"
          style={{ gridTemplateColumns: "1.6fr 1.1fr 1fr 1fr" }}
        >
          <div />
          {COLUMNS.map((col, i) => (
            <div
              key={col}
              className={`relative px-4 pb-4 text-center ${i === 0 ? "bg-[rgba(248,237,235,0.35)] rounded-t-2xl" : ""}`}
            >
              {i === 0 && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-1 text-[10px] font-bold uppercase text-white">
                  {t("winner_badge")}
                </span>
              )}
              <p className="font-outfit text-lg font-black text-navy">{t(`columns.${col}.name`)}</p>
              <p className="text-xs text-navy/60">{t(`columns.${col}.sub`)}</p>
            </div>
          ))}

          {ROWS.map((r) => (
            <div key={r} className="contents">
              <div className="border-t border-navy/10 px-4 py-3 text-sm text-navy/70">{t(`rows.${r}`)}</div>
              {COLUMNS.map((_, i) => {
                const v = CELLS[r][i] as Cell;
                const cls = i === 0 ? "bg-[rgba(248,237,235,0.35)]" : "";
                return (
                  <div
                    key={i}
                    className={`border-t border-navy/10 px-4 py-3 text-center text-sm ${cls}`}
                  >
                    {typeof v === "boolean" ? (
                      <span
                        aria-hidden
                        className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          v ? "bg-coral text-white" : "bg-navy/10 text-navy/40"
                        }`}
                      >
                        {v ? "✓" : "✗"}
                      </span>
                    ) : (
                      <span className="font-semibold text-navy">{v}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
