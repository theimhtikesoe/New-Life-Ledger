import { useCallback, useEffect, useRef, useState } from "react";

const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "ဇွဲဇွဲ", "Staff"];
const ACTOR_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"];
const AUTH_REQUEST_TIMEOUT_MS = 12000;
const AUTHORIZED_ACTORS_KEY = "new-life-ledger:authorized-actors-v1";

function readAuthorizedActors() {
  try {
    const raw = sessionStorage.getItem(AUTHORIZED_ACTORS_KEY);
    const actors = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(actors) ? actors.filter((actor) => typeof actor === "string") : []);
  } catch {
    return new Set();
  }
}

function rememberAuthorizedActor(actorName) {
  try {
    const actors = readAuthorizedActors();
    actors.add(actorName);
    sessionStorage.setItem(AUTHORIZED_ACTORS_KEY, JSON.stringify([...actors]));
  } catch {
    // If sessionStorage is unavailable, the current login still works.
  }
}

async function fetchAuthJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      ...options,
      credentials: "include",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === "AbortError") {
      error.name = "TimeoutError";
      error.message = "Request timed out";
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default function PINLogin({ onSuccess, onLogout }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectingActor, setSelectingActor] = useState(false);
  const [pendingActor, setPendingActor] = useState("");
  const [authorizedActors, setAuthorizedActors] = useState(() => readAuthorizedActors());
  const [actorLocked, setActorLocked] = useState(false);
  const lastActivityAtRef = useRef(Date.now());

  const lockActorSelection = useCallback(() => {
    // Keep the server session alive; only clear the local actor attribution.
    // After five idle minutes, the next action must choose the active user again
    // without forcing the owner to enter the PIN a second time.
    localStorage.removeItem("actorName");
    setActorLocked(true);
    setSelectingActor(true);
    setIsAuthenticated(true);
    setError("");
  }, []);

  useEffect(() => {
    let active = true;
    fetchAuthJson("/api/auth/session", { cache: "no-store" })
      .then((body) => {
        if (!active) return;
        const actorName = body.actorName || localStorage.getItem("actorName");
        if (body.authenticated && ACTORS.includes(actorName)) {
          setIsAuthenticated(true);
          setActorLocked(false);
          setAuthorizedActors(readAuthorizedActors());
          lastActivityAtRef.current = Date.now();
          onSuccess?.(actorName);
        } else {
          setIsAuthenticated(false);
          setActorLocked(false);
          setSelectingActor(true);
          localStorage.removeItem("actorName");
        }
      })
      .catch(() => {
        if (active) {
          setIsAuthenticated(false);
          setActorLocked(false);
          setSelectingActor(true);
          localStorage.removeItem("actorName");
        }
      })
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, [onSuccess]);

  useEffect(() => {
    const openActorSelector = () => {
      if (!isAuthenticated) return;
      setActorLocked(true);
      setSelectingActor(true);
      setPendingActor("");
      setPin("");
      setError("");
    };
    window.addEventListener("new-life-ledger:open-actor-selector", openActorSelector);
    return () => window.removeEventListener("new-life-ledger:open-actor-selector", openActorSelector);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || actorLocked) return undefined;

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
    };

    let timerId;
    const checkIdle = () => {
      const elapsed = Date.now() - lastActivityAtRef.current;
      if (elapsed >= ACTOR_IDLE_TIMEOUT_MS) {
        lockActorSelection();
        return;
      }
      timerId = window.setTimeout(checkIdle, Math.min(ACTOR_IDLE_TIMEOUT_MS - elapsed, 1000));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkIdle();
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    checkIdle();

    return () => {
      if (timerId) window.clearTimeout(timerId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [actorLocked, isAuthenticated, lockActorSelection]);

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(value);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pin.length !== 6) return;
    setError("");
    try {
      const body = await fetchAuthJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!body.ok) throw new Error(body.error || "PIN ဖြင့် ဝင်ရောက်၍ မရပါ။");
      setPin("");
      if (pendingActor) {
        rememberAuthorizedActor(pendingActor);
        setAuthorizedActors(readAuthorizedActors());
        localStorage.setItem("actorName", pendingActor);
        lastActivityAtRef.current = Date.now();
        setSelectingActor(false);
        setActorLocked(false);
        setIsAuthenticated(true);
        window.dispatchEvent(new CustomEvent("new-life-ledger:actor-selected", { detail: { actorName: pendingActor } }));
        onSuccess?.(pendingActor);
      } else {
        setSelectingActor(true);
      }
    } catch (loginError) {
      setError(loginError.name === "TimeoutError"
        ? "Server connection အချိန်ကျော်သွားပါပြီ။ ခဏနားပြီး ထပ်စမ်းပါ။"
        : loginError.message || "PIN ဖြင့် ဝင်ရောက်၍ မရပါ။");
      setPin("");
    }
  };

  const completeActorSelection = (actorName) => {
    localStorage.setItem("actorName", actorName);
    lastActivityAtRef.current = Date.now();
    setSelectingActor(false);
    setActorLocked(false);
    setIsAuthenticated(true);
    window.dispatchEvent(new CustomEvent("new-life-ledger:actor-selected", { detail: { actorName } }));
    onSuccess?.(actorName);
  };

  const handleActorSelect = async (actorName) => {
    setError("");
    setPendingActor(actorName);
    if (actorName === "ဇွဲဇွဲ") {
      try {
        await fetchAuthJson("/api/auth/actor-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorName }),
        });
      } catch (selectionError) {
        setError(selectionError.message || "ဇွဲဇွဲ အသုံးပြုသူအဖြစ် ဝင်ရောက်၍ မရပါ။");
        return;
      }
    }
    if (actorName !== "ဇွဲဇွဲ" && !authorizedActors.has(actorName)) {
      setSelectingActor(false);
      setActorLocked(false);
      setIsAuthenticated(false);
      setPin("");
      return;
    }
    if (actorName !== "ဇွဲဇွဲ") {
      completeActorSelection(actorName);
      return;
    }
    completeActorSelection(actorName);
  };

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("actorName");
    setIsAuthenticated(false);
    setSelectingActor(true);
    setPendingActor("");
    setActorLocked(false);
    setPin("");
    setError("");
    onLogout?.();
  };

  if (isLoading || (isAuthenticated && !actorLocked)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">New Life Ledger</h1>
          <p className="text-gray-600">
            {actorLocked
              ? "၅ မိနစ်အသုံးမပြုထားပါ။ အသုံးပြုသူကို ပြန်ရွေးပါ"
              : selectingActor
                ? "ဘယ်သူအသုံးပြုနေပါသလဲ ရွေးပါ"
                : "PIN code ထည့်သွင်းပါ"}
          </p>
        </div>

        {selectingActor ? (
          <div className="grid grid-cols-2 gap-3">
            {ACTORS.map((actor) => (
              <button
                key={actor}
                type="button"
                onClick={() => handleActorSelect(actor)}
                className="min-h-14 rounded-lg border-2 border-cyan-200 bg-cyan-50 px-4 py-3 font-semibold text-cyan-800 transition hover:border-cyan-500 hover:bg-cyan-100"
              >
                {actor}
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin" className="mb-2 block text-sm font-medium text-gray-700">
                6-Digit PIN Code
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={handlePinChange}
                placeholder="• • • • • •"
                maxLength="6"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-center text-2xl tracking-widest transition-colors focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
            </div>
            <button
              type="submit"
              disabled={pin.length !== 6}
              className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-400"
            >
              ဝင်ရောက်ပါ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
