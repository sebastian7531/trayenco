import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../services/api'
import socket, { conectarSocket, desconectarSocket } from '../../services/socket'
import { useAuth } from '../../context/AuthContext'
import { usePWAStatus } from '../../context/PWAStatusContext'
import { formatearHoras } from '../../utils/asistencia'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

const PLANTA = [-36.6108, -72.9539]

const ESTADO_BADGE = {
  pendiente:        'bg-gray-100 text-gray-700',
  en_ruta:          'bg-blue-100 text-blue-700',
  entregado:        'bg-green-100 text-green-700',
  problema_entrega: 'bg-red-100 text-red-700',
}

const ESTADO_LABEL = {
  pendiente:        'Pendiente',
  en_ruta:          'En ruta',
  entregado:        'Entregado',
  problema_entrega: 'Problema de entrega',
}

const ESTADOS_FINALES = ['entregado', 'problema_entrega']

const MOTIVOS = [
  'Cliente ausente',
  'Dirección incorrecta',
  'Cliente rechazó el pedido',
  'Otro',
]

const createNumberedIcon = (num) =>
  L.divIcon({
    html: `<div style="background:#2563eb;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${num}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })

const plantaIcon = L.divIcon({
  html: `<div style="background:#dc2626;color:white;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">T</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const resumenBidones = (lineas) => {
  if (!lineas?.length) return '—'
  return lineas.map(l => `${l.cantidad}x ${l.formato?.replace(' litros', 'L') || l.descripcion}`).join(', ')
}

const agruparPedidos = (filas) => {
  const mapa = new Map()
  filas.forEach(fila => {
    if (!mapa.has(fila.id_pedido)) {
      mapa.set(fila.id_pedido, { ...fila, lineas: [] })
    }
    if (fila.cod_bidon) {
      mapa.get(fila.id_pedido).lineas.push({
        cod_bidon:   fila.cod_bidon,
        descripcion: fila.bidon_descripcion,
        formato:     fila.formato,
        cantidad:    fila.cantidad,
      })
    }
  })
  return Array.from(mapa.values()).sort((a, b) => (a.orden_entrega ?? 99) - (b.orden_entrega ?? 99))
}

const Dashboard = () => {
  const { user, logout } = useAuth()
  const { isOnline } = usePWAStatus()
  const navigate = useNavigate()
  const [ruta, setRuta]         = useState(null)
  const [pedidos, setPedidos]   = useState([])
  const [errorRuta, setErrorRuta] = useState('')
  const [asistencia, setAsistencia] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [mensaje, setMensaje]   = useState('')
  const [accionando, setAccionando] = useState(null)
  const [marcandoAsistencia, setMarcandoAsistencia] = useState(false)
  const [errorAsistencia, setErrorAsistencia] = useState('')
  const [cargandoAsistencia, setCargandoAsistencia] = useState(true)
  const [asistenciaConocida, setAsistenciaConocida] = useState(false)
  const [confirmandoCierre, setConfirmandoCierre] = useState(false)
  const [cerrandoReparto, setCerrandoReparto] = useState(false)

  const [modalEntrega, setModalEntrega]             = useState(null)
  const [motivoEntrega, setMotivoEntrega]           = useState('')
  const [observacionEntrega, setObservacionEntrega] = useState('')
  const [errorEntrega, setErrorEntrega]             = useState('')

  const ejecutarCierreReparto = async () => {
    if (!isOnline) {
      mostrarMensaje('Necesitas conexión para cerrar el reparto.')
      return
    }

    setCerrandoReparto(true)
    try {
      await api.patch(`/rutas/${ruta.cod_ruta}/cerrar`)
      await cargarRuta()
    } catch (err) {
      mostrarMensaje(err.response?.data?.message || 'Error al cerrar el reparto.')
      setConfirmandoCierre(false)
    } finally {
      setCerrandoReparto(false)
    }
  }

  const marcarEntrada = async () => {
    if (!isOnline) {
      setErrorAsistencia('Necesitas conexión para registrar asistencia.')
      return
    }

    setMarcandoAsistencia(true)
    setErrorAsistencia('')
    try {
      await api.post('/asistencia/entrada')
      try {
        await cargarAsistencia()
      } catch {
        setErrorAsistencia('La entrada fue registrada, pero no se pudo actualizar la vista.')
      }
    } catch (err) {
      setErrorAsistencia(err.response?.data?.message || 'Error al marcar entrada.')
    } finally {
      setMarcandoAsistencia(false)
    }
  }

  const marcarSalida = async () => {
    if (!isOnline) {
      setErrorAsistencia('Necesitas conexión para registrar asistencia.')
      return
    }

    setMarcandoAsistencia(true)
    setErrorAsistencia('')
    try {
      await api.post('/asistencia/salida')
      try {
        await cargarAsistencia()
      } catch {
        setErrorAsistencia('La salida fue registrada, pero no se pudo actualizar la vista.')
      }
    } catch (err) {
      setErrorAsistencia(err.response?.data?.message || 'Error al marcar salida.')
    } finally {
      setMarcandoAsistencia(false)
    }
  }

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 3000)
  }

  const cargarRuta = useCallback(async () => {
    try {
      const { data } = await api.get('/rutas/mi-ruta-hoy')
      const rutaData = data.data
      setRuta(rutaData)
      setPedidos(rutaData ? agruparPedidos(rutaData.pedidos || []) : [])
      setErrorRuta('')
      setConfirmandoCierre(false)
    } catch (err) {
      setRuta(null)
      setPedidos([])
      setErrorRuta(
        err.response?.data?.message
          || (err.response
            ? 'No se pudo consultar el reparto.'
            : 'No se pudo consultar el reparto por un problema de conexión.'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarAsistencia = useCallback(async () => {
    setCargandoAsistencia(true)
    setAsistenciaConocida(false)
    try {
      const { data } = await api.get('/asistencia/hoy')
      const miRegistro = data.data.find(r => r.id_repartidor === user?.id)
      setAsistencia(miRegistro || null)
      setAsistenciaConocida(true)
      setErrorAsistencia('')
    } catch (err) {
      setErrorAsistencia(err.response?.data?.message || 'No se pudo cargar la asistencia.')
      throw err
    } finally {
      setCargandoAsistencia(false)
    }
  }, [user?.id])

  useEffect(() => {
    cargarRuta()
    cargarAsistencia().catch(() => {})
    conectarSocket('repartidor')

    socket.on('ruta_actualizada', cargarRuta)
    socket.on('pedido_creado', cargarRuta)
    socket.on('pedido_actualizado', cargarRuta)

    return () => {
      socket.off('ruta_actualizada', cargarRuta)
      socket.off('pedido_creado', cargarRuta)
      socket.off('pedido_actualizado', cargarRuta)
      desconectarSocket()
    }
  }, [cargarRuta, cargarAsistencia])

  const ejecutarCambioEstado = async (pedido, body) => {
    if (!isOnline) {
      mostrarMensaje('Necesitas conexión para actualizar el pedido.')
      return
    }

    setAccionando(pedido.id_pedido)
    try {
      await api.patch(`/pedidos/${pedido.id_pedido}/estado`, body)
      await cargarRuta()
      mostrarMensaje(`${pedido.cliente_nombre} → ${ESTADO_LABEL[body.estado]}`)
    } catch (err) {
      mostrarMensaje(err.response?.data?.message || 'Error al actualizar.')
    } finally {
      setAccionando(null)
    }
  }

  const abrirModalEntrega = (pedido, nuevoEstado) => {
    setModalEntrega({ pedido, nuevoEstado })
    setMotivoEntrega('')
    setObservacionEntrega('')
    setErrorEntrega('')
  }

  const confirmarEntrega = async () => {
    if (!isOnline) {
      setErrorEntrega('Necesitas conexión para confirmar la entrega.')
      return
    }

    const { pedido, nuevoEstado } = modalEntrega

    if (!motivoEntrega) {
      setErrorEntrega('Selecciona un motivo.')
      return
    }

    const body = { estado: nuevoEstado, motivo: motivoEntrega }
    if (observacionEntrega.trim()) body.observacion = observacionEntrega.trim()

    setModalEntrega(null)
    await ejecutarCambioEstado(pedido, body)
  }

  const totalPedidos  = pedidos.length
  const entregados    = pedidos.filter(p => p.estado === 'entregado').length
  const pendientesHoy = pedidos.filter(p => !ESTADOS_FINALES.includes(p.estado)).length

  const pedidosConCoordenadas = pedidos.filter(p => p.latitud && p.longitud)

  const polylinePositions = [
    PLANTA,
    ...pedidosConCoordenadas.map(p => [parseFloat(p.latitud), parseFloat(p.longitud)]),
    PLANTA,
  ]

  if (loading) {
    return (
      <div className="pwa-safe-area flex min-h-screen items-center justify-center text-gray-400">
        Cargando...
      </div>
    )
  }

  const handleLogout = () => {
    desconectarSocket()
    logout()
    navigate('/login')
  }

  return (
    <div className="pwa-safe-area mx-auto max-w-lg space-y-4 px-4">

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{user?.nombre}</p>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:scale-95 transition"
        >
          Cerrar sesión
        </button>
      </div>

      {mensaje && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm text-center font-medium">
          {mensaje}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 space-y-3">
        {cargandoAsistencia ? (
          <p className="text-sm text-gray-400 text-center py-2">Cargando asistencia...</p>
        ) : !asistenciaConocida ? (
          <button
            onClick={() => cargarAsistencia().catch(() => {})}
            className="w-full py-3 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-50 transition"
          >
            Reintentar carga de asistencia
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-gray-500">Total acumulado de hoy</p>
                <p className="text-lg font-bold text-green-700">
                  {formatearHoras(asistencia?.total_horas)}
                </p>
              </div>
              {asistencia?.intervalo_abierto && (
                <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full">
                  En turno
                </span>
              )}
            </div>

            {(asistencia?.intervalos || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center">Sin intervalos registrados hoy.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {(asistencia?.intervalos || []).map((intervalo, index) => (
                  <div
                    key={intervalo.id_registro}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-gray-500">Intervalo {index + 1}</span>
                    <span className="text-gray-700">
                      {intervalo.hora_entrada?.slice(0, 5)}
                      {' — '}
                      {intervalo.hora_salida?.slice(0, 5) || 'En curso'}
                    </span>
                    <span className="font-semibold text-gray-700">
                      {intervalo.horas_trabajadas != null
                        ? formatearHoras(intervalo.horas_trabajadas)
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {asistencia?.intervalo_abierto && (
              <p className="text-xs text-gray-500 text-center">
                Intervalo abierto desde {asistencia.intervalo_abierto.hora_entrada?.slice(0, 5)}
                {asistencia.intervalo_abierto.fecha !== asistencia.fecha
                  ? ` del ${asistencia.intervalo_abierto.fecha}`
                  : ''}
              </p>
            )}

            <button
              onClick={asistencia?.intervalo_abierto ? marcarSalida : marcarEntrada}
              disabled={marcandoAsistencia || cargandoAsistencia || !isOnline}
              className={`w-full py-3 text-white rounded-xl text-sm font-semibold active:scale-95 transition disabled:opacity-50 ${
                asistencia?.intervalo_abierto
                  ? 'bg-gray-700 hover:bg-gray-800'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {marcandoAsistencia
                ? 'Registrando...'
                : asistencia?.intervalo_abierto
                  ? 'Marcar salida'
                  : (asistencia?.intervalos || []).length > 0
                    ? 'Marcar nueva entrada'
                    : 'Marcar entrada'}
            </button>
          </>
        )}
        {errorAsistencia && (
          <p className="text-red-500 text-sm text-center">{errorAsistencia}</p>
        )}
      </div>

      {errorRuta ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="mb-2 text-base font-semibold text-red-700">
            {errorRuta}
          </p>
          <button
            type="button"
            onClick={cargarRuta}
            className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Reintentar
          </button>
        </div>
      ) : !ruta ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-xl font-semibold text-gray-700 mb-2">No tienes repartos activos en este momento.</p>
          <p className="text-gray-400 text-sm">El administrador te asignará una ruta cuando esté lista.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{pendientesHoy}</p>
              <p className="text-xs text-gray-500 mt-1">Pendientes</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {entregados}<span className="text-base text-gray-400">/{totalPedidos}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">Entregados</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{ruta.cantidad_bidones ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-1">Bidones</p>
            </div>
          </div>

          {pedidosConCoordenadas.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 280 }}>
              <MapContainer
                key={ruta.cod_ruta}
                center={PLANTA}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={PLANTA} icon={plantaIcon}>
                  <Popup><strong>Planta Trayenco</strong><br />Punto de salida y regreso</Popup>
                </Marker>
                {pedidosConCoordenadas.map(p => (
                  <Marker
                    key={p.id_pedido}
                    position={[parseFloat(p.latitud), parseFloat(p.longitud)]}
                    icon={createNumberedIcon(p.orden_entrega)}
                  >
                    <Popup>
                      <strong>{p.cliente_nombre}</strong><br />
                      {p.cliente_direccion}
                    </Popup>
                  </Marker>
                ))}
                <Polyline positions={polylinePositions} color="#2563eb" weight={2.5} dashArray="6 4" />
              </MapContainer>
            </div>
          )}

          <div className="space-y-3">
            {pedidos.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Sin pedidos asignados.</p>
            ) : (
              pedidos.map(p => {
                const esFinal   = ESTADOS_FINALES.includes(p.estado)
                const enProceso = accionando === p.id_pedido

                return (
                  <div
                    key={p.id_pedido}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${esFinal ? 'border-gray-100 opacity-75' : 'border-gray-200'}`}
                  >
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                        {p.orden_entrega ?? '—'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-base font-semibold text-gray-800 leading-tight">{p.cliente_nombre}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {p.prioridad === 'urgente' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                                Urgente
                              </span>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[p.estado]}`}>
                              {ESTADO_LABEL[p.estado]}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{p.cliente_direccion}</p>
                        <p className="text-sm text-gray-600 mt-1">{resumenBidones(p.lineas)}</p>
                      </div>
                    </div>

                    {p.estado === 'en_ruta' && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => ejecutarCambioEstado(p, { estado: 'entregado' })}
                          disabled={enProceso || !isOnline}
                          className="py-3 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 active:scale-95 transition disabled:opacity-50"
                        >
                          Entregado
                        </button>
                        <button
                          onClick={() => abrirModalEntrega(p, 'problema_entrega')}
                          disabled={enProceso || !isOnline}
                          className="py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-95 transition disabled:opacity-50"
                        >
                          Problema de entrega
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <div className="pt-1">
            {!confirmandoCierre ? (
              <button
                onClick={() => setConfirmandoCierre(true)}
                disabled={!isOnline}
                className="w-full py-3 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 active:scale-95 transition disabled:opacity-50"
              >
                Cerrar reparto
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-3">
                <p className="text-sm text-red-700 font-medium text-center">
                  {pendientesHoy > 0
                    ? `Aún tienes ${pendientesHoy} pedido${pendientesHoy !== 1 ? 's' : ''} sin marcar. ¿Seguro que quieres cerrar este reparto?`
                    : '¿Cerrar este reparto?'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmandoCierre(false)}
                    disabled={cerrandoReparto}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 active:scale-95 transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={ejecutarCierreReparto}
                    disabled={cerrandoReparto || !isOnline}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 active:scale-95 transition disabled:opacity-50"
                  >
                    {cerrandoReparto ? 'Cerrando...' : 'Confirmar cierre'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {modalEntrega && (
        <div className="pwa-modal-bottom fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-5 pt-5 pb-5 space-y-4">

              <div>
                <p className="text-base font-semibold text-gray-800">
                  {modalEntrega.pedido.cliente_nombre}
                </p>
                <p className="text-sm text-gray-500">Problema de entrega</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo <span className="text-red-500">*</span>
                </label>
                <select
                  value={motivoEntrega}
                  onChange={e => { setMotivoEntrega(e.target.value); setErrorEntrega('') }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar motivo...</option>
                  {MOTIVOS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observación <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={observacionEntrega}
                  onChange={e => setObservacionEntrega(e.target.value)}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {errorEntrega && (
                <p className="text-red-500 text-sm">{errorEntrega}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalEntrega(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 active:scale-95 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEntrega}
                  disabled={!isOnline}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white active:scale-95 transition bg-red-500 hover:bg-red-600 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
