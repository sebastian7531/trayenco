import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const rutaPorRol = (rol) => rol === 'administrador' ? '/admin' : '/repartidor'

const PrivateRoute = ({ rolRequerido }) => {
  const { user, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Cargando...</div>

  if (!user) return <Navigate to="/login" replace />

  if (rolRequerido && user.rol !== rolRequerido) {
    return <Navigate to={rutaPorRol(user.rol)} replace />
  }

  return <Outlet />
}

export default PrivateRoute
