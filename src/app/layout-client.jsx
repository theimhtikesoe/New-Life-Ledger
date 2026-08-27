'use client';

import { useEffect, useState } from 'react';
import PINLogin from '@/components/PINLogin';

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
          <span className="animate-pulse -rotate-6 text-[13px] font-extrabold italic leading-none text-rose-600 drop-shadow-[0_1px_2px_rgba(190,24,93,0.35)]">
            Refresh
          </span>
          <svg
            className="h-8 w-12 animate-pulse overflow-visible text-rose-600"
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
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-xl font-bold text-white shadow-xl shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-wait disabled:opacity-70"
        >
          <span className={refreshing ? 'animate-spin' : ''} aria-hidden="true">↻</span>
        </button>
      </div>
    </div>
  );
}

export default function RootLayoutClient({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  return (
    <>
      <PINLogin onSuccess={() => setAuthenticated(true)} />
      {authenticated && (
        <>
          {children}
          <RefreshOverlay />
        </>
      )}
    </>
  );
}
