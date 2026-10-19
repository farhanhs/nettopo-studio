import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetTopo Studio",
  description: "網路設備拓樸編輯器",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
