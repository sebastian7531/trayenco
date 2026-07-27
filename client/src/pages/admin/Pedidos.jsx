import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import socket, { conectarSocket } from '../../services/socket'
import { construirPedidosCarga } from '../../utils/pedidoPayload'

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

const TRANSICIONES = {
  pendiente: ['en_ruta'],
  en_ruta:   ['entregado', 'problema_entrega'],
}

const FILTROS = ['todos', 'pendiente', 'en_ruta', 'entregado', 'problema_entrega']

const PRIORIDAD_BADGE = {
  urgente: 'bg-red-100 text-red-700',
  normal:  'bg-gray-100 text-gray-500',
}

const LINEA_VACIA = { cod_bidon: '', cantidad: 1 }
const FORM_VACIO = { id_cliente: '', prioridad: 'normal', lineas: [{ ...LINEA_VACIA }] }
const ERROR_LINEA_VACIO = { cod_bidon: '', cantidad: '' }
const ERRORES_VACIO = { id_cliente: '', lineas: [{ ...ERROR_LINEA_VACIO }] }

const resumenBidones = (lineas) => {
  if (!lineas || lineas.length === 0) return '-'
  return lineas.map(l => `${l.cantidad}x ${l.formato || l.descripcion || `bidon ${l.cod_bidon}`}`).join(', ')
}

const validarLinea = (linea) => ({
  cod_bidon: !linea.cod_bidon ? 'Seleccione un tipo de bidón' : '',
  cantidad: (() => {
    const n = Number(linea.cantidad)
    if (!linea.cantidad && linea.cantidad !== 0) return 'La cantidad es requerida'
    if (!Number.isInteger(n) || n < 1 || n > 100) return 'Entero entre 1 y 100'
    return ''
  })(),
})

const validarTodo = (form, esEdicion = false) => ({
  id_cliente: esEdicion ? '' : (!form.id_cliente ? 'Debe seleccionar un cliente' : ''),
  lineas: form.lineas.map(validarLinea),
})

const hayErrores = (errores) =>
  Boolean(errores.id_cliente) || errores.lineas.some(l => l.cod_bidon || l.cantidad)

