import { useState, useCallback } from 'react'

const STORAGE_KEY = 'nosso_mapa_identity'

export function useIdentity() {
  const [name, setNameState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  const setName = useCallback((newName: string) => {
    localStorage.setItem(STORAGE_KEY, newName)
    setNameState(newName)
  }, [])

  const clearName = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setNameState(null)
  }, [])

  return { name, setName, clearName }
}
