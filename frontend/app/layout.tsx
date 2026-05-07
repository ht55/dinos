import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const angerpoiseFont = localFont({
  src: '../public/fonts/AngerpoiseLampshade.woff2',
  variable: '--font-angerpoise',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'dinos.ext/Battlefield',
  description: 'Exploring unanswerable questions with a system that refuses to answer them — Claude vs Grok',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
      className={`${angerpoiseFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  )
}
