import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  AreaChart, Area,
} from 'recharts'
import api from '../../services/api'
import logo from '../../assets/logo_trayenco.jpg'
import { desplazarFechaISO, fechaHoySantiago } from '../../utils/stock'

const hoyISO = fechaHoySantiago
const haceNDias = (n) => desplazarFechaISO(fechaHoySantiago(), -n)
const fmtFecha = (f) => new Date(f).toLocaleDateString('es-CL', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })

const TABS = [
  { key: 'diario',      label: 'Resumen diario' },
  { key: 'pedidos',     label: 'Pedidos' },
  { key: 'rendimiento', label: 'Rendimiento' },
  { key: 'stock',       label: 'Stock' },
  { key: 'clientes',    label: 'Clientes frecuentes' },
]

const COLORES_PIE = ['#6b7280', '#16a34a', '#dc2626']

const AZUL       = [12, 74, 153]
const AZUL_CLARO = [214, 234, 248]
const VERDE      = [22, 163, 74]
const ROJO       = [220, 38, 38]

const agregarEncabezadoPDF = (doc, titulo, periodo) => {
  const margen = 14
  const paginaAncho = doc.internal.pageSize.getWidth()

  doc.addImage(logo, 'JPEG', margen, 8, 40, 20)

  const textoX = margen + 46
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(AZUL[0], AZUL[1], AZUL[2])
  doc.text('Trayentome', textoX, 16)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text('Purificamos tu agua, mejoramos tu vida', textoX, 23)

  let y = 35
  doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2])
  doc.setLineWidth(0.8)
  doc.line(margen, y, paginaAncho - margen, y)
  y += 8

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(AZUL[0], AZUL[1], AZUL[2])
  doc.text(titulo, margen, y)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(periodo, margen, y)
  y += 6

  doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2])
  doc.setLineWidth(0.4)
  doc.line(margen, y, paginaAncho - margen, y)
  y += 8

  return y
}

const agregarPiePDF = (doc) => {
  const totalPaginas = doc.internal.getNumberOfPages()
  const margen = 14
  const paginaAncho = doc.internal.pageSize.getWidth()
  const ahora = new Date()
  const hora = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  const fechaGen = ahora.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  const textoPie = `Generado el ${fechaGen} a las ${hora}`

  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    const altoPagina = doc.internal.pageSize.getHeight()
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margen, altoPagina - 15, paginaAncho - margen, altoPagina - 15)
    doc.text(textoPie, margen, altoPagina - 9)
    doc.text(`Página ${i} de ${totalPaginas}`, paginaAncho - margen, altoPagina - 9, { align: 'right' })
  }
}

const Tarjeta = ({ label, valor, color }) => (
  <div className={`bg-white rounded-xl border-l-4 ${color} shadow-sm p-5`}>
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-3xl font-bold text-gray-800">{valor ?? '—'}</p>
  </div>
)

