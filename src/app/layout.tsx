import type { Metadata, Viewport } from "next";
import { CodexProvider } from "@/components/CodexProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ST-6 Codex",
  description: "A mobile table for the ST-6 d12 system. Your sheet, the company's trouble, and one GM tonight.",
  applicationName: "ST-6 Codex",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ST-6", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0c0f0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CodexProvider>{children}</CodexProvider>
      </body>
    </html>
  );
}
