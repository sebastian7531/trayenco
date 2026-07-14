import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import logo from '../assets/logo_trayenco.jpg'

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      const { repartidor, token } = data.data
      login(repartidor, token)
      navigate(repartidor.rol === 'administrador' ? '/admin' : '/repartidor')
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      <div className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-10 py-12 md:w-1/2 md:min-h-screen">
        <div className="bg-white rounded-2xl px-6 py-4 w-full max-w-[220px]">
          <img
            src={logo}
            alt="Trayentome"
            className="w-full h-auto object-contain block"
          />
        </div>
        <p className="mt-6 text-blue-100 italic text-center text-sm">
          Purificamos tu agua, mejoramos tu vida
        </p>
      </div>

      <div className="flex flex-col items-center justify-center bg-white px-8 py-12 md:w-1/2 md:min-h-screen">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-blue-900 mb-1">Iniciar sesión</h1>
          <p className="text-gray-500 text-sm mb-8">Sistema de gestión de pedidos</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}

export default Login
