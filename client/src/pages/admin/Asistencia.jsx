import { useEffect, useState } from 'react'
import api from '../../services/api'
import { formatearHoras } from '../../utils/asistencia'

const fmtHora = (hora) => hora ? hora.slice(0, 5) : '—'

const fmtFecha = (fechaStr) =>
  new Date(`${fechaStr}T00:00:00Z`).toLocaleDateString('es-CL', {
    timeZone: 'UTC',
  })

const obtenerResumenIntervalos = (registro) => {
  const intervalos = registro.intervalos || []
  const primerIngreso = intervalos[0]?.hora_entrada || null
  const salidas = intervalos.filter((intervalo) => intervalo.hora_salida)
  const ultimaSalida = salidas.at(-1)?.hora_salida || null

  return { intervalos, primerIngreso, ultimaSalida }
}

const estadoFila = (registro) => {
  const intervalos = registro.intervalos || []

  if (registro.intervalo_abierto || registro.tiene_intervalo_abierto) {
    return {
      label: 'En turno',
      clase: 'bg-yellow-100 text-yellow-700',
    }
  }

  if (intervalos.length > 0) {
    return {
      label: 'Completado',
      clase: 'bg-green-100 text-green-700',
    }
  }

  return {
    label: 'Ausente',
    clase: 'bg-gray-100 text-gray-500',
  }
}

const DetalleIntervalos = ({ registro }) => {
  const intervalos = registro.intervalos || []

  return (
    <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
      {registro.intervalo_abierto
        && !intervalos.some(
          (intervalo) => intervalo.id_registro === registro.intervalo_abierto.id_registro
        ) && (
          <p className="text-xs text-amber-700 mb-3">
            Mantiene un intervalo abierto desde el {fmtFecha(registro.intervalo_abierto.fecha)}
            {' a las '}
            {fmtHora(registro.intervalo_abierto.hora_entrada)}.
          </p>
        )}

      {intervalos.length === 0 ? (
        <p className="text-sm text-gray-400">Sin intervalos para esta jornada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-2 pr-4 font-medium">#</th>
                <th className="text-left py-2 pr-4 font-medium">Entrada</th>
                <th className="text-left py-2 pr-4 font-medium">Salida</th>
                <th className="text-left py-2 font-medium">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {intervalos.map((intervalo, index) => (
                <tr key={intervalo.id_registro}>
                  <td className="py-2 pr-4 text-gray-500">{index + 1}</td>
                  <td className="py-2 pr-4 text-gray-700">{fmtHora(intervalo.hora_entrada)}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {intervalo.hora_salida ? fmtHora(intervalo.hora_salida) : 'En curso'}
                  </td>
                  <td className="py-2 text-gray-700">
                    {intervalo.horas_trabajadas != null
                      ? formatearHoras(intervalo.horas_trabajadas)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const Asistencia = () => {
  const [hoy, setHoy] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalleAbierto, setDetalleAbierto] = useState(null)

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError('')

      const [resHoy, resHistorial] = await Promise.all([
        api.get('/asistencia/hoy'),
        api.get('/asistencia'),
      ])

      setHoy(resHoy.data.data)
      setHistorial(resHistorial.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la asistencia.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const alternarDetalle = (key) => {
    setDetalleAbierto((actual) => actual === key ? null : key)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Asistencia</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('es-CL', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="px-4 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Asistencia de hoy</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            Cargando...
          </div>
        ) : hoy.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            No hay cuentas con rol repartidor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Primer ingreso</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Última salida</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Intervalos</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Total diario</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hoy.map((registro) => {
                  const key = `hoy-${registro.id_repartidor}`
                  const estado = estadoFila(registro)
                  const {
                    intervalos,
                    primerIngreso,
                    ultimaSalida,
                  } = obtenerResumenIntervalos(registro)

                  return (
                    <tr key={key}>
                      <td colSpan={7} className="p-0">
                        <div className="grid grid-cols-[minmax(150px,1fr)_repeat(5,minmax(110px,0.7fr))_90px] items-center hover:bg-gray-50 transition">
                          <div className="px-4 py-3 font-medium text-gray-800">{registro.nombre}</div>
                          <div className="px-4 py-3 text-gray-700">{fmtHora(primerIngreso)}</div>
                          <div className="px-4 py-3 text-gray-700">{fmtHora(ultimaSalida)}</div>
                          <div className="px-4 py-3 text-gray-700">{intervalos.length}</div>
                          <div className="px-4 py-3 text-gray-700">
                            {formatearHoras(registro.total_horas)}
                          </div>
                          <div className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.clase}`}>
                              {estado.label}
                            </span>
                          </div>
                          <div className="px-4 py-3 text-right">
                            <button
                              onClick={() => alternarDetalle(key)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                              {detalleAbierto === key ? 'Ocultar' : 'Ver'}
                            </button>
                          </div>
                        </div>
                        {detalleAbierto === key && (
                          <DetalleIntervalos registro={registro} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Primer ingreso</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Última salida</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Intervalos</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historial.map((registro) => {
                    const key = `historial-${registro.id_asistencia}-${registro.id_repartidor}`
                    const estado = estadoFila(registro)
                    const {
                      intervalos,
                      primerIngreso,
                      ultimaSalida,
                    } = obtenerResumenIntervalos(registro)

                    return (
                      <tr key={key}>
                        <td colSpan={8} className="p-0">
                          <div className="grid grid-cols-[minmax(150px,1fr)_repeat(6,minmax(105px,0.65fr))_90px] items-center hover:bg-gray-50 transition">
                            <div className="px-4 py-3 font-medium text-gray-800">
                              {registro.repartidor_nombre}
                            </div>
                            <div className="px-4 py-3 text-gray-600">{fmtFecha(registro.fecha)}</div>
                            <div className="px-4 py-3 text-gray-700">{fmtHora(primerIngreso)}</div>
                            <div className="px-4 py-3 text-gray-700">{fmtHora(ultimaSalida)}</div>
                            <div className="px-4 py-3 text-gray-700">{intervalos.length}</div>
                            <div className="px-4 py-3 text-gray-700">
                              {formatearHoras(registro.total_horas)}
                            </div>
                            <div className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estado.clase}`}>
                                {estado.label}
                              </span>
                            </div>
                            <div className="px-4 py-3 text-right">
                              <button
                                onClick={() => alternarDetalle(key)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                              >
                                {detalleAbierto === key ? 'Ocultar' : 'Ver'}
                              </button>
                            </div>
                          </div>
                          {detalleAbierto === key && (
                            <DetalleIntervalos registro={registro} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Asistencia
