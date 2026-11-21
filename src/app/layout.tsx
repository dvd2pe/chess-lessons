import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Chess Lessons — Private 1-on-1 chess lesson rooms",
  description: "Mobile-friendly beta for one-on-one chess lessons: request a lesson, get a private room with a shared chessboard and an external audio/video link.",
  keywords: ["chess lessons", "chessboard", "private room", "coach", "student"],
  icons: {
    icon: "/game/pieces/classic/white/k.webp",
  },
  openGraph: {
    title: "Chess Lessons",
    description: "Private 1-on-1 chess lesson rooms with a shared chessboard",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased cg-app">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
