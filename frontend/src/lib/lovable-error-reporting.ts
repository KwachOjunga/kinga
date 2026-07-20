export function reportLovableError(error: Error, context?: Record<string, string>): void {
  const payload = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "server",
    ...context,
  };
  console.error("[Kinga Error]", payload);

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(
        "/api/error",
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
    } catch {
      /* best-effort — never block the UI */
    }
  }
}
