import type { Metadata } from 'next';
import Script from 'next/script';
import { Be_Vietnam_Pro, Lexend } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/globe.min.151d0a8243e1.css';
import 'flag-icons/css/flag-icons.min.css';

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

const lexend = Lexend({
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'UTC',
  description: 'Multi-industry management: Gold, Wood, Paper Production, Rice Business',
  other: {
    'material-icons': 'https://fonts.googleapis.com/icon?family=Material+Icons',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body className={`${beVietnamPro.variable} ${lexend.variable} font-sans antialiased m-0 p-0 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`} style={{ margin: 0, padding: 0 }}>

            <div className="max-w-[1920px] mx-auto m-0 p-0 bg-white dark:bg-gray-900 min-h-screen" style={{ margin: 0, padding: 0 }}>
              {children}
            </div>

        <Script src="https://code.jquery.com/jquery-3.6.0.min.js" strategy="beforeInteractive" />
        <Script src="/js/d3.min.js" strategy="beforeInteractive" />
        <Script src="/js/topojson.min.js" strategy="beforeInteractive" />
        <Script src="/js/animation-data.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js" strategy="beforeInteractive" />
        <Script src="/js/globe.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
