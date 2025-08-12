import "./globals.css";
import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Ämtli Plan - Hacienda Jose',
  description: 'Hacienda Jose Aufgabenplaner',
  icons: {
    icon: '/favicon.ico', // relative to /public
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
