import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import AgeGate from "@/components/AgeGate";
import { AGE_COOKIE } from "@/lib/constants";
import PwaRegister from "@/components/pwa/PwaRegister";
import InstallPrompt from "@/components/pwa/InstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aura | Explora tu universo",
    template: "%s | Aura",
  },
  description:
    "Suscríbete a creadores independientes, desbloquea contenido exclusivo, envía propinas y conversa directamente con ellos. Plataforma solo para mayores de 18 años.",
  keywords: ["creadores", "suscripciones", "contenido exclusivo", "propinas", "mensajes directos"],
  authors: [{ name: "Aura" }],
  creator: "Aura",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    title: "Aura",
    description: "Apoya a tus creadores favoritos y accede a su contenido exclusivo",
    type: "website",
    locale: "es_MX",
    siteName: "Aura",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Aura" }],
  },
  twitter: { card: "summary", title: "Aura", description: "Apoya a tus creadores favoritos", images: ["/icon-512.png"] },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Aura",
  formatDetection: { telephone: false, email: false, address: false },
  // Instalación en iOS/iPadOS (Añadir a pantalla de inicio). "black" evita que el contenido
  // quede bajo la barra de estado en modo standalone.
  appleWebApp: { capable: true, title: "Aura", statusBarStyle: "black" },
  // Manifest estático en public/manifest.webmanifest (se sobrescribe al copiar el proyecto).
  manifest: "/manifest.webmanifest",
  // Contenido para adultos: se pide a los buscadores que lo traten como tal
  other: { rating: "adult", "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0d0b09",
  width: "device-width",
  initialScale: 1,
  // Permite usar el área completa en móviles con notch; globals.css aplica los márgenes seguros.
  viewportFit: "cover",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ageOk = (await cookies()).get(AGE_COOKIE)?.value === "1";
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {children}
        {!ageOk && <AgeGate />}
        <PwaRegister />
        <InstallPrompt enabled={ageOk} />
      </body>
    </html>
  );
}
