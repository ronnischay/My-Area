import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// D018: Bricolage Grotesque for display, Figtree for everything else. Self-hosted at build time.
const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"], weight: ["500", "700"] });
const body = Figtree({ variable: "--font-body", subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "MyArea",
    template: "%s · MyArea",
  },
  description: "Report problems in your residential society and follow them until they're fixed.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f9f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d130f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the inline script before first paint, so React must not complain about it.
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-pill bg-primary px-4 py-3 font-semibold text-primary-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
