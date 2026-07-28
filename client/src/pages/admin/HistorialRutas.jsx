import { useEffect, useState } from 'react'
import api from '../../services/api'

const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  return new Date(`${fecha}T00:00:00Z`).toLocaleDateString('es-CL', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const formatearDuracion = (segundos) => {
  if (segundos === null || segundos === undefined) return '—'

  const totalMinutos = Math.floor(Number(segundos) / 60)
  if (!Number.isFinite(totalMinutos) || totalMinutos < 0) return '—'

  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
  return `${horas} h ${minutos} min`
}

const nombresRepartidores = (repartidores) => {
  if (!Array.isArray(repartidores) || repartidores.length === 0) return '—'
  return repartidores.map((repartidor) => repartidor.nombre).join(', ')
}

const ESTADO_ESTILO = {
  activa: 'bg-blue-100 text-blue-700',
  cerrada: 'bg-green-100 text-green-700',
}

const HistorialRutas = () => {
  const [rutas, setRutas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    const cargarHistorial = async () => {
      try {
        const { data } = await api.get('/rutas/historial')
        if (activo) {
          setRutas(data.data)
          setError('')
        }
      } catch (err) {
        if (activo) {
          setError(err.response?.data?.message || 'No se pudo cargar el historial de rutas.')
        }
      } finally {
        if (activo) setLoading(false)
      }
    }

    cargarHistorial()
    return () => { activo = false }
  }, [])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Historial de rutas</h1>
        <p className="text-sm text-gray-500 mt-1">Registro de activación y cierre de rutas.</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-12">Cargando historial...</p>
        ) : rutas.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">No hay rutas registradas.</p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Hora de inicio</th>
                <th className="px-4 py-3 font-medium">Hora de término</th>
                <th className="px-4 py-3 font-medium">Duración</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Repartidores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rutas.map((ruta) => (
                <tr key={ruta.cod_ruta} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">#{ruta.cod_ruta}</td>
                  <td className="px-4 py-3 text-gray-700">{formatearFecha(ruta.fecha)}</td>
                  <td className="px-4 py-3 text-gray-700">{ruta.hora_inicio || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{ruta.hora_termino || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{formatearDuracion(ruta.duracion_segundos)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        ESTADO_ESTILO[ruta.estado] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {ruta.estado === 'activa' ? 'Activa' : ruta.estado === 'cerrada' ? 'Cerrada' : ruta.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{nombresRepartidores(ruta.repartidores)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default HistorialRutas
