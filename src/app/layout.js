import "./globals.css";
import RootLayoutClient from "./layout-client";

export const metadata = {
  title: "New Life Ledger",
  description: "KPay webhook automation and customer ledger dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "New Life Ledger",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#00d4ff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="my">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="New Life Ledger" />
        <meta name="theme-color" content="#00d4ff" />
        <meta name="msapplication-TileColor" content="#00d4ff" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body style={{ background: "#f1f5f9", minHeight: "100vh" }}>
        <RootLayoutClient>{children}</RootLayoutClient>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (() => {
            if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
            const clearLegacyWorker = async () => {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map((registration) => registration.unregister()));
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.filter((name) => name.startsWith('new-life-ledger-')).map((name) => caches.delete(name)));
            };
            window.addEventListener('load', () => clearLegacyWorker().catch(() => {}), { once: true });
          })();
        `,
      }}
    />
  );
}