const FiltroFormatos = ({ formatosSeleccionados, onCambiarFormato }) => (
  <div>
    <span className="block text-xs font-medium text-gray-600 mb-1">Formato</span>
    <div className="flex items-center gap-3 h-[38px] px-3 border border-gray-300 rounded-lg bg-white">
      {['10l', '20l'].map((formato) => (
        <label key={formato} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={formatosSeleccionados[formato]}
            onChange={() => onCambiarFormato(formato)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {formato === '10l' ? '10 L' : '20 L'}
        </label>
      ))}
    </div>
  </div>
)

const RangoFechas = ({ inicio, fin, setInicio, setFin, onConsultar, cargando, onDescargarPDF, sinDatos, children }) => (
  <div className="flex flex-wrap items-end gap-3 mb-6">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
      <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
      <input type="date" value={fin} onChange={(e) => setFin(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
    {children}
    <button onClick={onConsultar} disabled={cargando}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
      {cargando ? 'Consultando...' : 'Consultar'}
    </button>
    {onDescargarPDF && (
      <button onClick={onDescargarPDF} disabled={sinDatos}
        className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40">
        Descargar PDF
      </button>
    )}
  </div>
)

const TabDiario = ({ formatosSeleccionados, onCambiarFormato }) => {
  const [fecha, setFecha] = useState(hoyISO())
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const consultar = async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get(`/reportes/diario?fecha=${fecha}`)
      setDatos(data.data)
    } catch {
      setError('No se pudo obtener el resumen.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { consultar() }, [])

  const pieData = datos ? [
    { name: 'Pendientes',           value: datos.pedidos.pendientes },
    { name: 'Entregados',           value: datos.pedidos.entregados },
    { name: 'Problemas de entrega', value: datos.pedidos.problemas_entrega },
  ].filter((d) => d.value > 0) : []

  const generarPDF = () => {
    if (!datos) return
    const doc = new jsPDF()
    const partes = fecha.split('-')
    const fechaObj = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]))
    const fechaLegible = fechaObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    const periodo = fecha === hoyISO() ? `Hoy — ${fechaLegible}` : fechaLegible

    let y = agregarEncabezadoPDF(doc, 'Resumen diario', periodo)

    const columnasBidones = []
    const valoresBidones = []
    if (formatosSeleccionados['10l']) {
      columnasBidones.push('Bidones entregados 10 L')
      valoresBidones.push(String(datos.stock.bidones_entregados_10l ?? 0))
    }
    if (formatosSeleccionados['20l']) {
      columnasBidones.push('Bidones entregados 20 L')
      valoresBidones.push(String(datos.stock.bidones_entregados_20l ?? 0))
    }

    autoTable(doc, {
      startY: y,
      head: [['Total pedidos', 'Entregados', 'Problemas de entrega', ...columnasBidones]],
      body: [[
        String(datos.pedidos.total ?? 0),
        String(datos.pedidos.entregados ?? 0),
        String(datos.pedidos.problemas_entrega ?? 0),
        ...valoresBidones,
      ]],
      headStyles: { fillColor: AZUL_CLARO, textColor: AZUL, fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 18, fontStyle: 'bold', halign: 'center', cellPadding: 6 },
      columnStyles: {
        0: { textColor: [60, 60, 60] },
        1: { textColor: VERDE },
        2: { textColor: ROJO },
        3: { textColor: AZUL },
        4: { textColor: AZUL },
      },
      theme: 'grid',
    })

    agregarPiePDF(doc)
    doc.save(`reporte_diario_${fecha}.pdf`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <FiltroFormatos
          formatosSeleccionados={formatosSeleccionados}
          onCambiarFormato={onCambiarFormato}
        />
        <button onClick={consultar} disabled={cargando}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
          {cargando ? 'Consultando...' : 'Consultar'}
        </button>
        <button onClick={generarPDF} disabled={!datos}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40">
          Descargar PDF
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {datos && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Tarjeta label="Total pedidos"        valor={datos.pedidos.total}               color="border-l-blue-500" />
            <Tarjeta label="Entregados"            valor={datos.pedidos.entregados}          color="border-l-green-500" />
            <Tarjeta label="Problemas de entrega" valor={datos.pedidos.problemas_entrega}    color="border-l-red-500" />
            {formatosSeleccionados['10l'] && (
              <Tarjeta label="Bidones entregados 10 L" valor={datos.stock.bidones_entregados_10l} color="border-l-orange-500" />
            )}
            {formatosSeleccionados['20l'] && (
              <Tarjeta label="Bidones entregados 20 L" valor={datos.stock.bidones_entregados_20l} color="border-l-amber-500" />
            )}
          </div>

          {pieData.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribución de pedidos por estado</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORES_PIE[i % COLORES_PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Sin pedidos para esa fecha.</p>
          )}
        </>
      )}
    </div>
  )
}

const TabPedidos = () => {
  const [inicio, setInicio] = useState(haceNDias(30))
  const [fin, setFin] = useState(hoyISO())
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const consultar = async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get(`/reportes/pedidos?fecha_inicio=${inicio}&fecha_fin=${fin}`)
      setDatos(data.data.map((d) => ({ ...d, fecha: fmtFecha(d.fecha) })))
    } catch {
      setError('No se pudo obtener el reporte.')
    } finally {
      setCargando(false)
    }
  }

  const generarPDF = () => {
    if (!datos.length) return
    const doc = new jsPDF()
    let y = agregarEncabezadoPDF(doc, 'Reporte de pedidos', `${inicio} al ${fin}`)

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Total pedidos']],
      body: datos.map((d) => [d.fecha, String(d.total)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
    })

    agregarPiePDF(doc)
    doc.save(`reporte_pedidos_${inicio}_${fin}.pdf`)
  }

  return (
    <div>
      <RangoFechas
        inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin}
        onConsultar={consultar} cargando={cargando}
        onDescargarPDF={generarPDF} sinDatos={!datos.length}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {datos.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin datos para el período seleccionado.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Pedidos por fecha</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datos} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" name="Pedidos" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const TabRendimiento = () => {
  const [inicio, setInicio] = useState(haceNDias(30))
  const [fin, setFin] = useState(hoyISO())
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const consultar = async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get(`/reportes/rendimiento?fecha_inicio=${inicio}&fecha_fin=${fin}`)
      setDatos(data.data.map((d) => ({
        ...d,
        fecha: fmtFecha(d.fecha),
        porcentaje_exito: parseFloat(d.porcentaje_exito) || 0,
      })))
    } catch {
      setError('No se pudo obtener el reporte.')
    } finally {
      setCargando(false)
    }
  }

  const generarPDF = () => {
    if (!datos.length) return
    const doc = new jsPDF()
    let y = agregarEncabezadoPDF(doc, 'Rendimiento de entregas', `${inicio} al ${fin}`)

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Entregados', 'Problemas de entrega', '% Éxito']],
      body: datos.map((d) => [
        d.fecha,
        String(d.entregados ?? 0),
        String(d.problemas_entrega ?? 0),
        `${d.porcentaje_exito.toFixed(1)}%`,
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { textColor: VERDE },
        2: { textColor: ROJO },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
    })

    agregarPiePDF(doc)
    doc.save(`reporte_rendimiento_${inicio}_${fin}.pdf`)
  }

  return (
    <div>
      <RangoFechas
        inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin}
        onConsultar={consultar} cargando={cargando}
        onDescargarPDF={generarPDF} sinDatos={!datos.length}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {datos.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin datos para el período seleccionado.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Porcentaje de éxito en entregas</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datos} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Line type="monotone" dataKey="porcentaje_exito" name="Éxito (%)" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="entregados"        name="Entregados"           stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="problemas_entrega" name="Problemas de entrega" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const TabStock = ({ formatosSeleccionados, onCambiarFormato }) => {
  const [inicio, setInicio] = useState(haceNDias(30))
  const [fin, setFin] = useState(hoyISO())
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const consultar = async () => {
    setCargando(true)
    setError('')
    try {
      const { data } = await api.get(`/reportes/stock?fecha_inicio=${inicio}&fecha_fin=${fin}`)
      setDatos(data.data.map((d) => ({ ...d, fecha: fmtFecha(d.fecha) })))
    } catch {
      setError('No se pudo obtener el reporte.')
    } finally {
      setCargando(false)
    }
  }

  const generarPDF = () => {
    if (!datos.length) return
    const doc = new jsPDF()
    let y = agregarEncabezadoPDF(doc, 'Evolución de stock', `${inicio} al ${fin}`)

    const columnasStock = []
    if (formatosSeleccionados['10l']) {
      columnasStock.push(
        { titulo: 'En planta 10 L', campo: 'bidones_planta_10l' },
        { titulo: 'Entregados 10 L', campo: 'bidones_entregados_10l' },
      )
    }
    if (formatosSeleccionados['20l']) {
      columnasStock.push(
        { titulo: 'En planta 20 L', campo: 'bidones_planta_20l' },
        { titulo: 'Entregados 20 L', campo: 'bidones_entregados_20l' },
      )
    }

    autoTable(doc, {
      startY: y,
      head: [['Fecha', ...columnasStock.map((columna) => columna.titulo)]],
      body: datos.map((d) => [
        d.fecha,
        ...columnasStock.map((columna) => String(d[columna.campo] ?? 0)),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { textColor: [37, 99, 235] },
        2: { textColor: VERDE },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
    })

    agregarPiePDF(doc)
    doc.save(`reporte_stock_${inicio}_${fin}.pdf`)
  }

  return (
    <div>
      <RangoFechas
        inicio={inicio} fin={fin} setInicio={setInicio} setFin={setFin}
        onConsultar={consultar} cargando={cargando}
        onDescargarPDF={generarPDF} sinDatos={!datos.length}
      >
        <FiltroFormatos
          formatosSeleccionados={formatosSeleccionados}
          onCambiarFormato={onCambiarFormato}
        />
      </RangoFechas>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      {datos.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin datos para el período seleccionado.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolución de inventario</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={datos} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="gradPlanta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEntregados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPlanta20" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEntregados20" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {formatosSeleccionados['10l'] && (
                <Area type="monotone" dataKey="bidones_planta_10l" name="En planta 10 L" stroke="#2563eb" fill="url(#gradPlanta)" strokeWidth={2} />
              )}
              {formatosSeleccionados['10l'] && (
                <Area type="monotone" dataKey="bidones_entregados_10l" name="Entregados 10 L" stroke="#16a34a" fill="url(#gradEntregados)" strokeWidth={2} />
              )}
              {formatosSeleccionados['20l'] && (
                <Area type="monotone" dataKey="bidones_planta_20l" name="En planta 20 L" stroke="#0891b2" fill="url(#gradPlanta20)" strokeWidth={2} />
              )}
              {formatosSeleccionados['20l'] && (
                <Area type="monotone" dataKey="bidones_entregados_20l" name="Entregados 20 L" stroke="#d97706" fill="url(#gradEntregados20)" strokeWidth={2} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const TabClientes = () => {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/reportes/clientes-frecuentes')
      .then(({ data }) => setDatos(data.data))
      .catch(() => setError('No se pudo obtener el ranking.'))
      .finally(() => setCargando(false))
  }, [])

  const generarPDF = () => {
    if (!datos.length) return
    const doc = new jsPDF()
    const ahora = new Date()
    const fechaGen = ahora.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    let y = agregarEncabezadoPDF(doc, 'Clientes frecuentes', fechaGen)

    autoTable(doc, {
      startY: y,
      head: [['#', 'Nombre', 'Zona', 'Total pedidos']],
      body: datos.map((c, i) => [
        String(i + 1),
        c.nombre,
        c.zona || '—',
        String(c.total_pedidos),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        3: { halign: 'right' },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
    })

    agregarPiePDF(doc)
    doc.save('reporte_clientes_frecuentes.pdf')
  }

  if (cargando) return <p className="text-gray-400 text-sm">Cargando...</p>
  if (error)    return <p className="text-red-500 text-sm">{error}</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={generarPDF} disabled={!datos.length}
          className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40">
          Descargar PDF
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Zona</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total pedidos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {datos.map((c, i) => (
              <tr key={c.id_cliente} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-yellow-400 text-white' :
                    i === 1 ? 'bg-gray-300 text-white' :
                    i === 2 ? 'bg-orange-400 text-white' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{c.zona || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{c.total_pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {datos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 clientes por pedidos</h3>
          <ResponsiveContainer width="100%" height={datos.length * 36 + 40}>
            <BarChart data={[...datos].reverse()} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={120} />
              <Tooltip />
              <Bar dataKey="total_pedidos" name="Pedidos" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const Reportes = () => {
  const [tabActivo, setTabActivo] = useState('diario')
  const [formatosSeleccionados, setFormatosSeleccionados] = useState({ '10l': true, '20l': true })

  const cambiarFormato = (formato) => {
    setFormatosSeleccionados((actuales) => {
      const otroFormato = formato === '10l' ? '20l' : '10l'
      if (actuales[formato] && !actuales[otroFormato]) return actuales
      return { ...actuales, [formato]: !actuales[formato] }
    })
  }

  const contenido = {
    diario:      <TabDiario formatosSeleccionados={formatosSeleccionados} onCambiarFormato={cambiarFormato} />,
    pedidos:     <TabPedidos />,
    rendimiento: <TabRendimiento />,
    stock:       <TabStock formatosSeleccionados={formatosSeleccionados} onCambiarFormato={cambiarFormato} />,
    clientes:    <TabClientes />,
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reportes</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabActivo(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              tabActivo === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {contenido[tabActivo]}
    </div>
  )
}

export default Reportes
