import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Management Platform (LMP)",
  description: "Learning management hub for teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <a
          className="sr-only fixed left-3 top-3 z-50 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-offset-2"
          href="#main-content"
        >
          Bỏ qua đến nội dung chính
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
