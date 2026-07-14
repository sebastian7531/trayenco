import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import socket, { conectarSocket } from '../../services/socket'

const hoyISO = () => new Date().toISOString().split('T')[0]

const fmtFecha = (f) => f
  ? new Date(f).toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
  : '—'

const resumenBidones = (lineas) => {
  if (!lineas?.length) return '—'
  return lineas.map((l) => `${l.cantidad}x ${l.formato?.replace(' litros', 'L') || l.descripcion}`).join(', ')
}

const ESTADO_BADGE = {
  pendiente:        'bg-gray-100 text-gray-700',
  en_ruta:          'bg-blue-100 text-blue-700',
  entregado:        'bg-green-100 text-green-700',
  problema_entrega: 'bg-red-100 text-red-700',
  completada:       'bg-green-100 text-green-700',
}

const ESTADO_LABEL = {
  pendiente:        'Pendiente',
  en_ruta:          'En ruta',
  entregado:        'Entregado',
  problema_entrega: 'Problema de entrega',
  completada:       'Completada',
}

const Tarjeta = ({ label, valor, color, sub }) => (
  <div className={`bg-white rounded-xl border-l-4 ${color} shadow-sm p-5`}>
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-3xl font-bold text-gray-800">{valor ?? '—'}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
)

const Dashboard = () => {
  const { user } = useAuth()
  const [resumen, setResumen] = useState(null)
  const [stock, setStock] = useState(null)
  const [pedidosRecientes, setPedidosRecientes] = useState([])
  const [rutasHoy, setRutasHoy] = useState([])
  const [loading, setLoading] = useState(true)

  const cargarDatos = useCallback(async () => {
    const hoy = hoyISO()
    try {
      const [resReporte, resStock, resPedidos, resRutas] = await Promise.all([
        api.get(`/reportes/diario?fecha=${hoy}`),
        api.get('/stock/hoy'),
        api.get('/pedidos'),
        api.get('/rutas'),
      ])

      setResumen(resReporte.data.data)
      setStock(resStock.data.data)
      setPedidosRecientes(resPedidos.data.data.slice(0, 5))

      const rutasDeHoy = resRutas.data.data.filter(
        (r) => r.fecha?.slice(0, 10) === hoy
      )
      setRutasHoy(rutasDeHoy)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
    const intervalo = setInterval(cargarDatos, 30000)
    return () => clearInterval(intervalo)
  }, [cargarDatos])

  useEffect(() => {
    conectarSocket('administrador')
    socket.on('entrega_confirmada', cargarDatos)
    socket.on('pedido_actualizado', cargarDatos)
    socket.on('pedido_creado', cargarDatos)
    socket.on('ruta_actualizada', cargarDatos)
    return () => {
      socket.off('entrega_confirmada', cargarDatos)
      socket.off('pedido_actualizado', cargarDatos)
      socket.off('pedido_creado', cargarDatos)
      socket.off('ruta_actualizada', cargarDatos)
    }
  }, [cargarDatos])

  const fechaLarga = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const totalCargados = Array.isArray(stock) ? stock.reduce((acc, s) => acc + (s.bidones_cargados || 0), 0) : 0
  const totalEntregados = Array.isArray(stock) ? stock.reduce((acc, s) => acc + (s.bidones_entregados || 0), 0) : 0
  const bidionesFurgon = stock ? totalCargados - totalEntregados : null

  return (
    <div className="p-6 space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Bienvenido{user?.nombre ? `, ${user.nombre.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{fechaLarga}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border-l-4 border-l-gray-200 shadow-sm p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Tarjeta
            label="Total pedidos hoy"
            valor={resumen?.pedidos?.total}
            color="border-l-blue-500"
            sub="en todas las rutas"
          />
          <Tarjeta
            label="Pedidos entregados"
            valor={resumen?.pedidos?.entregados}
            color="border-l-green-500"
            sub={resumen ? `de ${resumen.pedidos.total} totales` : ''}
          />
          <Tarjeta
            label="Bidones en furgón"
            valor={bidionesFurgon}
            color="border-l-orange-500"
            sub={stock ? `de ${totalCargados} cargados` : ''}
          />
          <Tarjeta
            label="Bidones entregados"
            valor={resumen?.stock?.bidones_entregados}
            color="border-l-gray-400"
            sub="confirmados hoy"
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Pedidos recientes</h2>
            <p className="text-xs text-gray-400 mt-0.5">Últimos 5 pedidos registrados</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Cargando...</div>
          ) : pedidosRecientes.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Sin pedidos registrados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Bidones</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pedidosRecientes.map((p) => (
                  <tr key={p.id_pedido} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[140px] truncate">
                      {p.cliente_nombre}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtFecha(p.fecha)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{resumenBidones(p.lineas)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_BADGE[p.estado]}`}>
                        {ESTADO_LABEL[p.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Rutas de hoy</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Cargando...</div>
          ) : rutasHoy.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              No hay rutas creadas para hoy.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rutasHoy.map((r) => (
                <div key={r.cod_ruta} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {new Date(r.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC', day: 'numeric', month: 'long' })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.total_pedidos} pedido(s)</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                    {r.repartidor_nombre || 'Sin asignar'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
