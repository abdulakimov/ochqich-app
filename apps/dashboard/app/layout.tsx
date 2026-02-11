import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ochqich Provider Dashboard",
  description: "MVP dashboard for provider consent management"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
