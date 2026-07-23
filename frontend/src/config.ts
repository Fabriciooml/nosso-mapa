export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nosso Mapa'

export const DEFAULT_CENTER = {
  lat: Number(import.meta.env.VITE_DEFAULT_CENTER_LAT) || -19.9186,
  lng: Number(import.meta.env.VITE_DEFAULT_CENTER_LNG) || -43.9388,
}
