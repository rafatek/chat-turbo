import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"

export const dynamic = 'force-dynamic';

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Plataforma Turbo IA",
  description: "Plataforma de IA e Atendimento Omnichannel",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-light-32x32.png", 
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Injeta de forma segura APENAS variáveis públicas lidas em runtime no container
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "Chat Turbo",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "",
    NEXT_PUBLIC_UAZAPI_URL: process.env.NEXT_PUBLIC_UAZAPI_URL || "",
    NEXT_PUBLIC_SERVER_ID: process.env.NEXT_PUBLIC_SERVER_ID || "",
    NEXT_PUBLIC_SUPORTE_URL: process.env.NEXT_PUBLIC_SUPORTE_URL || "",
  }

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          id="__RUNTIME_ENV__"
          dangerouslySetInnerHTML={{
            __html: `
              window.__ENV = ${JSON.stringify(publicEnv)};
              try {
                window.process = window.process || {};
                window.process.env = window.process.env || {};
                Object.assign(window.process.env, window.__ENV);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
