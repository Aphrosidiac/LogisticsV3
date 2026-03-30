import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Shuda Logistics — Distribution Management",
  description: "Shuda Logistics distribution management system — order routing, driver dispatch, and WhatsApp integration",
  icons: {
    icon: "/logo-original.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-zinc-950 font-sans" suppressHydrationWarning>
        <ErrorBoundary>
          <AppProvider>
            {isLoginPage ? (
              <>{children}</>
            ) : (
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 min-w-0">
                  <div className="flex justify-end px-8 pt-4">
                    <ThemeToggle />
                  </div>
                  <div className="px-8 pb-8">{children}</div>
                </main>
              </div>
            )}
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
