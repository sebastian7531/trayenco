import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../services/api'
import socket, { conectarSocket } from '../../services/socket'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

const TRAYENCO = [-36.6108, -72.9539]

const PEDIDO_ESTADO_BADGE = {
  pendiente:        'bg-gray-100 text-gray-600',
  en_ruta:          'bg-blue-100 text-blue-700',
  entregado:        'bg-green-100 text-green-700',
  problema_entrega: 'bg-red-100 text-red-700',
}

const PEDIDO_ESTADO_LABEL = {
  pendiente:        'Pendiente',
  en_ruta:          'En ruta',
  entregado:        'Entregado',
  problema_entrega: 'Problema de entrega',
}

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

const fmt = (fechaStr) =>
  new Date(fechaStr).toLocaleDateString('es-CL', { timeZone: 'UTC' })

const hoyISO = () => new Date().toISOString().split('T')[0]

const hoyLegible = () =>
  new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

const resumenBidones = (lineas) => {
  if (!lineas || lineas.length === 0) return '-'
  return lineas.map(l => `${l.cantidad}x ${l.formato || l.descripcion}`).join(', ')
}

const contarBidones = (lineas) => {
  if (!lineas || lineas.length === 0) return 0
  return lineas.reduce((sum, l) => sum + (l.cantidad || 0), 0)
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
  return Array.from(mapa.values())
}

const nombresZonas = (zonas) => {
  if (!zonas || zonas.length === 0) return null
  return zonas.map(z => z.nombre).join(', ')
}

const FORM_VACIO    = { id_repartidor: '', cod_zonas: [] }
const ERRORES_VACIO = { id_repartidor: '', cod_zonas: '', pedidos: '' }

