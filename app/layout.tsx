import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { I18nProvider } from "@/lib/i18n/context"
import { ThemeProvider } from "@/lib/theme/context"
import { SplashScreen } from "@/components/splash-screen"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
})

export const metadata: Metadata = {
  title: "YouthStation",
  description: "Gençlik topluluğunun uygulaması — iletişim, organizasyon ve üye yönetimi.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YouthStation",
  },
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "512x512", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3B62E8",
}

// Applied before hydration to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('ys-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.add(t);}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const configScript = `window.__YS_CONFIG__=${JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    turnUrls: process.env.TURN_URLS ?? "",
    turnUsername: process.env.TURN_USERNAME ?? "",
    turnCredential: process.env.TURN_CREDENTIAL ?? "",
  })};`

  return (
    <html lang="tr" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: configScript }} />
      </head>
      <body className="font-sans antialiased bg-background">
        <ThemeProvider>
          <SplashScreen />
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
