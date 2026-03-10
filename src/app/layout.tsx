import type { Metadata } from "next";
import PasswordGate from "@/components/shared/PasswordGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Integrations Team Performance",
  description: "Performance dashboard for the Integrations team at Yuno",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PasswordGate>{children}</PasswordGate>
      </body>
    </html>
  );
}