const Pedidos = () => {
  const [pedidos, setPedidos]   = useState([])
  const [clientes, setClientes] = useState([])
  const [bidones, setBidones]   = useState([])
  const [zonas, setZonas]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [mensaje, setMensaje]   = useState('')
  const [filtro, setFiltro]     = useState('todos')
  const [filtroZona, setFiltroZona]           = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')

  const [modalAbierto, setModalAbierto]     = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState(null)
  const [form, setForm]                     = useState(FORM_VACIO)
  const [errores, setErrores]               = useState(ERRORES_VACIO)
  const [guardando, setGuardando]           = useState(false)
  const [errorModal, setErrorModal]         = useState('')

  const [cambiandoEstado, setCambiandoEstado] = useState(null)
  const [nuevoEstado, setNuevoEstado]         = useState('')
  const [guardandoEstado, setGuardandoEstado] = useState(false)

  const [modalCargaRapida, setModalCargaRapida] = useState(false)
  const [zonaRapida, setZonaRapida]             = useState('')
  const [filasCarga, setFilasCarga]             = useState([])
  const [guardandoCarga, setGuardandoCarga]     = useState(false)
  const [errorCargaRapida, setErrorCargaRapida] = useState('')
  const cargaRapidaEnCurso = useRef(false)

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [resPedidos, resClientes, resBidones, resZonas] = await Promise.all([
        api.get('/pedidos'),
        api.get('/clientes'),
        api.get('/bidones'),
        api.get('/zonas'),
      ])
      setPedidos(resPedidos.data.data)
      setClientes(resClientes.data.data)
      setBidones(resBidones.data.data)
      setZonas(resZonas.data.data)
    } catch {
      setError('No se pudieron cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    conectarSocket('administrador')
    socket.on('pedido_creado', cargarDatos)
    socket.on('pedido_actualizado', cargarDatos)
    socket.on('entrega_confirmada', cargarDatos)
    return () => {
      socket.off('pedido_creado', cargarDatos)
      socket.off('pedido_actualizado', cargarDatos)
      socket.off('entrega_confirmada', cargarDatos)
    }
  }, [cargarDatos])

  const pedidosFiltrados = filtro === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === filtro)

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const abrirCrear = () => {
    setPedidoEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setFiltroZona('')
    setBusquedaCliente('')
    setModalAbierto(true)
  }

  const abrirEditar = (pedido) => {
    setPedidoEditando(pedido)
    const lineas = pedido.lineas?.length > 0
      ? pedido.lineas.map(l => ({ cod_bidon: String(l.cod_bidon), cantidad: l.cantidad }))
      : [{ ...LINEA_VACIA }]
    setForm({ id_cliente: String(pedido.id_cliente || ''), prioridad: pedido.prioridad || 'normal', lineas })
    setErrores({ id_cliente: '', lineas: lineas.map(() => ({ ...ERROR_LINEA_VACIO })) })
    setErrorModal('')
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setPedidoEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setFiltroZona('')
    setBusquedaCliente('')
  }

  const agregarLinea = () => {
    setForm(prev => ({ ...prev, lineas: [...prev.lineas, { ...LINEA_VACIA }] }))
    setErrores(prev => ({ ...prev, lineas: [...prev.lineas, { ...ERROR_LINEA_VACIO }] }))
  }

  const quitarLinea = (idx) => {
    if (form.lineas.length <= 1) return
    setForm(prev => ({ ...prev, lineas: prev.lineas.filter((_, i) => i !== idx) }))
    setErrores(prev => ({ ...prev, lineas: prev.lineas.filter((_, i) => i !== idx) }))
  }

  const handleChangeCliente = (e) => {
    const value = e.target.value
    setForm(prev => ({ ...prev, id_cliente: value }))
    setErrores(prev => ({ ...prev, id_cliente: value ? '' : 'Debe seleccionar un cliente' }))
  }

  const handleFiltroZona = (e) => {
    setFiltroZona(e.target.value)
    setForm(prev => ({ ...prev, id_cliente: '' }))
    setErrores(prev => ({ ...prev, id_cliente: '' }))
  }

  const clientesFiltrados = clientes.filter(c => {
    const porZona   = !filtroZona || String(c.cod_zona) === filtroZona
    const porNombre = !busquedaCliente || c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase())
    return porZona && porNombre
  })

  const handleChangeLinea = (idx, campo, valor) => {
    const nuevasLineas = form.lineas.map((l, i) => i === idx ? { ...l, [campo]: valor } : l)
    setForm(prev => ({ ...prev, lineas: nuevasLineas }))
    const nuevosErrores = errores.lineas.map((e, i) =>
      i === idx ? { ...e, [campo]: validarLinea({ ...form.lineas[idx], [campo]: valor })[campo] } : e
    )
    setErrores(prev => ({ ...prev, lineas: nuevosErrores }))
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    const nuevosErrores = validarTodo(form, !!pedidoEditando)
    setErrores(nuevosErrores)
    if (hayErrores(nuevosErrores)) return

    setGuardando(true)
    setErrorModal('')
    try {
      const lineas = form.lineas.map(l => ({ cod_bidon: Number(l.cod_bidon), cantidad: Number(l.cantidad) }))
      if (pedidoEditando) {
        await api.put(`/pedidos/${pedidoEditando.id_pedido}`, { lineas, prioridad: form.prioridad })
        mostrarMensaje('Pedido actualizado.')
      } else {
        await api.post('/pedidos', { id_cliente: Number(form.id_cliente), prioridad: form.prioridad, lineas })
        mostrarMensaje('Pedido creado.')
      }
      cerrarModal()
      cargarDatos()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al guardar el pedido.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (pedido) => {
    if (!window.confirm(`¿Eliminar pedido de ${pedido.cliente_nombre}?`)) return
    try {
      await api.delete(`/pedidos/${pedido.id_pedido}`)
      mostrarMensaje('Pedido eliminado.')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar el pedido.')
    }
  }

  const abrirCambioEstado = (pedido) => {
    setCambiandoEstado(pedido.id_pedido)
    setNuevoEstado(TRANSICIONES[pedido.estado]?.[0] || '')
  }

  const cancelarCambioEstado = () => {
    setCambiandoEstado(null)
    setNuevoEstado('')
  }

  const confirmarCambioEstado = async (pedidoId) => {
    if (!nuevoEstado) return
    setGuardandoEstado(true)
    try {
      const body = { estado: nuevoEstado }
      await api.patch(`/pedidos/${pedidoId}/estado`, body)
      mostrarMensaje(`Estado actualizado a "${ESTADO_LABEL[nuevoEstado]}".`)
      cancelarCambioEstado()
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar el estado.')
      cancelarCambioEstado()
    } finally {
      setGuardandoEstado(false)
    }
  }

  const abrirCargaRapida = () => {
    setZonaRapida('')
    setFilasCarga([])
    setErrorCargaRapida('')
    setModalCargaRapida(true)
  }

  const cerrarCargaRapida = () => {
    setModalCargaRapida(false)
    setZonaRapida('')
    setFilasCarga([])
    setErrorCargaRapida('')
  }

  const handleZonaRapida = (e) => {
    const zona = e.target.value
    setZonaRapida(zona)
    setErrorCargaRapida('')
    const base = zona ? clientes.filter(c => String(c.cod_zona) === zona) : []
    setFilasCarga(base.map(c => ({
      id_cliente: c.id_cliente,
      nombre: c.nombre,
      cantidades: Object.fromEntries(bidones.map(b => [b.cod_bidon, 0])),
      urgente: false,
    })))
  }

  const handleCantidadCarga = (idx, cod_bidon, valor) => {
    setFilasCarga(prev => prev.map((f, i) => i === idx
      ? { ...f, cantidades: { ...f.cantidades, [cod_bidon]: valor } }
      : f
    ))
    setErrorCargaRapida('')
  }

  const togglePrioridadCarga = (idx) => {
    setFilasCarga(prev => prev.map((f, i) => i === idx ? { ...f, urgente: !f.urgente } : f))
  }

  const handleCargaRapida = async () => {
    if (cargaRapidaEnCurso.current) return
    const aCrear = construirPedidosCarga(filasCarga, bidones)

    if (aCrear.length === 0) {
      setErrorCargaRapida('Indique al menos un bidón con una cantidad entera entre 1 y 100.')
      return
    }

    cargaRapidaEnCurso.current = true
    setGuardandoCarga(true)
    setErrorCargaRapida('')
    setError('')
    try {
      const resultados = await Promise.allSettled(
        aCrear.map(pedido => api.post('/pedidos', pedido.payload))
      )

      const creados = resultados.filter(r => r.status === 'fulfilled').length
      const fallidos = resultados
        .map((resultado, i) => resultado.status === 'rejected'
          ? `${aCrear[i].nombre}: ${resultado.reason?.response?.data?.message || 'error al crear el pedido'}`
          : null
        )
        .filter(Boolean)

      await cargarDatos()
      cerrarCargaRapida()

      if (fallidos.length === 0) {
        mostrarMensaje(`Se crearon correctamente ${creados} pedido(s).`)
      } else {
        if (creados > 0) mostrarMensaje(`Se crearon correctamente ${creados} pedido(s).`)
        setError(`Fallaron ${fallidos.length} pedido(s): ${fallidos.join('; ')}.`)
      }
    } finally {
      cargaRapidaEnCurso.current = false
      setGuardandoCarga(false)
    }
  }

  const inputClase = (tieneError) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      tieneError ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{pedidosFiltrados.length} pedidos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={abrirCargaRapida}
            className="bg-white text-blue-600 border border-blue-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition"
          >
            Carga rápida por zona
          </button>
          <button
            onClick={abrirCrear}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nuevo Pedido
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filtro === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'todos' ? 'Todos' : ESTADO_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Cargando pedidos...
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            No hay pedidos{filtro !== 'todos' ? ` en estado "${ESTADO_LABEL[filtro]}"` : ''}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bidones</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Prioridad</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pedidosFiltrados.map(p => {
                  const transiciones = TRANSICIONES[p.estado] || []
                  const esFinal = transiciones.length === 0
                  const cambiando = cambiandoEstado === p.id_pedido

                  return (
                    <tr key={p.id_pedido} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.cliente_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{resumenBidones(p.lineas)}</td>
                      <td className="px-4 py-3">
                        {p.prioridad === 'urgente' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Urgente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[p.estado] || ''}`}>
                          {ESTADO_LABEL[p.estado] || p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.fecha ? new Date(p.fecha).toLocaleDateString('es-CL') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {cambiando ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={nuevoEstado}
                              onChange={e => setNuevoEstado(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {transiciones.map(t => (
                                <option key={t} value={t}>{ESTADO_LABEL[t]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => confirmarCambioEstado(p.id_pedido)}
                              disabled={guardandoEstado}
                              className="text-green-600 hover:text-green-800 font-medium text-xs transition disabled:opacity-50"
                            >
                              OK
                            </button>
                            <button
                              onClick={cancelarCambioEstado}
                              className="text-gray-400 hover:text-gray-600 text-xs transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            {!esFinal && (
                              <button
                                onClick={() => abrirCambioEstado(p)}
                                className="text-blue-600 hover:text-blue-800 font-medium transition"
                              >
                                Estado
                              </button>
                            )}
                            <button
                              onClick={() => abrirEditar(p)}
                              className="text-gray-600 hover:text-gray-800 font-medium transition"
                            >
                              Editar
                            </button>
                            {p.estado === 'pendiente' && (
                              <button
                                onClick={() => handleEliminar(p)}
                                className="text-red-500 hover:text-red-700 font-medium transition"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
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

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {pedidoEditando ? 'Editar pedido' : 'Nuevo pedido'}
              </h2>
            </div>

            <form onSubmit={handleGuardar} className="px-6 py-4 space-y-4">
              {!pedidoEditando && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                      <select
                        value={filtroZona}
                        onChange={handleFiltroZona}
                        className={inputClase(false)}
                      >
                        <option value="">Todas las zonas</option>
                        {zonas.map(z => (
                          <option key={z.cod_zona} value={String(z.cod_zona)}>
                            {z.nombre} ({z.total_clientes ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                      <input
                        type="text"
                        placeholder="Nombre del cliente..."
                        value={busquedaCliente}
                        onChange={e => setBusquedaCliente(e.target.value)}
                        className={inputClase(false)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.id_cliente}
                      onChange={handleChangeCliente}
                      className={inputClase(Boolean(errores.id_cliente))}
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientesFiltrados.map(c => (
                        <option key={c.id_cliente} value={c.id_cliente}>
                          {c.nombre} ({c.zona_nombre || 'Sin zona'})
                        </option>
                      ))}
                    </select>
                    {errores.id_cliente && (
                      <p className="text-red-500 text-xs mt-1">{errores.id_cliente}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={form.prioridad}
                  onChange={e => setForm(prev => ({ ...prev, prioridad: e.target.value }))}
                  className={inputClase(false)}
                >
                  <option value="normal">Normal</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Bidones <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium transition"
                  >
                    + Agregar línea
                  </button>
                </div>

                <div className="space-y-2">
                  {form.lineas.map((linea, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <select
                          value={linea.cod_bidon}
                          onChange={e => handleChangeLinea(idx, 'cod_bidon', e.target.value)}
                          className={inputClase(Boolean(errores.lineas[idx]?.cod_bidon))}
                        >
                          <option value="">Tipo de bidón...</option>
                          {bidones.map(b => (
                            <option key={b.cod_bidon} value={b.cod_bidon}>
                              {b.descripcion} — ${b.precio}
                            </option>
                          ))}
                        </select>
                        {errores.lineas[idx]?.cod_bidon && (
                          <p className="text-red-500 text-xs mt-0.5">{errores.lineas[idx].cod_bidon}</p>
                        )}
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          value={linea.cantidad}
                          onChange={e => handleChangeLinea(idx, 'cantidad', e.target.value)}
                          placeholder="Cant."
                          className={inputClase(Boolean(errores.lineas[idx]?.cantidad))}
                        />
                        {errores.lineas[idx]?.cantidad && (
                          <p className="text-red-500 text-xs mt-0.5">{errores.lineas[idx].cantidad}</p>
                        )}
                      </div>
                      {form.lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarLinea(idx)}
                          className="mt-2 text-red-400 hover:text-red-600 text-sm transition"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {errorModal && <p className="text-red-500 text-sm">{errorModal}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || hayErrores(errores)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalCargaRapida && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">Carga rápida por zona</h2>
            </div>

            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <select
                  value={zonaRapida}
                  onChange={handleZonaRapida}
                  className={inputClase(false)}
                >
                  <option value="">Seleccionar zona...</option>
                  {zonas.map(z => (
                    <option key={z.cod_zona} value={String(z.cod_zona)}>
                      {z.nombre} ({z.total_clientes ?? 0} clientes)
                    </option>
                  ))}
                </select>
              </div>

              {zonaRapida && filasCarga.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No hay clientes activos en esta zona.
                </p>
              )}

              {filasCarga.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Cliente</th>
                        {bidones.map(b => (
                          <th key={b.cod_bidon} className="text-center px-3 py-2 font-medium text-gray-600">
                            {b.formato || b.descripcion}
                          </th>
                        ))}
                        <th className="text-center px-3 py-2 font-medium text-gray-600">Urgente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filasCarga.map((f, idx) => (
                        <tr
                          key={f.id_cliente}
                          className={f.urgente ? 'bg-red-50' : 'hover:bg-gray-50'}
                        >
                          <td className={`px-3 py-2 font-medium ${f.urgente ? 'text-red-800' : 'text-gray-800'}`}>
                            {f.nombre}
                          </td>
                          {bidones.map(b => (
                            <td key={b.cod_bidon} className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={f.cantidades[b.cod_bidon] ?? 0}
                                onChange={e => handleCantidadCarga(idx, b.cod_bidon, e.target.value)}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => togglePrioridadCarga(idx)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                                f.urgente
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {f.urgente ? 'Urgente' : 'Normal'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              {errorCargaRapida && (
                <p className="mr-auto self-center text-sm text-red-600">{errorCargaRapida}</p>
              )}
              <button
                type="button"
                onClick={cerrarCargaRapida}
                disabled={guardandoCarga}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCargaRapida}
                disabled={guardandoCarga}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                {guardandoCarga ? 'Creando...' : 'Crear pedidos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Pedidos
