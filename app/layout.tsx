import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// PWA installable (§3.2/§3.3) — icône + ouverture plein écran (display: standalone), sans barre
// de navigateur, sur bureau comme sur téléphone. `appleWebApp` couvre les balises spécifiques à
// iOS (apple-touch-icon, apple-mobile-web-app-capable) que le manifest seul ne couvre pas.
export const metadata: Metadata = {
  title: "EVOLUTIS223",
  description: "Gestion interne et boutique EVOLUTIS223",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "EVOLUTIS223",
  },
  icons: {
    icon: "/icons/icon.png",
    apple: "/icons/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
