import { useState, useEffect, useCallback } from 'react'

const DARK_MODE_KEY = 'fc26-dark-mode'

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const stored = localStorage.getItem(DARK_MODE_KEY)
    if (stored !== null) {
      return stored === 'true'
    }
  } catch (e) {
    console.warn('Failed to read from localStorage:', e)
  }
  
  if (window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  
  return false
}

function applyDarkMode(isDark: boolean) {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  const body = document.body
  
  // Force remove first to ensure clean state
  root.classList.remove('dark')
  body.classList.remove('dark')
  
  if (isDark) {
    root.classList.add('dark')
    body.classList.add('dark')
  }
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const initial = getInitialDarkMode()
    // Apply immediately on initialization (synchronous)
    if (typeof document !== 'undefined') {
      applyDarkMode(initial)
    }
    return initial
  })

  // Apply dark mode whenever isDark changes
  useEffect(() => {
    applyDarkMode(isDark)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DARK_MODE_KEY, String(isDark))
      }
    } catch (e) {
      console.warn('Failed to save to localStorage:', e)
    }
  }, [isDark])

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const newValue = !prev
      // Immediately update DOM synchronously
      applyDarkMode(newValue)
      // Save immediately
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(DARK_MODE_KEY, String(newValue))
        }
      } catch (e) {
        console.warn('Failed to save to localStorage:', e)
      }
      return newValue
    })
  }, [])

  return { isDark, toggle, setIsDark }
}
