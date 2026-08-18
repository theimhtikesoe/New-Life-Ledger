import { useState, useEffect } from "react";

const CORRECT_PIN = "126365";
const ACTORS = ["ဖေဖေ", "ပုံ့ပုံ့", "ဆောင်းဦး", "Staff"];

export default function PINLogin({ onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectingActor, setSelectingActor] = useState(false);

  useEffect(() => {
    const authenticated = localStorage.getItem("pinAuthenticated");
    const actorName = localStorage.getItem("actorName");
    if (authenticated === "true" && ACTORS.includes(actorName)) {
      setIsAuthenticated(true);
      onSuccess?.(actorName);
    } else {
      setIsAuthenticated(false);
      localStorage.removeItem("pinAuthenticated");
      localStorage.removeItem("actorName");
    }
    setIsLoading(false);
  }, [onSuccess]);

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(value);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin !== CORRECT_PIN) {
      setError("PIN code မှားနေပါသည်။ ထပ်မံ ကြိုးစားကြည့်ပါ။");
      setPin("");
      return;
    }
    setPin("");
    setError("");
    setSelectingActor(true);
  };

  const handleActorSelect = (actorName) => {
    localStorage.setItem("pinAuthenticated", "true");
    localStorage.setItem("actorName", actorName);
    setSelectingActor(false);
    setIsAuthenticated(true);
    onSuccess?.(actorName);
  };

  const handleLogout = () => {
    localStorage.removeItem("pinAuthenticated");
    localStorage.removeItem("actorName");
    setIsAuthenticated(false);
    setSelectingActor(false);
    setPin("");
    setError("");
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">New Life Ledger</h1>
          <p className="text-gray-600">{selectingActor ? "ဘယ်သူအသုံးပြုနေပါသလဲ ရွေးပါ" : "PIN code ထည့်သွင်းပါ"}</p>
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
