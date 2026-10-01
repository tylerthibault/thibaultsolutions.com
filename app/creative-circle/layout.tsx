import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Creative Circle",
  robots: { index: false, follow: false },
  manifest: "/creative-circle/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Creative Circle",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  viewportFit: "cover",
};

export default function CreativeCircleLayout({ children }: { children: React.ReactNode }) {
  return <div className="cc-page">{children}</div>;
}
