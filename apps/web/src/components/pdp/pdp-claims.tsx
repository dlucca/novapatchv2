import type { ProductContent } from "@/lib/products-content";

interface PdpClaimsProps {
  content: ProductContent["claims"];
}

export function PdpClaims({ content }: PdpClaimsProps) {
  return (
    <section id="claims" className="bg-[var(--color-blush)] py-16">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {content.items.map((claim) => (
            <li
              key={claim}
              className="rounded-full border border-navy/10 bg-white px-4 py-2 text-sm text-navy"
            >
              {claim}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
