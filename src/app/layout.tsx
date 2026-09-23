import type { Metadata, Viewport } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cinzel",
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
});

export const metadata: Metadata = {
  title: "The Kingdoms of Chaos",
  description: "Forge empires from the ashes of the old world — a medieval strategy game.",
  // Installed from a phone's browser, the game opens full screen under its own
  // icon (src/app/icon.png, apple-icon.png, and manifest.webmanifest).
  appleWebApp: { capable: true, title: "TKOC", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#14110c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${garamond.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to realm content</a>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
