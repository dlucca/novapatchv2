import type { ProductContent } from "@/lib/products-content";

interface PdpProblemProps {
  content: ProductContent["problem"];
}

export function PdpProblem({ content }: PdpProblemProps) {
  return (
    <section className="bg-[var(--color-blush)] py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-5xl">
          {content.title}
        </h2>
        <p className="mt-5 text-base text-navy/75">{content.lead}</p>
        <ul className="mt-10 grid gap-3 text-left md:grid-cols-2">
          {content.bullets.map((b) => (
            <li
              key={b}
              className="flex items-start gap-3 rounded-2xl bg-white/60 p-4"
            >
              <span aria-hidden className="text-coral font-bold">▸</span>
              <span className="text-sm text-navy/80">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
