import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const fmtHora = (hora) => {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

const fmtFecha = (fechaStr) =>
  new Date(fechaStr).toLocaleDateString('es-CL', { timeZone: 'UTC' })

const estadoFila = (registro) => {
  if (registro.hora_salida) return { label: 'Completado', clase: 'bg-green-100 text-green-700' }
  if (registro.hora_entrada) return { label: 'En turno',   clase: 'bg-yellow-100 text-yellow-700' }
  return { label: 'Ausente', clase: 'bg-gray-100 text-gray-500' }
}

const Asistencia = () => {
  const { user } = useAuth()
  const [hoy, setHoy] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [accionando, setAccionando] = useState(false)

  const cargarDatos = async () => {
    try {
      setLoading(true)
      const [resHoy, resHistorial] = await Promise.all([
        api.get('/asistencia/hoy'),
        api.get('/asistencia'),
      ])
      setHoy(resHoy.data.data)
      setHistorial(resHistorial.data.data)
    } catch {
      setError('No se pudo cargar la asistencia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarDatos() }, [])

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const handleEntrada = async () => {
    setAccionando(true)
    setError('')
    try {
      await api.post('/asistencia/entrada')
      mostrarMensaje('Entrada registrada correctamente.')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar entrada.')
    } finally {
      setAccionando(false)
    }
  }

  const handleSalida = async () => {
    if (!miRegistroHoy?.hora_entrada) {
      setError('Debe registrar la entrada antes de registrar la salida.')
      return
    }
    setAccionando(true)
    setError('')
    try {
      await api.post('/asistencia/salida')
      mostrarMensaje('Salida registrada correctamente.')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar salida.')
    } finally {
      setAccionando(false)
    }
  }

  const miRegistroHoy = hoy.find((r) => r.usuario_id === user?.id)

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">Asistencia</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {mensaje && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-semibold text-gray-800">Asistencia de hoy</h2>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-3">
              <button
                onClick={handleEntrada}
                disabled={accionando || !!miRegistroHoy?.hora_entrada}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Registrar Mi Entrada
              </button>
              <button
                onClick={handleSalida}
                disabled={accionando || !miRegistroHoy?.hora_entrada || !!miRegistroHoy?.hora_salida}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Registrar Mi Salida
              </button>
            </div>
            {!miRegistroHoy?.hora_entrada && (
              <p className="text-xs text-amber-600">Debe registrar la entrada antes de registrar la salida</p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            Cargando...
          </div>
        ) : hoy.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            Ningún empleado ha registrado asistencia hoy.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hora entrada</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hora salida</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Horas trabajadas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hoy.map((r) => {
                const estado = estadoFila(r)
                const esMio = r.usuario_id === user?.id
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 transition ${esMio ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {r.nombre || r.usuario_nombre}
                      {esMio && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">tú</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtHora(r.hora_entrada)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtHora(r.hora_salida)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.horas_trabajadas != null ? `${r.horas_trabajadas} h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.clase}`}>
                        {estado.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Historial completo</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {historial.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Sin registros históricos.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Entrada</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Salida</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Horas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historial.map((r) => {
                  const estado = estadoFila(r)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.usuario_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtFecha(r.fecha)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtHora(r.hora_entrada)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtHora(r.hora_salida)}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.horas_trabajadas != null ? `${r.horas_trabajadas} h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.clase}`}>
                          {estado.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default Asistencia