const Rutas = () => {
  const [rutas, setRutas]                           = useState([])
  const [rutaDetalle, setRutaDetalle]               = useState(null)
  const [rutaSeleccionadaId, setRutaSeleccionadaId] = useState(null)
  const [repartidores, setRepartidores]             = useState([])
  const [zonas, setZonas]                           = useState([])
  const [loading, setLoading]                       = useState(true)
  const [loadingDetalle, setLoadingDetalle]         = useState(false)
  const [error, setError]                           = useState('')
  const [mensaje, setMensaje]                       = useState('')
  const [advertenciaOptimizar, setAdvertenciaOptimizar] = useState('')

  const [modalNueva, setModalNueva]           = useState(false)
  const [formRuta, setFormRuta]               = useState(FORM_VACIO)
  const [erroresRuta, setErroresRuta]         = useState(ERRORES_VACIO)
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState([])
  const [guardandoRuta, setGuardandoRuta]     = useState(false)
  const [errorCrear, setErrorCrear]           = useState('')

  const [pedidosPendientes, setPedidosPendientes] = useState([])
  const [cargandoPedidos, setCargandoPedidos]     = useState(false)

  const [optimizando, setOptimizando] = useState(false)

  const [modalAgregar, setModalAgregar]                   = useState(false)
  const [pendientesAgregar, setPendientesAgregar]         = useState([])
  const [cargandoPendientes, setCargandoPendientes]       = useState(false)
  const [seleccionadosAgregar, setSeleccionadosAgregar]   = useState([])
  const [agregando, setAgregando]                         = useState(false)
  const [errorAgregar, setErrorAgregar]                   = useState('')
  const [confirmarReoptimizar, setConfirmarReoptimizar]   = useState(false)

  const rutaSeleccionadaIdRef = useRef(null)
  useEffect(() => { rutaSeleccionadaIdRef.current = rutaSeleccionadaId }, [rutaSeleccionadaId])

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      const [resRutas, resRepartidores, resZonas] = await Promise.all([
        api.get('/rutas'),
        api.get('/usuarios'),
        api.get('/zonas'),
      ])
      setRutas(resRutas.data.data)
      setRepartidores(resRepartidores.data.data)
      setZonas(resZonas.data.data)
    } catch {
      setError('No se pudieron cargar las rutas.')
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarDetalle = useCallback(async (cod_ruta) => {
    try {
      setLoadingDetalle(true)
      const { data } = await api.get(`/rutas/${cod_ruta}`)
      setRutaDetalle(data.data)
      setAdvertenciaOptimizar('')
    } catch {
      setError('No se pudo cargar el detalle de la ruta.')
    } finally {
      setLoadingDetalle(false)
    }
  }, [])

  const manejarActualizacion = useCallback(() => {
    cargarDatos()
    if (rutaSeleccionadaIdRef.current) {
      cargarDetalle(rutaSeleccionadaIdRef.current)
    }
  }, [cargarDatos, cargarDetalle])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    conectarSocket('administrador')
    socket.on('ruta_actualizada', manejarActualizacion)
    socket.on('entrega_confirmada', manejarActualizacion)
    return () => {
      socket.off('ruta_actualizada', manejarActualizacion)
      socket.off('entrega_confirmada', manejarActualizacion)
    }
  }, [manejarActualizacion])

  const zonasKey = formRuta.cod_zonas.slice().sort().join(',')

  useEffect(() => {
    if (!modalNueva || formRuta.cod_zonas.length === 0) {
      setPedidosPendientes([])
      setPedidosSeleccionados([])
      return
    }
    let activo = true
    const cargar = async () => {
      setCargandoPedidos(true)
      try {
        const { data } = await api.get(`/pedidos/pendientes?zonas=${zonasKey}`)
        if (!activo) return
        const lista = data.data
        setPedidosPendientes(lista)
        setPedidosSeleccionados(prev => prev.filter(id => lista.some(p => p.id_pedido === id)))
      } catch {
        if (activo) setPedidosPendientes([])
      } finally {
        if (activo) setCargandoPedidos(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [zonasKey, modalNueva])

  const seleccionarRuta = (ruta) => {
    setRutaSeleccionadaId(ruta.cod_ruta)
    setError('')
    setAdvertenciaOptimizar('')
    cargarDetalle(ruta.cod_ruta)
  }

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const resetearModal = () => {
    setFormRuta(FORM_VACIO)
    setErroresRuta(ERRORES_VACIO)
    setPedidosSeleccionados([])
    setPedidosPendientes([])
    setErrorCrear('')
  }

  const abrirModal = () => {
    resetearModal()
    setModalNueva(true)
  }

  const toggleZona = (cod_zona) => {
    setFormRuta(prev => {
      const cod_zonas = prev.cod_zonas.includes(cod_zona)
        ? prev.cod_zonas.filter(z => z !== cod_zona)
        : [...prev.cod_zonas, cod_zona]
      return { ...prev, cod_zonas }
    })
    setErroresRuta(prev => ({ ...prev, cod_zonas: '' }))
  }

  const handleRepartidorChange = (e) => {
    const value = e.target.value
    setFormRuta(prev => ({ ...prev, id_repartidor: value }))
    setErroresRuta(prev => ({ ...prev, id_repartidor: value ? '' : 'El repartidor es requerido' }))
  }

  const togglePedido = (id_pedido) => {
    setPedidosSeleccionados(prev =>
      prev.includes(id_pedido) ? prev.filter(id => id !== id_pedido) : [...prev, id_pedido]
    )
    setErroresRuta(prev => ({ ...prev, pedidos: '' }))
  }

  const handleCrearRuta = async (e) => {
    e.preventDefault()
    const errores = {
      cod_zonas:     formRuta.cod_zonas.length > 0 ? '' : 'Debe seleccionar al menos una zona',
      id_repartidor: formRuta.id_repartidor ? '' : 'El repartidor es requerido',
      pedidos:       pedidosSeleccionados.length > 0 ? '' : 'Debe seleccionar al menos un pedido',
    }
    setErroresRuta(errores)
    if (Object.values(errores).some(Boolean)) return

    setGuardandoRuta(true)
    setErrorCrear('')
    try {
      const { data: dataRuta } = await api.post('/rutas', {
        fecha:            hoyISO(),
        cod_zonas:        formRuta.cod_zonas,
        id_repartidor:    Number(formRuta.id_repartidor),
        cantidad_bidones: totalBidonesSeleccionados || null,
      })
      const nuevaRuta = dataRuta.data

      await api.post(`/rutas/${nuevaRuta.cod_ruta}/pedidos`, { pedido_ids: pedidosSeleccionados })

      let aviso = ''
      try {
        const { data: dataOpt } = await api.post(`/rutas/${nuevaRuta.cod_ruta}/optimizar`)
        aviso = dataOpt.data?.aviso || ''
      } catch {
        aviso = 'La optimización de ruta no está disponible. El orden de entrega es provisional.'
      }

      setAdvertenciaOptimizar(aviso)
      mostrarMensaje('Ruta creada y pedidos asignados.')
      setModalNueva(false)
      resetearModal()
      await cargarDatos()
      seleccionarRuta(nuevaRuta)
    } catch (err) {
      setErrorCrear(err.response?.data?.message || 'Error al crear la ruta.')
    } finally {
      setGuardandoRuta(false)
    }
  }

  const handleOptimizar = async () => {
    setOptimizando(true)
    setError('')
    try {
      const { data } = await api.post(`/rutas/${rutaDetalle.cod_ruta}/optimizar`)
      setAdvertenciaOptimizar(data.data?.aviso || '')
      mostrarMensaje('Orden de entrega optimizado.')
      cargarDetalle(rutaDetalle.cod_ruta)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al optimizar la ruta.')
    } finally {
      setOptimizando(false)
    }
  }

  const abrirModalAgregar = async () => {
    setModalAgregar(true)
    setSeleccionadosAgregar([])
    setErrorAgregar('')
    setPendientesAgregar([])
    setCargandoPendientes(true)
    try {
      const { data } = await api.get('/pedidos/pendientes')
      const idsEnRuta = new Set((rutaDetalle.pedidos || []).map(p => p.id_pedido))
      setPendientesAgregar(data.data.filter(p => !idsEnRuta.has(p.id_pedido)))
    } catch {
      setPendientesAgregar([])
    } finally {
      setCargandoPendientes(false)
    }
  }

  const togglePedidoAgregar = (id_pedido) => {
    setSeleccionadosAgregar(prev =>
      prev.includes(id_pedido) ? prev.filter(id => id !== id_pedido) : [...prev, id_pedido]
    )
  }

  const handleAgregarPedidos = async () => {
    if (seleccionadosAgregar.length === 0) {
      setErrorAgregar('Selecciona al menos un pedido.')
      return
    }
    setAgregando(true)
    setErrorAgregar('')
    try {
      await api.post(`/rutas/${rutaDetalle.cod_ruta}/pedidos`, { pedido_ids: seleccionadosAgregar })
      setModalAgregar(false)
      setSeleccionadosAgregar([])
      mostrarMensaje(`${seleccionadosAgregar.length} pedido(s) agregado(s) al final de la ruta.`)
      cargarDetalle(rutaDetalle.cod_ruta)
    } catch (err) {
      setErrorAgregar(err.response?.data?.message || 'Error al agregar los pedidos.')
    } finally {
      setAgregando(false)
    }
  }

  const handleReoptimizar = async () => {
    setOptimizando(true)
    setError('')
    setConfirmarReoptimizar(false)
    try {
      const { data } = await api.post(`/rutas/${rutaDetalle.cod_ruta}/optimizar`)
      setAdvertenciaOptimizar(data.data?.aviso || '')
      mostrarMensaje('Ruta re-optimizada. Los pedidos ya entregados mantienen su posición.')
      cargarDetalle(rutaDetalle.cod_ruta)
    } catch (err) {
      setError(err.response?.data?.message || 'Error al re-optimizar la ruta.')
    } finally {
      setOptimizando(false)
    }
  }

  const totalBidonesSeleccionados = pedidosSeleccionados.reduce((acc, id_pedido) => {
    const p = pedidosPendientes.find(p => p.id_pedido === id_pedido)
    return acc + (p ? contarBidones(p.lineas) : 0)
  }, 0)

  const pedidosDetalle = rutaDetalle ? agruparPedidos(rutaDetalle.pedidos || []) : []

  const pedidosConCoordenadas = pedidosDetalle
    .filter(p => p.latitud && p.longitud)
    .sort((a, b) => (a.orden_entrega ?? 99) - (b.orden_entrega ?? 99))

  const polylinePositions = [
    TRAYENCO,
    ...pedidosConCoordenadas.map(p => [parseFloat(p.latitud), parseFloat(p.longitud)]),
  ]

  const inputClase = (campo) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      erroresRuta[campo] ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="flex h-full overflow-hidden">

      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Rutas</h2>
          <button
            onClick={abrirModal}
            className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-blue-700 transition"
          >
            + Nueva
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-10">Cargando...</p>
          ) : rutas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">No hay rutas.</p>
          ) : (
            rutas.map(r => (
              <button
                key={r.cod_ruta}
                onClick={() => seleccionarRuta(r)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                  rutaSeleccionadaId === r.cod_ruta
                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                    : 'border-l-4 border-l-transparent'
                }`}
              >
                <p className="text-sm font-medium text-gray-800">{fmt(r.fecha)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.repartidor_nombre || 'Sin repartidor'} · {r.total_pedidos} pedido(s)
                </p>
                {r.zonas?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{nombresZonas(r.zonas)}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {mensaje && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700">
            {mensaje}
          </div>
        )}
        {error && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}
        {advertenciaOptimizar && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-700">
            {advertenciaOptimizar}
          </div>
        )}

        {!rutaDetalle && !loadingDetalle ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecciona una ruta para ver el detalle.
          </div>
        ) : loadingDetalle ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Cargando detalle...
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 bg-white border-b border-gray-200">
              <div className="px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Ruta del {fmt(rutaDetalle.fecha)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {rutaDetalle.repartidor_nombre || 'Sin repartidor'}
                    {nombresZonas(rutaDetalle.zonas) && ` · ${nombresZonas(rutaDetalle.zonas)}`}
                    {rutaDetalle.cantidad_bidones && ` · ${rutaDetalle.cantidad_bidones} bidón(es)`}
                  </p>
                  {rutaDetalle.texto && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{rutaDetalle.texto}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={abrirModalAgregar}
                    className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                  >
                    Agregar pedidos
                  </button>

                  {pedidosDetalle.length > 0 && !confirmarReoptimizar && (
                    <button
                      onClick={() => setConfirmarReoptimizar(true)}
                      disabled={optimizando}
                      className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
                    >
                      Re-optimizar ruta
                    </button>
                  )}

                  {confirmarReoptimizar && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-amber-700 max-w-[180px]">
                        Reordenará solo los pedidos pendientes. Los ya entregados mantienen su posición.
                      </span>
                      <button
                        onClick={handleReoptimizar}
                        disabled={optimizando}
                        className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
                      >
                        {optimizando ? 'Optimizando...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmarReoptimizar(false)}
                        className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 pb-3 max-h-48 overflow-y-auto">
                {pedidosDetalle.length === 0 ? (
                  <p className="text-sm text-gray-400 pb-2">Sin pedidos asignados.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-1.5 font-medium w-8">#</th>
                        <th className="pb-1.5 font-medium">Cliente</th>
                        <th className="pb-1.5 font-medium">Dirección</th>
                        <th className="pb-1.5 font-medium">Bidones</th>
                        <th className="pb-1.5 font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pedidosDetalle.map(p => (
                        <tr key={p.id_pedido}>
                          <td className="py-1.5 pr-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                              {p.orden_entrega ?? '—'}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 font-medium text-gray-800 whitespace-nowrap">{p.cliente_nombre}</td>
                          <td className="py-1.5 pr-3 text-gray-500 max-w-[160px] truncate">{p.cliente_direccion}</td>
                          <td className="py-1.5 pr-3 text-gray-600">{resumenBidones(p.lineas)}</td>
                          <td className="py-1.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PEDIDO_ESTADO_BADGE[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                              {PEDIDO_ESTADO_LABEL[p.estado] || p.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <MapContainer
                key={rutaDetalle.cod_ruta}
                center={TRAYENCO}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker position={TRAYENCO} icon={plantaIcon}>
                  <Popup><strong>Planta Trayenco</strong><br />Punto de salida</Popup>
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

                {pedidosConCoordenadas.length > 0 && (
                  <Polyline
                    positions={polylinePositions}
                    color="#2563eb"
                    weight={2.5}
                    dashArray="6 4"
                  />
                )}
              </MapContainer>
            </div>
          </>
        )}
      </div>

      {modalAgregar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">

            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">Agregar pedidos a la ruta</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Pedidos pendientes en {nombresZonas(rutaDetalle?.zonas) || 'las zonas de la ruta'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              {cargandoPendientes ? (
                <p className="text-center text-gray-400 text-sm py-6">Cargando pedidos disponibles...</p>
              ) : pendientesAgregar.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">
                  No hay pedidos pendientes disponibles en las zonas de esta ruta.
                </p>
              ) : (
                <div className="space-y-2">
                  {pendientesAgregar.map(p => (
                    <label
                      key={p.id_pedido}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        checked={seleccionadosAgregar.includes(p.id_pedido)}
                        onChange={() => togglePedidoAgregar(p.id_pedido)}
                        className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{p.cliente_nombre}</p>
                          {p.zona_nombre && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {p.zona_nombre}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{p.cliente_direccion}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{resumenBidones(p.lineas)}</p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                        {contarBidones(p.lineas)} bidón(es)
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
              {errorAgregar && <p className="text-red-500 text-sm mb-3">{errorAgregar}</p>}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {seleccionadosAgregar.length} pedido(s) seleccionado(s)
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setModalAgregar(false); setSeleccionadosAgregar([]) }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAgregarPedidos}
                    disabled={agregando || seleccionadosAgregar.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {agregando ? 'Agregando...' : 'Agregar al final'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 flex flex-col max-h-[85vh]">

            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">Ruta del día</h2>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">{hoyLegible()}</p>
            </div>

            <form onSubmit={handleCrearRuta} className="flex flex-col flex-1 min-h-0">
              <div className="px-6 py-4 space-y-4 flex-shrink-0">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zonas <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {zonas.map(z => {
                      const seleccionada = formRuta.cod_zonas.includes(z.cod_zona)
                      return (
                        <button
                          key={z.cod_zona}
                          type="button"
                          onClick={() => toggleZona(z.cod_zona)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                            seleccionada
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {z.nombre}
                          <span className={`ml-1.5 text-xs ${seleccionada ? 'text-blue-200' : 'text-gray-400'}`}>
                            ({z.total_clientes ?? 0})
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {erroresRuta.cod_zonas && (
                    <p className="text-red-500 text-xs mt-1">{erroresRuta.cod_zonas}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repartidor <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="id_repartidor"
                    value={formRuta.id_repartidor}
                    onChange={handleRepartidorChange}
                    className={inputClase('id_repartidor')}
                  >
                    <option value="">Seleccionar repartidor...</option>
                    {repartidores.map(r => (
                      <option key={r.id_repartidor} value={r.id_repartidor}>{r.nombre}</option>
                    ))}
                  </select>
                  {erroresRuta.id_repartidor && (
                    <p className="text-red-500 text-xs mt-1">{erroresRuta.id_repartidor}</p>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Pedidos pendientes en las zonas seleccionadas
                    </p>
                    {pedidosSeleccionados.length > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        Total de bidones: {totalBidonesSeleccionados}
                      </p>
                    )}
                  </div>
                  {erroresRuta.pedidos && (
                    <p className="text-red-500 text-xs mb-2">{erroresRuta.pedidos}</p>
                  )}
                </div>
              </div>

              <div className="px-6 overflow-y-auto flex-1 min-h-0">
                {formRuta.cod_zonas.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Selecciona al menos una zona para ver los pedidos disponibles.
                  </p>
                ) : cargandoPedidos ? (
                  <p className="text-sm text-gray-400 text-center py-6">Cargando pedidos...</p>
                ) : pedidosPendientes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No hay pedidos pendientes en las zonas seleccionadas.
                  </p>
                ) : (
                  <div className="space-y-2 pb-4">
                    {pedidosPendientes.map(p => (
                      <label
                        key={p.id_pedido}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={pedidosSeleccionados.includes(p.id_pedido)}
                          onChange={() => togglePedido(p.id_pedido)}
                          className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{p.cliente_nombre}</p>
                            {p.zona_nombre && (
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {p.zona_nombre}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{p.cliente_direccion}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{resumenBidones(p.lineas)}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                          {contarBidones(p.lineas)} bidón(es)
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
                {errorCrear && <p className="text-red-500 text-sm mb-3">{errorCrear}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {pedidosSeleccionados.length} pedido(s) seleccionado(s)
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setModalNueva(false); resetearModal() }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoRuta}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {guardandoRuta ? 'Creando...' : 'Crear ruta y optimizar'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Rutas
