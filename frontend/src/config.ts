type RuntimeKey =
  | 'VITE_GOOGLE_MAPS_API_KEY'
  | 'VITE_APP_NAME'
  | 'VITE_DEFAULT_CENTER_LAT'
  | 'VITE_DEFAULT_CENTER_LNG'

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<Record<RuntimeKey, string>>
  }
}

export function env(key: RuntimeKey): string {
  return window.__APP_CONFIG__?.[key] || import.meta.env[key] || ''
}

export const APP_NAME = env('VITE_APP_NAME') || 'Nosso Mapa'

export const DEFAULT_CENTER = {
  lat: Number(env('VITE_DEFAULT_CENTER_LAT')) || -19.9186,
  lng: Number(env('VITE_DEFAULT_CENTER_LNG')) || -43.9388,
}
