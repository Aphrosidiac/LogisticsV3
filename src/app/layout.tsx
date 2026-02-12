import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// const inter = Inter({
//   variable: "--font-inter",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Logistics Distribution Tool",
  description: "Automated logistics order distribution system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-zinc-950 font-sans" suppressHydrationWarning>
        <ErrorBoundary>
          <AppProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-64 p-8">{children}</main>
            </div>
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
