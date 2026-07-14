import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { desconectarSocket } from '../../services/socket'
import logo from '../../assets/logo_trayenco.jpg'

const RepartidorLayout = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    desconectarSocket()
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-blue-800 text-white px-6 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-lg px-2 py-1">
            <img
              src={logo}
              alt="Trayentome"
              style={{ height: '34px', width: 'auto', display: 'block' }}
            />
          </div>
          <p className="text-blue-200 text-sm">{user?.nombre}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm bg-blue-700 hover:bg-blue-600 px-4 py-1.5 rounded-lg transition"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default RepartidorLayout
