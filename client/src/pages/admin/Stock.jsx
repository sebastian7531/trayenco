import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import socket, { conectarSocket } from '../../services/socket'
import { calcularSaldosStock } from '../../utils/stock'

const ACCIONES = [
  {
    key: 'planta',
    label: 'Registrar Producción',
    descripcion: 'Total de bidones producidos en planta hoy.',
    endpoint: '/stock/planta',
    campo: 'bidones_planta',
    color: 'border-blue-300 text-blue-700 hover:bg-blue-50',
  },
  {
    key: 'cargar',
    label: 'Cargar Furgón',
    descripcion: 'Bidones que se cargan al furgón para la ruta.',
    endpoint: '/stock/cargar',
    campo: 'cantidad',
    color: 'border-orange-300 text-orange-700 hover:bg-orange-50',
  },
  {
    key: 'retorno',
    label: 'Registrar Retorno',
    descripcion: 'Bidones vacíos devueltos por los clientes.',
    endpoint: '/stock/retorno',
    campo: 'cantidad',
    color: 'border-gray-300 text-gray-700 hover:bg-gray-50',
  },
]

const Tarjeta = ({ label, valor, color, sub }) => (
  <div className={`bg-white rounded-xl border-l-4 ${color} shadow-sm p-5`}>
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-3xl font-bold text-gray-800">{valor ?? '—'}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

const fmtLabel = (formato) => formato?.replace(' litros', 'L') || '?'

const validarCantidad = (valor) => {
  if (valor === '' || valor === null || valor === undefined) return 'La cantidad es requerida'
  if (!/^\d+$/.test(String(valor))) return 'La cantidad solo puede contener números enteros'
  const num = Number(valor)
  if (!Number.isInteger(num) || num < 1 || num > 999) return 'La cantidad debe ser un número entero entre 1 y 999'
  return ''
}

const Stock = () => {
  const [stockHoy, setStockHoy]   = useState([])
  const [historial, setHistorial] = useState([])
  const [bidones, setBidones]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [mensaje, setMensaje]     = useState('')

  const [modal, setModal]               = useState(null)
  const [cantidad, setCantidad]         = useState('')
  const [codBidon, setCodBidon]         = useState('')
  const [errorCantidad, setErrorCantidad] = useState('')
  const [errorBidon, setErrorBidon]     = useState('')
  const [guardando, setGuardando]       = useState(false)
  const [errorModal, setErrorModal]     = useState('')

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      const [resHoy, resHistorial, resBidones] = await Promise.all([
        api.get('/stock/hoy'),
        api.get('/stock'),
        api.get('/bidones'),
      ])
      setStockHoy(resHoy.data.data || [])
      setHistorial(resHistorial.data.data)
      setBidones(resBidones.data.data)
    } catch {
      setError('No se pudo cargar el stock.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  useEffect(() => {
    conectarSocket('administrador')
    socket.on('entrega_confirmada', cargarDatos)
    return () => {
      socket.off('entrega_confirmada', cargarDatos)
    }
  }, [cargarDatos])

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const abrirModal = (accion) => {
    setModal(accion)
    setCantidad('')
    setCodBidon('')
    setErrorCantidad('')
    setErrorBidon('')
    setErrorModal('')
  }

  const cerrarModal = () => {
    setModal(null)
    setErrorCantidad('')
    setErrorBidon('')
    setErrorModal('')
  }

  const handleCantidadChange = (e) => {
    const value = e.target.value
    setCantidad(value)
    setErrorCantidad(validarCantidad(value))
  }

  const handleBidonChange = (e) => {
    setCodBidon(e.target.value)
    setErrorBidon(e.target.value ? '' : 'El tipo de bidón es requerido')
  }

  const handleConfirmar = async (e) => {
    e.preventDefault()
    const errCant  = validarCantidad(cantidad)
    const errBidon = codBidon ? '' : 'El tipo de bidón es requerido'
    setErrorCantidad(errCant)
    setErrorBidon(errBidon)
    if (errCant || errBidon) return

    setGuardando(true)
    setErrorModal('')
    try {
      await api.post(modal.endpoint, { [modal.campo]: Number(cantidad), cod_bidon: Number(codBidon) })
      mostrarMensaje(`${modal.label} registrado correctamente.`)
      cerrarModal()
      cargarDatos()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al procesar la operación.')
    } finally {
      setGuardando(false)
    }
  }

  const totalHoy = stockHoy.reduce((acc, s) => ({
    bidones_planta:     acc.bidones_planta     + (s.bidones_planta     || 0),
    bidones_cargados:   acc.bidones_cargados   + (s.bidones_cargados   || 0),
    bidones_entregados: acc.bidones_entregados + (s.bidones_entregados || 0),
    bidones_retornados: acc.bidones_retornados + (s.bidones_retornados || 0),
  }), { bidones_planta: 0, bidones_cargados: 0, bidones_entregados: 0, bidones_retornados: 0 })

  const saldosHoy = calcularSaldosStock(totalHoy)

  const desglose = (campo) =>
    stockHoy.length
      ? stockHoy.map(s => `${fmtLabel(s.formato)}: ${s[campo] ?? 0}`).join(' | ')
      : null

  const desgloseSaldo = (campo) => stockHoy.length
    ? stockHoy.map(s => `${fmtLabel(s.formato)}: ${calcularSaldosStock(s)[campo]}`).join(' | ')
    : null

  const idsHoy = new Set(stockHoy.map(s => s.id_stock))

  return (
    <div className="p-6 space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
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

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando stock del día...</p>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Tarjeta
            label="Bidones en planta"
            valor={saldosHoy.plantaDisponible}
            color="border-l-blue-500"
            sub={desgloseSaldo('plantaDisponible')}
          />
          <Tarjeta
            label="Bidones en ruta actualmente"
            valor={saldosHoy.enRuta}
            color="border-l-orange-500"
            sub={desgloseSaldo('enRuta')}
          />
          <Tarjeta
            label="Entregados hoy"
            valor={totalHoy.bidones_entregados}
            color="border-l-green-500"
            sub={desglose('bidones_entregados')}
          />
          <Tarjeta
            label="Retornados hoy"
            valor={totalHoy.bidones_retornados}
            color="border-l-gray-400"
            sub={desglose('bidones_retornados')}
          />
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {ACCIONES.map((accion) => (
          <button
            key={accion.key}
            onClick={() => abrirModal(accion)}
            className={`px-4 py-2.5 border rounded-lg text-sm font-medium transition ${accion.color}`}
          >
            {accion.label}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Historial de stock</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {historial.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              Sin registros históricos.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">En planta</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Cargados</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Entregados</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Retornados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historial.map((s) => {
                  const esHoy = idsHoy.has(s.id_stock)
                  return (
                    <tr key={s.id_stock} className={`hover:bg-gray-50 transition ${esHoy ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {new Date(s.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                        {esHoy && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                            hoy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.formato || s.bidon_descripcion || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{s.bidones_planta}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{s.bidones_cargados}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{s.bidones_entregados}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{s.bidones_retornados}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">{modal.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{modal.descripcion}</p>
            </div>

            <form onSubmit={handleConfirmar} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de bidón <span className="text-red-500">*</span>
                </label>
                <select
                  value={codBidon}
                  onChange={handleBidonChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errorBidon ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Seleccionar tipo...</option>
                  {bidones.map(b => (
                    <option key={b.cod_bidon} value={b.cod_bidon}>
                      {b.formato} — {b.descripcion}
                    </option>
                  ))}
                </select>
                {errorBidon && <p className="text-red-500 text-xs mt-1">{errorBidon}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {modal.campo === 'bidones_planta' ? 'Total de bidones en planta' : 'Cantidad de bidones'}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cantidad}
                  onChange={handleCantidadChange}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errorCantidad ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errorCantidad && <p className="text-red-500 text-xs mt-1">{errorCantidad}</p>}
              </div>

              {errorModal && (
                <p className="text-red-500 text-sm">{errorModal}</p>
              )}

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
                  disabled={guardando || !!errorCantidad || !!errorBidon}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Stock
