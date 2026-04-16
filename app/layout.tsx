import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "MC PvP Tierlist",
  description: "Competitive Minecraft PvP rankings and match tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
