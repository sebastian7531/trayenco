import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_INTERVAL_MS = 60 * 60 * 1000

const PWAUpdatePrompt = () => {
  const registrationRef = useRef(null)
  const [updating, setUpdating] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration
    },
    onRegisterError: () => {
      setRegistrationError('No se pudo activar el modo instalable.')
    },
  })

  useEffect(() => {
    const checkForUpdates = () => {
      registrationRef.current?.update().catch(() => {})
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdates()
    }
    const intervalId = window.setInterval(checkForUpdates, UPDATE_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const installUpdate = async () => {
    setUpdating(true)
    setRegistrationError('')

    try {
      await updateServiceWorker(true)
    } catch {
      setRegistrationError('No se pudo instalar la actualización.')
      setUpdating(false)
    }
  }

  const dismiss = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
    setRegistrationError('')
  }

  if (!offlineReady && !needRefresh && !registrationError) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="pwa-safe-area-bottom fixed inset-x-3 bottom-0 z-[110] mx-auto max-w-md rounded-t-xl border border-gray-200 bg-white px-4 pt-4 shadow-2xl"
    >
      <p className="text-sm font-semibold text-gray-800">
        {needRefresh
          ? 'Nueva versión disponible'
          : offlineReady
            ? 'Trayenco está listo para abrirse sin conexión.'
            : registrationError}
      </p>
      {(needRefresh || offlineReady) && (
        <p className="mt-1 text-xs text-gray-500">
          Las acciones operativas siguen requiriendo internet.
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          disabled={updating}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 disabled:opacity-50"
        >
          Más tarde
        </button>
        {needRefresh && (
          <button
            type="button"
            onClick={installUpdate}
            disabled={updating}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {updating ? 'Actualizando...' : 'Actualizar aplicación'}
          </button>
        )}
      </div>
    </div>
  )
}

export default PWAUpdatePrompt
