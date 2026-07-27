/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

const PWAStatusContext = createContext({ isOnline: true })

export const PWAStatusProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <PWAStatusContext.Provider value={{ isOnline }}>
      {children}
    </PWAStatusContext.Provider>
  )
}

export const usePWAStatus = () => useContext(PWAStatusContext)
