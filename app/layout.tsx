import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masa | Düz Okey",
  description: "Arkadaşlarınla normal okey oyna. Bağlantıyla oda kur, eksik koltukları botlar doldursun.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
