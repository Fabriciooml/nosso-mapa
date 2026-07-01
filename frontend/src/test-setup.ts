import '@testing-library/jest-dom/vitest'

// Node 26 exposes a native (but undefined) localStorage global that shadows
// jsdom's implementation. Use the jsdom instance directly to get the real
// Storage objects and wire them onto globalThis.
const jsdomInstance = (globalThis as any).jsdom
if (jsdomInstance?.window) {
  const realLocalStorage = jsdomInstance.window.localStorage
  const realSessionStorage = jsdomInstance.window.sessionStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: realLocalStorage,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: realSessionStorage,
    writable: true,
    configurable: true,
  })
}
