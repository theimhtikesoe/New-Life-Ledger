'use client';

import { useEffect, useState } from 'react';
import PINLogin from '@/components/PINLogin';
import BackgroundMusicPlayer from '@/components/BackgroundMusicPlayer';

const APP_ZOOM_KEY = 'new-life-ledger:app-zoom-v1';
const MIN_APP_ZOOM = 0.85;
const MAX_APP_ZOOM = 1.15;
const APP_ZOOM_STEP = 0.05;

function clampAppZoom(value) {
  return Math.min(MAX_APP_ZOOM, Math.max(MIN_APP_ZOOM, Number(value.toFixed(2))));
}

function readAppZoom() {
  if (typeof window === 'undefined') return 1;
  try {
    const storedValue = window.localStorage.getItem(APP_ZOOM_KEY);
    if (storedValue === null) return 1;
    const stored = Number(storedValue);
    return Number.isFinite(stored) ? clampAppZoom(stored) : 1;
  } catch {
    return 1;
  }
}

function writeAppZoom(value) {
  try {
    window.localStorage.setItem(APP_ZOOM_KEY, String(value));
  } catch {
    // Private browsing may disable localStorage; the current session still works.
  }
}

function RefreshOverlay() {
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(window.navigator.onLine !== false);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    // Ask the global player to persist its exact track/time before the
    // full reload. pagehide/beforeunload remain as additional fallbacks.
    window.dispatchEvent(new CustomEvent('new-life-ledger:background-music-save'));
    try {
      const registration = await window.navigator.serviceWorker?.getRegistration();
      await registration?.update();
    } catch {
      // A browser without an active service worker can still perform a normal reload.
    } finally {
      window.location.reload();
    }
  };

  return (
    <div
      className="pwa-quick-actions pointer-events-none fixed z-[110]"
    >
      <div className="relative">
        <div
          className="absolute right-[calc(100%+0.45rem)] top-1/2 flex -translate-y-1/2 items-center gap-0.5 whitespace-nowrap"
          aria-hidden="true"
          >
            <span className="animate-pulse -rotate-6 text-[11px] font-extrabold italic leading-none text-rose-600 drop-shadow-[0_1px_2px_rgba(190,24,93,0.35)]">
              Refresh
            </span>
          <svg
            className="h-6 w-10 animate-pulse overflow-visible text-rose-600"
            viewBox="0 0 54 30"
            fill="none"
          >
            <path d="M3 7C16 1 34 3 47 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M38 9L51 16L39 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M44 12L51 16L45 20" fill="currentColor" />
          </svg>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh — စာမျက်နှာ data ပြန်လည်ရယူမည်"
          title={isOnline ? 'Refresh / Data ပြန်လည်ရယူမည်' : 'အင်တာနက် ပြန်ရသောအခါ Refresh လုပ်မည်'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-lg font-bold text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          <span className={refreshing ? 'animate-spin' : ''} aria-hidden="true">↻</span>
        </button>
      </div>
    </div>
  );
}

function AppZoomControls({ appZoom, onChange }) {
  const zoomPercent = Math.round(appZoom * 100);
  const updateZoom = (delta) => {
    const nextZoom = clampAppZoom(appZoom + delta);
    if (nextZoom === appZoom) return;
    writeAppZoom(nextZoom);
    onChange(nextZoom);
  };

  return (
    <div className="pwa-zoom-controls pointer-events-none fixed z-[110]" aria-label="စာလုံးနှင့် website အရွယ်အစား ပြောင်းရန်">
      <div className="pointer-events-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={() => updateZoom(APP_ZOOM_STEP)}
          disabled={appZoom >= MAX_APP_ZOOM}
          aria-label={`စာလုံးနှင့် website အရွယ်အစား ကြီးရန် — လက်ရှိ ${zoomPercent}%`}
          title={`အရွယ်အစား ကြီးရန် (${zoomPercent}%)`}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-sm font-extrabold text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden="true">A+</span>
        </button>
        <button
          type="button"
          onClick={() => updateZoom(-APP_ZOOM_STEP)}
          disabled={appZoom <= MIN_APP_ZOOM}
          aria-label={`စာလုံးနှင့် website အရွယ်အစား သေးရန် — လက်ရှိ ${zoomPercent}%`}
          title={`အရွယ်အစား သေးရန် (${zoomPercent}%)`}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-sm font-extrabold text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden="true">A−</span>
        </button>
      </div>
    </div>
  );
}

export default function RootLayoutClient({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [appZoom, setAppZoom] = useState(1);

  useEffect(() => {
    setAppZoom(readAppZoom());
  }, []);

  return (
    <>
      <PINLogin onSuccess={() => setAuthenticated(true)} />
      {authenticated && (
        <>
          {/* Mount the global player before page children so it cannot miss the
              first overdue-status/audio event during the PWA startup handshake. */}
          <BackgroundMusicPlayer />
          <RefreshOverlay />
          <AppZoomControls appZoom={appZoom} onChange={setAppZoom} />
          <div
            className="neon-app-shell"
            data-app-zoom={appZoom}
            style={{ zoom: appZoom, width: `${100 / appZoom}%` }}
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}
