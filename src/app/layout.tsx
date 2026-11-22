import type { Metadata, Viewport } from "next";
import { CodexProvider } from "@/components/CodexProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ST-6 Codex",
  description: "A mobile table for the ST-6 d12 system. Your sheet, the company's trouble, and one GM tonight.",
  applicationName: "ST-6 Codex",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ST-6", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
