export function encodeActorHeader(actorName) {
  return actorName ? encodeURIComponent(actorName) : "";
}

export function decodeActorHeader(value) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
