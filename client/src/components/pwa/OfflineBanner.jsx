import { usePWAStatus } from '../../context/PWAStatusContext'

const OfflineBanner = () => {
  const { isOnline } = usePWAStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pwa-safe-area-top sticky inset-x-0 top-0 z-[100] bg-amber-100 px-4 pb-2 text-center text-sm font-medium text-amber-900 shadow-sm"
    >
      Sin conexión. Los datos y acciones operativas requieren internet.
    </div>
  )
}

export default OfflineBanner
