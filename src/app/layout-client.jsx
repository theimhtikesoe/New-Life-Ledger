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
      className="pointer-events-none fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5"
      style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="စာမျက်နှာ data ပြန်လည်ရယူမည်"
        title={isOnline ? 'Data ပြန်လည်ရယူမည်' : 'အင်တာနက် ပြန်ရသောအခါ data ပြန်ရယူမည်'}
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-300/90 bg-white/95 text-lg font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:border-cyan-400 hover:text-cyan-700 active:scale-95 disabled:cursor-wait disabled:opacity-70"
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
