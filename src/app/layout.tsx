import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy Feed Journal",
  description:
    "An AI-native, friendly app that records feed and food for babies. Enjoy baby growing up time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="text-slate-800 antialiased">{children}</body>
    </html>
  );
}
