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

function SettingsToggle({ open, onToggle }) {
  return (
    <div className="pwa-settings-toggle pointer-events-none fixed z-[110]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="pwa-settings-controls"
        aria-label={open ? 'Settings ကိုပိတ်ရန်' : 'Settings ကိုဖွင့်ရန်'}
        title={open ? 'Settings ကိုပိတ်ရန်' : 'Settings ကိုဖွင့်ရန်'}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          <path d="m19.4 15-.1.2a1.8 1.8 0 0 0 0 1.8l.1.2-1.8 1.8-.2-.1a1.8 1.8 0 0 0-1.8 0l-.2.1-1.8-1.8.1-.2a1.8 1.8 0 0 0 0-1.8l-.1-.2.1-.2a1.8 1.8 0 0 0 0-1.8l-.1-.2 1.8-1.8.2.1a1.8 1.8 0 0 0 1.8 0l.2-.1 1.8 1.8-.1.2a1.8 1.8 0 0 0 0 1.8Z" />
        </svg>
      </button>
    </div>
  );
}

function AppZoomControls({ appZoom, onChange, settingsOpen }) {
  const zoomPercent = Math.round(appZoom * 100);
  const updateZoom = (delta) => {
    const nextZoom = clampAppZoom(appZoom + delta);
    if (nextZoom === appZoom) return;
    writeAppZoom(nextZoom);
    onChange(nextZoom);
  };

  return (
    <div
      id="pwa-settings-controls"
      className={`pwa-zoom-controls pointer-events-none fixed z-[110] ${settingsOpen ? 'pwa-settings-group-visible' : 'pwa-settings-group-hidden'}`}
      aria-label="စာလုံးနှင့် website အရွယ်အစား ပြောင်းရန်"
      aria-hidden={!settingsOpen}
    >
      <div className="pointer-events-auto flex flex-col gap-2">
        <button
          type="button"
          onClick={() => updateZoom(APP_ZOOM_STEP)}
          disabled={appZoom >= MAX_APP_ZOOM}
          aria-label={`စာလုံးနှင့် website အရွယ်အစား ကြီးရန် — လက်ရှိ ${zoomPercent}%`}
          title={`အရွယ်အစား ကြီးရန် (${zoomPercent}%)`}
          tabIndex={settingsOpen ? 0 : -1}
          className="flex h-12 w-14 items-center justify-center rounded-xl border-2 border-white bg-cyan-700 text-lg font-black text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden="true">A+</span>
        </button>
        <button
          type="button"
          onClick={() => updateZoom(-APP_ZOOM_STEP)}
          disabled={appZoom <= MIN_APP_ZOOM}
          aria-label={`စာလုံးနှင့် website အရွယ်အစား သေးရန် — လက်ရှိ ${zoomPercent}%`}
          title={`အရွယ်အစား သေးရန် (${zoomPercent}%)`}
          tabIndex={settingsOpen ? 0 : -1}
          className="flex h-12 w-14 items-center justify-center rounded-xl border-2 border-white bg-cyan-700 text-lg font-black text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <BackgroundMusicPlayer settingsOpen={settingsOpen} />
          <RefreshOverlay />
          <SettingsToggle open={settingsOpen} onToggle={() => setSettingsOpen((current) => !current)} />
          <AppZoomControls appZoom={appZoom} onChange={setAppZoom} settingsOpen={settingsOpen} />
          <div className="neon-app-shell-viewport">
            <div
              className="neon-app-shell"
              data-app-zoom={appZoom}
              style={{ zoom: appZoom, width: `${100 / appZoom}%`, marginInline: 'auto' }}
            >
              {children}
            </div>
          </div>
        </>
      )}
    </>
  );
}
