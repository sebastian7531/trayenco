import jsPDF from 'jspdf'
import logo from '../assets/logo_trayenco.jpg'

const AZUL = [12, 74, 153]

export const crearDocumentoPDF = (titulo, subtitulo) => {
  const doc = new jsPDF()
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
  doc.text(subtitulo, margen, y)
  y += 6

  doc.setDrawColor(AZUL[0], AZUL[1], AZUL[2])
  doc.setLineWidth(0.4)
  doc.line(margen, y, paginaAncho - margen, y)
  y += 8

  return { doc, y }
}

export const agregarPiePDF = (doc) => {
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
