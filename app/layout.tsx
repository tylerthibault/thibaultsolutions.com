import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://thibaultsolutions.com"),
  title: { default: "Tyler Thibault — Creator, Builder & Problem Solver", template: "%s — Thibault Solutions" },
  description: "Tyler Thibault is a creator, builder, and problem solver working across content, UGC, AI, software, digital products, and creative projects.",
  alternates: { canonical: "/" },
  openGraph: { title: "Tyler Thibault — Creator, Builder & Problem Solver", description: "Content, software, AI, products, and creative projects — built to be useful, clear, and worth paying attention to.", type: "website", url: "/" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
