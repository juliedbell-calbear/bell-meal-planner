import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Bell Family Meal Planner",
  description: "Weekly meal planner for the Bell family",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Bell Meals",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2c2416",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
