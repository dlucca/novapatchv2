"use client";

import { useState } from "react";
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

interface NavbarProps {
  locale: string;
}

interface NavItem {
  href: string;
  key: "tienda" | "suscripciones" | "nosotros" | "faq" | "influencers";
}

export function Navbar({ locale }: NavbarProps) {
  const tNav = useTranslations("site.navbar");
  const tAcct = useTranslations("nav");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const base = `/${locale}`;

  const items: NavItem[] = [
    { href: `${base}/tienda`, key: "tienda" },
    { href: `${base}/suscripciones`, key: "suscripciones" },
    { href: `${base}/nosotros`, key: "nosotros" },
    { href: `${base}/faq`, key: "faq" },
    { href: `${base}/influencers`, key: "influencers" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link
          href={base}
          className="text-lg font-black tracking-tight text-navy"
        >
          Novapatch
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-6 md:flex">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                isActive(item.href)
                  ? "text-sm font-semibold text-coral underline underline-offset-4"
                  : "text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {tNav(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SignedIn>
            <Link
              href={`${base}/cuenta`}
              className="hidden text-sm text-muted-foreground hover:text-foreground md:inline"
            >
              {tAcct("mi_cuenta")}
            </Link>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="sm">{tAcct("iniciar_sesion")}</Button>
            </SignInButton>
          </SignedOut>

          {/* Mobile hamburger */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tNav("open_menu")}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Novapatch</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-4 px-4">
                {items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
                    className={
                      isActive(item.href)
                        ? "text-base font-semibold text-coral"
                        : "text-base text-foreground"
                    }
                  >
                    {tNav(item.key)}
                  </Link>
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
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
