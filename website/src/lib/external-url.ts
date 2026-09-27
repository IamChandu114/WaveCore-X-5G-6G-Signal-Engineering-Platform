/** Returns the URL only when it is a usable http(s) destination, otherwise undefined. */
export function safeExternalUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A short, human-readable label for an external destination, e.g. "medium.com/@author". */
export function externalSourceLabel(value: string | undefined) {
  const url = safeExternalUrl(value);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean).slice(0, 1);
    return segments.length ? `${parsed.host}/${segments.join("/")}` : parsed.host;
  } catch {
    return undefined;
  }
}
