import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { AppProvider } from "@/context/AppContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Logistics Distribution Tool",
  description: "Automated logistics order distribution system",
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
                <main className="flex-1 ml-64 p-8">{children}</main>
              </div>
            )}
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
