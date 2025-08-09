import "./globals.css";

export const metadata = {
  title: "Ämtli Plan - Hacienda Jose",
  description: "Planner for weekly & biweekly tasks",
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
