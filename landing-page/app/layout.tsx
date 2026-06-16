import type { Metadata } from "next";
import { Syne, Roboto_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tends",
  description:
    "AI-managed RWA portfolios on Mantle. Three strategies. One mix-it-yourself. Always on.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `history.scrollRestoration="manual";window.scrollTo(0,0);window.addEventListener("pageshow",function(e){if(e.persisted)window.location.reload()});` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
