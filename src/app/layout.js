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
  themeColor: "#00d4ff",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body>
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

            let registrationPromise;
            const updateServiceWorker = () => {
              registrationPromise = registrationPromise || navigator.serviceWorker.register('/service-worker-v3.js', {
                updateViaCache: 'none',
              });
              registrationPromise.then((registration) => {
                registration.update().catch(() => {});
              }).catch((error) => {
                console.warn('Service Worker registration failed:', error);
              });
            };

            window.addEventListener('load', updateServiceWorker, { once: true });
            window.addEventListener('pageshow', updateServiceWorker);
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') updateServiceWorker();
            });
          })();
        `,
      }}
    />
  );
}
