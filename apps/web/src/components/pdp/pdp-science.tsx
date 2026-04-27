import type { ProductContent } from "@/lib/products-content";

interface PdpScienceProps {
  content: ProductContent["science"];
}

export function PdpScience({ content }: PdpScienceProps) {
  return (
    <section
      id="ciencia"
      className="bg-[var(--color-navy)] py-20 text-white"
    >
      <div className="mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-white lg:text-4xl">
          {content.title}
        </h2>
        <p className="mt-5 text-base text-white/80">{content.lead}</p>
      </div>
    </section>
  );
}
