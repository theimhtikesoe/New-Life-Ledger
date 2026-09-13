'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import PINLogin from '@/components/PINLogin';
import BackgroundMusicPlayer from '@/components/BackgroundMusicPlayer';
import { formatMyanmarClock, formatMyanmarDateLabel } from '@/lib/myanmar-time-client';

const APP_ZOOM_KEY = 'new-life-ledger:app-zoom-v1';
const MIN_APP_ZOOM = 0.85;
const MAX_APP_ZOOM = 1.15;
const APP_ZOOM_STEP = 0.05;
const BLOSSOM_PETALS = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 17 + 7) % 100}%`,
  delay: `${(index % 9) * -1.9}s`,
  duration: `${13 + (index % 6) * 2}s`,
  size: `${9 + (index % 4) * 2}px`,
  drift: `${-80 + (index % 7) * 28}px`,
  rotate: `${(index * 31) % 180}deg`,
}));

function BlossomOverlay() {
  return (
    <div className="blossom-overlay" aria-hidden="true">
      {BLOSSOM_PETALS.map((petal, index) => (
        <span
          key={index}
          className="blossom-petal"
          style={{
            '--blossom-left': petal.left,
            '--blossom-delay': petal.delay,
            '--blossom-duration': petal.duration,
            '--blossom-size': petal.size,
            '--blossom-drift': petal.drift,
            '--blossom-rotate': petal.rotate,
          }}
        />
      ))}
    </div>
  );
}

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

function GlobalActionLoadingIndicator() {
  const [pendingRequests, setPendingRequests] = useState(0);
  const [recentAction, setRecentAction] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let actionTimer;
    const startAction = () => {
      setRecentAction(true);
      window.clearTimeout(actionTimer);
      actionTimer = window.setTimeout(() => setRecentAction(false), 1500);
    };
    const handleAction = (event) => {
      if (event.target?.closest?.('[data-no-global-loading="true"]')) return;
      startAction();
    };
    const trackedFetch = (...args) => {
      const requestHeaders = args[1]?.headers;
      const isBackgroundRequest = requestHeaders?.get?.('x-background-request') === 'true'
        || requestHeaders?.['x-background-request'] === 'true';
      if (isBackgroundRequest) return originalFetch(...args);
      setPendingRequests((count) => count + 1);
      startAction();
      return originalFetch(...args).finally(() => {
        setPendingRequests((count) => Math.max(0, count - 1));
      });
    };

    window.fetch = trackedFetch;
    document.addEventListener('click', handleAction, true);
    document.addEventListener('submit', handleAction, true);
    return () => {
      window.fetch = originalFetch;
      document.removeEventListener('click', handleAction, true);
      document.removeEventListener('submit', handleAction, true);
      window.clearTimeout(actionTimer);
    };
  }, []);

  if (!recentAction && pendingRequests === 0) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-cyan-800 shadow-lg backdrop-blur-sm" role="status" aria-live="polite" aria-label="လုပ်ဆောင်နေသည်">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-700" aria-hidden="true" />
      <span>လုပ်ဆောင်နေသည်...</span>
    </div>
  );
}

function SaveReviewModal({ review, onCancel, onConfirm }) {
  if (!review) return null;
  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.3)]">
        <div className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-violet-50 px-5 py-4">
          <p className="text-xs font-black tracking-wide text-cyan-700">မသိမ်းမီ ပြန်လည်စစ်ဆေးရန်</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">အချက်အလက် မှန်ပါသလား?</h2>
          <p className="mt-1 text-sm text-slate-600">မှန်ကန်ပါက အတည်ပြုပြီးမှသာ Database ထဲ သိမ်းပါမည်။</p>
        </div>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto p-5">
          {review.fields.length ? review.fields.map((field) => (
            <div key={`${field.label}-${field.value}`} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <span className="shrink-0 font-bold text-slate-500">{field.label}</span>
              <span className="max-w-[65%] break-words text-right font-black text-slate-900">{field.value || "—"}</span>
            </div>
          )) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">ဖြည့်ထားသောအချက်အလက်များကို ပြန်စစ်ပါ။</p>}
        </div>
        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">ပြန်ပြင်မည်</button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-cyan-600 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700">အတည်ပြုပြီး သိမ်းမည်</button>
        </div>
      </div>
    </div>
  );
}

const PAGE_HEADERS = {
  '/activity': 'Activity History',
  '/auto-report-status': 'Auto Report အခြေအနေ',
  '/balance-detail': 'လက်ကျန်ငွေ အသေးစိတ်',
  '/cap-stock': 'စက်ရုံအဖုံးလက်ကျန်',
  '/customer-management': 'Customer Management',
  '/daily-bottle-sales': 'တစ်နေ့တာ ဗူးရောင်းစာရင်း',
  '/daily-summary': 'Daily Summary',
  '/data-management': 'Data Management',
  '/discounts': 'Customer လျှော့စျေးမှတ်တမ်း',
  '/factory-stock': 'စက်ရုံဗူးလက်ကျန်',
  '/orders': 'Customer Orders',
  '/production': 'ထွက်ရှိမှု မှတ်တမ်းတင်ရန်',
  '/production-history': 'ထွက်ရှိမှုမှတ်တမ်းများ',
  '/tube-production-history': 'Tube ထွက်ရှိမှု အသေးစိတ်',
  '/tube-stock': 'စက်ရုံ Tube လက်ကျန် အသေးစိတ်',
  '/trace': 'Trace / Lineage Center',
  '/price-settings': 'စျေးနှုန်းသတ်မှတ်ရန်',
  '/vercel-build-logs': 'Vercel Build Logs',
};

function ActorSwitcher({ actorName }) {
  if (!actorName) return null;
  const requestActorChange = () => {
    window.dispatchEvent(new CustomEvent('new-life-ledger:open-actor-selector'));
  };

  return (
    <div className="actor-switcher pointer-events-none fixed z-[115]">
      <button
        type="button"
        onClick={requestActorChange}
        className="pointer-events-auto flex min-h-10 items-center gap-2 rounded-full border border-cyan-200 bg-white/95 px-3 py-2 text-xs font-bold text-cyan-900 shadow-lg shadow-cyan-900/10 backdrop-blur transition hover:border-cyan-400 hover:bg-cyan-50"
        aria-label={`လက်ရှိ User ${actorName} — User ပြောင်းရန် နှိပ်ပါ`}
        title="User ပြောင်းရန် နှိပ်ပါ"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-black text-cyan-800" aria-hidden="true">U</span>
        <span className="max-w-24 truncate sm:max-w-36">{actorName}</span>
        <span aria-hidden="true">⌄</span>
      </button>
    </div>
  );
}

function SharedPageHeader({ pathname, actorName }) {
  const title = PAGE_HEADERS[pathname];
  const normalizedActorName = String(actorName || '').trim();
  const showDashboardLink = normalizedActorName !== 'ဇွဲဇွဲ' && normalizedActorName !== 'ဖြိုးကို' && normalizedActorName !== 'သက်မွန်နှင်း' && (normalizedActorName !== 'ဆောင်းဦး' || pathname === '/balance-detail');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!title || pathname === '/' || pathname === '/ledger') return null;

  return (
    <header className="shared-page-header shared-page-header-route neon-surface neon-sweep mx-3 flex min-h-[170px] flex-col justify-between rounded-2xl border border-cyan-200/80 bg-white/90 px-3 py-3 shadow-sm backdrop-blur sm:mx-6 sm:px-5 sm:py-5">
      <div className="relative flex min-h-[136px] flex-1 flex-col justify-between">
        {showDashboardLink ? (
          <div className="shared-page-header-nav flex min-h-10 items-center">
            <Link href="/" className="text-sm font-medium text-cyan-700 transition hover:text-cyan-900">← Dashboard</Link>
          </div>
        ) : <div className="min-h-10" aria-hidden="true" />}
        <div className="mx-auto min-w-0 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-700">ယနေ့ရက်စွဲ</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{formatMyanmarDateLabel(currentTime)}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-cyan-700 tabular-nums">{formatMyanmarClock(currentTime)}</p>
          <p className="text-[11px] text-slate-500">Myanmar Time (UTC+06:30)</p>
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs text-cyan-600 sm:text-sm">New Life Ledger Dashboard</p>
          <h1 className="mt-1 max-w-full break-words text-[clamp(1rem,4.5vw,1.55rem)] font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
        </div>
      </div>
    </header>
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
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-cyan-700 text-sm font-extrabold text-white shadow-lg shadow-cyan-950/30 ring-2 ring-cyan-700/20 transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden="true">A+</span>
        </button>
        <Link
          href="/price-settings"
          aria-label="စျေးနှုန်းသတ်မှတ်ရန် Page သို့သွားမည်"
          title="စျေးနှုန်းသတ်မှတ်ရန်"
          tabIndex={settingsOpen ? 0 : -1}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-black text-white shadow-lg shadow-amber-950/30 ring-2 ring-amber-500/20 transition hover:bg-amber-600 active:scale-95"
        >
          Ks
        </Link>
        <button
          type="button"
          onClick={() => updateZoom(-APP_ZOOM_STEP)}
          disabled={appZoom <= MIN_APP_ZOOM}
          aria-label={`စာလုံးနှင့် website အရွယ်အစား သေးရန် — လက်ရှိ ${zoomPercent}%`}
          title={`အရွယ်အစား သေးရန် (${zoomPercent}%)`}
          tabIndex={settingsOpen ? 0 : -1}
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
  const [actorName, setActorName] = useState('');
  const [appZoom, setAppZoom] = useState(1);
  const pathname = usePathname();
  const router = useRouter();
  const isProductionOnlyActor = actorName === 'ဇွဲဇွဲ' || actorName === 'ဖြိုးကို';
  const isLedgerOnlyActor = actorName === 'ဆောင်းဦး';
  const isCapStockOnlyActor = actorName === 'သက်မွန်နှင်း';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveReview, setSaveReview] = useState(null);
  const pendingSubmitRef = useRef(null);

  useEffect(() => {
    const handleSubmitCapture = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.saveReviewHandled === 'true' || pendingSubmitRef.current) return;
      if (form.querySelector('input[type="password"]') || form.dataset.noSaveReview === 'true') return;
      const submitter = event.submitter;
      const fields = Array.from(form.querySelectorAll('input, textarea, [data-review-value]'))
        .filter((element) => element.type !== 'hidden' && element.type !== 'submit' && element.type !== 'button' && element.name !== 'pin')
        .map((element) => ({
          label: element.getAttribute('data-review-label') || element.getAttribute('aria-label') || element.placeholder || element.name || element.id || 'အချက်အလက်',
          value: element.getAttribute('data-review-value') || element.value,
        }))
        .filter((field) => field.value !== '');
      event.preventDefault();
      event.stopPropagation();
      pendingSubmitRef.current = { form, submitter };
      setSaveReview({ fields });
    };
    document.addEventListener('submit', handleSubmitCapture, true);
    return () => document.removeEventListener('submit', handleSubmitCapture, true);
  }, []);

  const cancelSaveReview = () => {
    pendingSubmitRef.current = null;
    setSaveReview(null);
  };
  const confirmSaveReview = () => {
    const pending = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    setSaveReview(null);
    if (!pending?.form) return;
    pending.form.dataset.saveReviewHandled = 'true';
    window.setTimeout(() => {
      pending.form.requestSubmit(pending.submitter || undefined);
      delete pending.form.dataset.saveReviewHandled;
    }, 0);
  };

  useEffect(() => {
    setAppZoom(readAppZoom());
  }, []);

  useEffect(() => {
    const handleActorSelected = (event) => {
      const nextActorName = String(event.detail?.actorName || '').trim();
      if (!nextActorName) return;
      setActorName(nextActorName);
      setAuthenticated(true);
    };
    window.addEventListener('new-life-ledger:actor-selected', handleActorSelected);
    return () => window.removeEventListener('new-life-ledger:actor-selected', handleActorSelected);
  }, []);

  useEffect(() => {
    if (isProductionOnlyActor && pathname !== '/production') {
      router.replace('/production');
      return;
    }
    if (isLedgerOnlyActor && pathname !== '/' && pathname !== '/ledger' && pathname !== '/balance-detail') {
      router.replace('/');
      return;
    }
    if (isCapStockOnlyActor && pathname !== '/cap-stock') {
      router.replace('/cap-stock');
    }
  }, [actorName, isCapStockOnlyActor, isLedgerOnlyActor, isProductionOnlyActor, pathname, router]);

  const handleLoginSuccess = (nextActorName) => {
    setActorName(nextActorName || '');
    setAuthenticated(true);
  };

  const handleLogout = () => {
    setActorName('');
    setAuthenticated(false);
  };

  const canRenderCurrentPage = authenticated && (
    (!isProductionOnlyActor && !isLedgerOnlyActor && !isCapStockOnlyActor)
    || (isProductionOnlyActor && pathname === '/production')
    || (isLedgerOnlyActor && (pathname === '/' || pathname === '/ledger' || pathname === '/balance-detail'))
    || (isCapStockOnlyActor && pathname === '/cap-stock')
  );

  return (
    <>
      <BlossomOverlay />
      <PINLogin onSuccess={handleLoginSuccess} onLogout={handleLogout} />
      {canRenderCurrentPage && (
        <ActorSwitcher actorName={actorName} />
      )}
      {canRenderCurrentPage && (
        <>
          {/* Mount the global player before page children so it cannot miss the
              first overdue-status/audio event during the PWA startup handshake. */}
          <BackgroundMusicPlayer settingsOpen={settingsOpen} />
          <RefreshOverlay />
          <GlobalActionLoadingIndicator />
          <SettingsToggle open={settingsOpen} onToggle={() => setSettingsOpen((current) => !current)} />
          <AppZoomControls appZoom={appZoom} onChange={setAppZoom} settingsOpen={settingsOpen} />
          <div className="neon-app-shell-viewport">
            <div
              className="neon-app-shell"
              data-app-zoom={appZoom}
              style={{ zoom: appZoom, '--app-zoom': appZoom, width: `${100 / appZoom}%`, marginInline: 'auto' }}
            >
              <SharedPageHeader pathname={pathname} actorName={actorName} />
              {children}
            </div>
          </div>
        </>
      )}
      <SaveReviewModal review={saveReview} onCancel={cancelSaveReview} onConfirm={confirmSaveReview} />
    </>
  );
}
