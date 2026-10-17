export function connectionStatus({ online, offlineReady, offlineError }) {
  if (!online) {
    return offlineReady ? 'Offline · spielbereit' : 'Offline · Reload nicht abgesichert';
  }
  if (offlineReady) return 'Online · offline bereit';
  if (offlineError) return 'Online · Offline-Modus nicht verfügbar';
  return 'Online · Offline wird vorbereitet';
}
