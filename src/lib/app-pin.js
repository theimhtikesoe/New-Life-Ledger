export function getConfiguredAppPin() {
  return String(process.env.APP_PIN || "").trim();
}

export function hasConfiguredAppPin() {
  return /^\d{6}$/.test(getConfiguredAppPin());
}

export function isValidAppPin(value) {
  const configuredPin = getConfiguredAppPin();
  return hasConfiguredAppPin() && String(value || "") === configuredPin;
}
