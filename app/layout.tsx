import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gary 的作品库",
  description: "视频、培训和酒店沙盘，凭访问密码查看。",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
