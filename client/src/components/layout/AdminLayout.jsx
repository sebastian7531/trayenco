import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { desconectarSocket } from '../../services/socket'
import logo from '../../assets/logo_trayenco.jpg'

const NAV = [
  { to: '/admin',            label: 'Dashboard',   end: true },
  { to: '/admin/clientes',   label: 'Clientes' },
  { to: '/admin/zonas',      label: 'Zonas' },
  { to: '/admin/pedidos',    label: 'Pedidos' },
  { to: '/admin/rutas',      label: 'Rutas' },
  { to: '/admin/stock',      label: 'Stock' },
  { to: '/admin/asistencia', label: 'Asistencia' },
  { to: '/admin/usuarios',   label: 'Usuarios' },
  { to: '/admin/reportes',   label: 'Reportes' },
  { to: '/admin/registros',  label: 'Registros' },
]

const AdminLayout = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    desconectarSocket()
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-blue-800 flex flex-col">
        <div className="px-4 py-4 border-b border-blue-700">
          <div className="bg-white rounded-xl px-3 py-2">
            <img
              src={logo}
              alt="Trayentome"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
          <p className="text-blue-200 text-xs mt-2 text-center">Administración</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-blue-800'
                    : 'text-blue-100 hover:bg-blue-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">Bienvenido, <strong>{user?.nombre}</strong></span>
          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800 font-medium transition"
          >
            Cerrar sesión
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
