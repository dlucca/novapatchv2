import type { ProductContent, LucideIconName } from "@/lib/products-content";
import {
  Sun,
  Moon,
  Sparkles,
  Shield,
  Heart,
  Coffee,
  Sunrise,
  Wind,
  Leaf,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<LucideIconName, LucideIcon> = {
  Sun,
  Moon,
  Sparkles,
  Shield,
  Heart,
  Coffee,
  Sunrise,
  Wind,
  Leaf,
};

interface PdpMomentsProps {
  content: ProductContent["moments"];
}

export function PdpMoments({ content }: PdpMomentsProps) {
  return (
    <section className="bg-cream py-20">
      <div className="mx-auto max-w-6xl px-4">
        <span className="text-xs uppercase tracking-wider text-coral">
          {content.eyebrow}
        </span>
        <h2 className="mt-3 font-outfit text-3xl font-black leading-tight text-navy lg:text-4xl">
          {content.title}
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {content.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li
                key={item.title}
                className="rounded-3xl bg-white p-6 shadow-sm"
              >
                <Icon
                  aria-hidden
                  className="h-7 w-7 text-coral"
                  strokeWidth={1.8}
                />
                <p className="mt-4 font-outfit text-lg font-black text-navy">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-navy/70">{item.desc}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
