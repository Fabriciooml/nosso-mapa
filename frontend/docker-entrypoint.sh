#!/bin/sh
set -eu

escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = {
  VITE_GOOGLE_MAPS_API_KEY: "$(escape "${VITE_GOOGLE_MAPS_API_KEY:-}")",
  VITE_APP_NAME: "$(escape "${VITE_APP_NAME:-}")",
  VITE_DEFAULT_CENTER_LAT: "$(escape "${VITE_DEFAULT_CENTER_LAT:-}")",
  VITE_DEFAULT_CENTER_LNG: "$(escape "${VITE_DEFAULT_CENTER_LNG:-}")"
}
CONFIG
