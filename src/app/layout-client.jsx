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
      className="pointer-events-none fixed z-[110]"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
        right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
      }}
    >
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="စာမျက်နှာ data ပြန်လည်ရယူမည်"
        title={isOnline ? 'Data ပြန်လည်ရယူမည်' : 'အင်တာနက် ပြန်ရသောအခါ data ပြန်ရယူမည်'}
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-xl font-bold text-white shadow-xl shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-wait disabled:opacity-70"
      >
        <span className={refreshing ? 'animate-spin' : ''} aria-hidden="true">↻</span>
      </button>
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
