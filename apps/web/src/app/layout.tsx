import type { Metadata } from "next";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novapatch",
  description: "Parches vitamínicos por suscripción.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body>
          <header className="flex items-center justify-between border-b border-gray-200 p-4">
            <Link href="/" className="text-lg font-semibold">
              Novapatch
            </Link>
            <div className="flex items-center gap-4">
              <SignedIn>
                <Link href="/cuenta" className="text-sm text-gray-700 hover:underline">
                  Mi cuenta
                </Link>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white">
                    Iniciar sesión
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
