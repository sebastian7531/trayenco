import { useState, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../../services/api'
import socket, { conectarSocket } from '../../services/socket'
import logo from '../../assets/logo_trayenco.jpg'
import { fechaHoySantiago } from '../../utils/stock'

const hoyISO = fechaHoySantiago

const RESULTADO_BADGE = {
  entregado:        'bg-green-100 text-green-700',
  problema_entrega: 'bg-red-100 text-red-700',
}

const RESULTADO_LABEL = {
  entregado:        'Entregado',
  problema_entrega: 'Problema de entrega',
}

const Tarjeta = ({ label, valor, color }) => (
  <div className={`bg-white rounded-xl border-l-4 ${color} shadow-sm p-5`}>
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-3xl font-bold text-gray-800">{valor ?? '—'}</p>
  </div>
)

const RESUMEN_VACIO = {
  total: 0, entregados: 0, problemas_entrega: 0,
  total_bidones: 0, errores_frecuentes: [],
}

const Registros = () => {
  const [fecha, setFecha]         = useState(hoyISO())
  const [registros, setRegistros] = useState([])
  const [resumen, setResumen]     = useState(RESUMEN_VACIO)
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const [resRegs, resRes] = await Promise.all([
        api.get(`/registros?fecha=${fecha}`),
        api.get(`/registros/resumen?fecha=${fecha}`),
      ])
      setRegistros(resRegs.data.data)
      setResumen(resRes.data.data || RESUMEN_VACIO)
    } catch {
      setError('No se pudieron cargar los registros.')
    } finally {
      setCargando(false)
    }
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    conectarSocket('administrador')
    socket.on('entrega_confirmada', cargar)
    socket.on('pedido_actualizado', cargar)
    return () => {
      socket.off('entrega_confirmada', cargar)
      socket.off('pedido_actualizado', cargar)
    }
  }, [cargar])

  const generarPDF = () => {
    const doc = new jsPDF()
    const margen = 14
    const paginaAncho = doc.internal.pageSize.getWidth()

    const azul      = [12, 74, 153]
    const azulClaro = [214, 234, 248]
    const verde     = [22, 163, 74]
    const rojo      = [220, 38, 38]

    const hoy = fechaHoySantiago()
    const partes = fecha.split('-')
    const fechaObj = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]))
    const fechaLegible = fechaObj.toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const tituloFecha = fecha === hoy ? `Reporte de hoy — ${fechaLegible}` : fechaLegible

    doc.addImage(logo, 'JPEG', margen, 8, 40, 20)

    const textoX = margen + 40 + 6
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(azul[0], azul[1], azul[2])
    doc.text('Trayentome', textoX, 16)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text('Purificamos tu agua, mejoramos tu vida', textoX, 23)

    let y = 35

    doc.setDrawColor(azul[0], azul[1], azul[2])
    doc.setLineWidth(0.8)
    doc.line(margen, y, paginaAncho - margen, y)
    y += 8

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(azul[0], azul[1], azul[2])
    doc.text('Reporte de entregas', margen, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(tituloFecha, margen, y)
    y += 6

    doc.setDrawColor(azul[0], azul[1], azul[2])
    doc.setLineWidth(0.4)
    doc.line(margen, y, paginaAncho - margen, y)
    y += 8

    autoTable(doc, {
      startY: y,
      head: [['Total de entregas', 'Entregados', 'Problemas de entrega', 'Bidones entregados']],
      body: [[
        String(resumen.total ?? 0),
        String(resumen.entregados ?? 0),
        String(resumen.problemas_entrega ?? 0),
        String(resumen.total_bidones ?? 0),
      ]],
      headStyles: {
        fillColor: azulClaro,
        textColor: azul,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 18,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 6,
      },
      columnStyles: {
        0: { textColor: [60, 60, 60] },
        1: { textColor: verde },
        2: { textColor: rojo },
        3: { textColor: azul },
      },
      theme: 'grid',
    })

    y = doc.lastAutoTable.finalY + 12

    if (resumen.errores_frecuentes?.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(rojo[0], rojo[1], rojo[2])
      doc.text('Clientes con problemas de entrega', margen, y)
      y += 5

      autoTable(doc, {
        startY: y,
        head: [['Cliente', 'Incidencias']],
        body: resumen.errores_frecuentes.map(e => [e.cliente_nombre, String(e.incidencias)]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: rojo, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 243, 243] },
        theme: 'striped',
      })

      y = doc.lastAutoTable.finalY + 12
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(azul[0], azul[1], azul[2])
    doc.text('Detalle de registros', margen, y)
    y += 5

    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Repartidor', 'Resultado', 'Motivo', 'Observación']],
      body: registros.map(r => [
        r.cliente_nombre    || '—',
        r.repartidor_nombre || '—',
        RESULTADO_LABEL[r.resultado] || r.resultado,
        r.motivo      || '—',
        r.observacion || '—',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: azul, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const v = registros[data.row.index]?.resultado
          if (v === 'entregado') data.cell.styles.textColor = verde
          else if (v === 'problema_entrega') data.cell.styles.textColor = rojo
        }
      },
    })

    const totalPaginas = doc.internal.getNumberOfPages()
    const ahora = new Date()
    const horaGeneracion = ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    const fechaGeneracion = ahora.toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const textoPie = `Generado el ${fechaGeneracion} a las ${horaGeneracion}`

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

    doc.save(`reporte_entregas_${fecha}.pdf`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Registros de entrega</h1>
          <p className="text-sm text-gray-500 mt-0.5">{registros.length} registro(s) en el día seleccionado</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={generarPDF}
            disabled={registros.length === 0}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40"
          >
            Descargar informe PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          Cargando registros...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <Tarjeta label="Total entregas"        valor={resumen.total}                 color="border-l-blue-500" />
            <Tarjeta label="Entregados"             valor={resumen.entregados}            color="border-l-green-500" />
            <Tarjeta label="Problemas de entrega"  valor={resumen.problemas_entrega}     color="border-l-red-500" />
            <Tarjeta label="Bidones entregados"    valor={resumen.total_bidones}          color="border-l-orange-500" />
          </div>

          <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Clientes con errores frecuentes</h2>
            {resumen.errores_frecuentes?.length === 0 ? (
              <p className="text-sm text-gray-400">Sin clientes con múltiples incidencias en esta fecha.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resumen.errores_frecuentes.map((e, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm text-red-700"
                  >
                    <span className="font-medium">{e.cliente_nombre}</span>
                    <span className="text-xs bg-red-200 text-red-800 rounded-full px-1.5 py-0.5 font-bold">
                      {e.incidencias}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {registros.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
                No hay registros para esta fecha.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Repartidor</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Resultado</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Motivo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Observación</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Bidones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {registros.map(r => (
                      <tr key={r.id_registro} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {r.cliente_nombre || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {r.repartidor_nombre || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RESULTADO_BADGE[r.resultado] || 'bg-gray-100 text-gray-600'}`}>
                            {RESULTADO_LABEL[r.resultado] || r.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{r.motivo || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                          {r.observacion || '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {r.cantidad_entregada ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Registros
