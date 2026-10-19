import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timbre",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0D1425",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className="antialiased">
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
