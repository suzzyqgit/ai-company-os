import type { Metadata } from "next";
import AppNavigation from "@/components/AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Note Tools",
  description: "AI tool development workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
