import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Cityads CRM",
  description: "Affiliate Network Operations Tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
