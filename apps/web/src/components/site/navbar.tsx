"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CountrySelector } from "@/components/site/country-selector";
import { CartButton } from "@/components/cart/cart-button";
import { HOME_ANCHORS } from "@/lib/home-anchors";

interface NavbarProps {
  locale: string;
}

export function Navbar({ locale }: NavbarProps) {
  const tNav = useTranslations("site.navbar");
  const tHome = useTranslations("components.navbar.links");
  const tAcct = useTranslations("nav");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const base = `/${locale}`;
  const isHome = pathname === base || pathname === `${base}/`;
  const variant: "transparent" | "default" = isHome ? "transparent" : "default";

  useEffect(() => {
    if (variant !== "transparent") return;
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  const headerCls =
    variant === "transparent"
      ? `absolute left-0 right-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? "bg-navy/[0.92] backdrop-blur" : "bg-transparent"
        }`
      : "sticky top-0 z-40 border-b border-navy/10 bg-cream";

  const linkCls =
    variant === "transparent"
      ? "text-sm text-white/85 hover:text-white"
      : "text-sm text-navy/70 hover:text-navy";

  const homeAnchors = [
    { href: `#${HOME_ANCHORS.products}`, key: "products" as const },
    { href: `#${HOME_ANCHORS.science}`, key: "science" as const },
    { href: `#${HOME_ANCHORS.comparison}`, key: "comparison" as const },
  ];

  return (
    <header className={headerCls}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href={base}
          className={`text-lg font-black tracking-tight ${
            variant === "transparent" ? "text-white" : "text-navy"
          }`}
        >
          Novapatch<span className="text-coral">.</span>
        </Link>

        {/* Home-only anchor links */}
        {isHome && (
          <nav className="hidden items-center gap-6 md:flex">
            {homeAnchors.map((a) => (
              <a key={a.key} href={a.href} className={linkCls}>
                {tHome(a.key)}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          {/* Country selector — desktop only (mobile lives inside the sheet) */}
          <div className="hidden md:flex items-center gap-2">
            <CountrySelector />
          </div>
          <CartButton
            {...(variant === "transparent" && { variant: "transparent" as const })}
          />
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button
                size="sm"
                className={
                  variant === "transparent"
                    ? "bg-white text-navy hover:bg-white/90"
                    : ""
                }
              >
                {tAcct("iniciar_sesion")}
              </Button>
            </SignInButton>
          </SignedOut>

          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tNav("open_menu")}
                className={`md:hidden ${
                  variant === "transparent" ? "text-white hover:bg-white/10" : ""
                }`}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Novapatch</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-4 px-4">
                {isHome &&
                  homeAnchors.map((a) => (
                    <a
                      key={a.key}
                      href={a.href}
                      onClick={() => setSheetOpen(false)}
                      className="text-base text-foreground"
                    >
                      {tHome(a.key)}
                    </a>
                  ))}
                <SignedIn>
                  <Link
                    href={`${base}/cuenta`}
                    onClick={() => setSheetOpen(false)}
                    className="text-base text-muted-foreground"
                  >
                    {tAcct("mi_cuenta")}
                  </Link>
                </SignedIn>
                <div className="mt-2 border-t border-navy/10 pt-4">
                  <CountrySelector expanded />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
