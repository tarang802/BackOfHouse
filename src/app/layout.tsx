import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Bluff Club",
  description: "Trust No One. Play Your Hand. A private club for recording the card games you play with friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
