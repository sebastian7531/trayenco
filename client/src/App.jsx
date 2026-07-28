import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PWAStatusProvider } from './context/PWAStatusContext'
import PrivateRoute from './components/layout/PrivateRoute'
import AdminLayout from './components/layout/AdminLayout'
import OfflineBanner from './components/pwa/OfflineBanner'
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt'

import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import Clientes from './pages/admin/Clientes'
import Pedidos from './pages/admin/Pedidos'
import Rutas from './pages/admin/Rutas'
import HistorialRutas from './pages/admin/HistorialRutas'
import Stock from './pages/admin/Stock'
import Asistencia from './pages/admin/Asistencia'
import Reportes from './pages/admin/Reportes'
import Registros from './pages/admin/Registros'
import Usuarios from './pages/admin/Usuarios'
import Zonas from './pages/admin/Zonas'
import RepartidorDashboard from './pages/repartidor/Dashboard'

function App() {
  return (
    <PWAStatusProvider>
      <AuthProvider>
        <OfflineBanner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<PrivateRoute rolRequerido="administrador" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="zonas" element={<Zonas />} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="rutas" element={<Rutas />} />
                <Route path="historial-rutas" element={<HistorialRutas />} />
                <Route path="stock" element={<Stock />} />
                <Route path="asistencia" element={<Asistencia />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="reportes"   element={<Reportes />} />
                <Route path="registros"  element={<Registros />} />
              </Route>
            </Route>

            <Route element={<PrivateRoute rolRequerido="repartidor" />}>
              <Route path="/repartidor" element={<RepartidorDashboard />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <PWAUpdatePrompt />
      </AuthProvider>
    </PWAStatusProvider>
  )
}

export default App
