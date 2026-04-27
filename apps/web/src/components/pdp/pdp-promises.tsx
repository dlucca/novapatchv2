import type { ProductContent } from "@/lib/products-content";

interface PdpPromisesProps {
  content: ProductContent["promises"];
}

export function PdpPromises({ content }: PdpPromisesProps) {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-coral">
            {content.promise_eyebrow}
          </p>
          <ul className="mt-4 space-y-3">
            {content.promise.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral text-white text-[11px] font-bold"
                >
                  ✓
                </span>
                <span className="text-sm text-navy/85">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/55">
            {content.not_promise_eyebrow}
          </p>
          <ul className="mt-4 space-y-3">
            {content.not_promise.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy/15 text-navy/50 text-[11px] font-bold"
                >
                  ✕
                </span>
                <span className="text-sm text-navy/70">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
