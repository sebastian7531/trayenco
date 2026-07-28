import { useState, useEffect } from 'react'
import autoTable from 'jspdf-autotable'
import api from '../../services/api'
import { crearDocumentoPDF, agregarPiePDF } from '../../utils/pdfHelper'
import { fechaHoySantiago } from '../../utils/stock'

const FORM_VACIO    = { nombre: '', descripcion: '' }
const ERRORES_VACIO = { nombre: '' }

const validarNombre = (valor) => {
  if (!valor.trim()) return 'El nombre es requerido'
  if (valor.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres'
  if (valor.trim().length > 100) return 'El nombre no puede superar 100 caracteres'
  return ''
}

const hayErrores = (errores) => Object.values(errores).some(Boolean)

const Zonas = () => {
  const [zonas, setZonas]                         = useState([])
  const [loading, setLoading]                     = useState(true)
  const [error, setError]                         = useState('')
  const [mensaje, setMensaje]                     = useState('')
  const [recurrentes, setRecurrentes]             = useState([])
  const [cargandoRecurrentes, setCargandoRecurrentes] = useState(true)

  const [modalAbierto, setModalAbierto]   = useState(false)
  const [zonaEditando, setZonaEditando]   = useState(null)
  const [form, setForm]                   = useState(FORM_VACIO)
  const [errores, setErrores]             = useState(ERRORES_VACIO)
  const [guardando, setGuardando]         = useState(false)
  const [errorModal, setErrorModal]       = useState('')

  const cargarZonas = async () => {
    try {
      setLoading(true)
      setError('')
      const { data } = await api.get('/zonas')
      setZonas(data.data)
    } catch {
      setError('No se pudieron cargar las zonas.')
    } finally {
      setLoading(false)
    }
  }

  const cargarRecurrentes = async () => {
    try {
      setCargandoRecurrentes(true)
      const { data } = await api.get('/zonas/recurrentes')
      setRecurrentes(data.data)
    } catch {
      setRecurrentes([])
    } finally {
      setCargandoRecurrentes(false)
    }
  }

  useEffect(() => {
    cargarZonas()
    cargarRecurrentes()
  }, [])

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const abrirCrear = () => {
    setZonaEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setModalAbierto(true)
  }

  const abrirEditar = (zona) => {
    setZonaEditando(zona)
    setForm({ nombre: zona.nombre, descripcion: zona.descripcion || '' })
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setZonaEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name === 'nombre') {
      setErrores(prev => ({ ...prev, nombre: validarNombre(value) }))
    }
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    const errNombre = validarNombre(form.nombre)
    setErrores({ nombre: errNombre })
    if (errNombre) return

    setGuardando(true)
    setErrorModal('')
    try {
      const payload = { nombre: form.nombre, descripcion: form.descripcion }
      if (zonaEditando) {
        await api.put(`/zonas/${zonaEditando.cod_zona}`, payload)
        mostrarMensaje('Zona actualizada correctamente.')
      } else {
        await api.post('/zonas', payload)
        mostrarMensaje('Zona creada correctamente.')
      }
      cerrarModal()
      cargarZonas()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al guardar la zona.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (zona) => {
    if (!window.confirm(`¿Eliminar la zona "${zona.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/zonas/${zona.cod_zona}`)
      mostrarMensaje('Zona eliminada.')
      cargarZonas()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar la zona.')
    }
  }

  const generarPDFZonas = () => {
    if (!recurrentes.length) return
    const hoyISO = fechaHoySantiago()
    const fechaLegible = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    const { doc, y } = crearDocumentoPDF(
      'Reporte de zonas más recurrentes',
      `Últimos 30 días — ${fechaLegible}`
    )

    autoTable(doc, {
      startY: y,
      head: [['Zona', 'Cantidad de pedidos']],
      body: recurrentes.map((z) => [z.nombre, String(z.total_pedidos)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [12, 74, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
    })

    agregarPiePDF(doc)
    doc.save(`reporte_zonas_recurrentes_${hoyISO}.pdf`)
  }

  const inputClase = (campo) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errores[campo] ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Zonas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{zonas.length} zonas registradas</p>
        </div>
        <button
          onClick={abrirCrear}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Nueva zona
        </button>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            Cargando zonas...
          </div>
        ) : zonas.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            No hay zonas registradas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Clientes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zonas.map((z) => (
                <tr key={z.cod_zona} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{z.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{z.descripcion || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{z.total_clientes ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEditar(z)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(z)}
                        className="text-red-500 hover:text-red-700 font-medium transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Zonas más recurrentes (últimos 30 días)</h2>
            <p className="text-sm text-gray-500 mt-0.5">Ordenadas por cantidad de pedidos</p>
          </div>
          <button
            onClick={generarPDFZonas}
            disabled={!recurrentes.length}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40"
          >
            Descargar PDF
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          {cargandoRecurrentes ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>
          ) : recurrentes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay datos de pedidos en los últimos 30 días.</p>
          ) : (() => {
            const maximo = recurrentes[0]?.total_pedidos || 1
            return (
              <div className="space-y-3">
                {recurrentes.map((z) => (
                  <div key={z.cod_zona} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 w-32 flex-shrink-0 truncate">
                      {z.nombre}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${z.total_pedidos === 0 ? 0 : Math.max((z.total_pedidos / maximo) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 w-10 text-right flex-shrink-0">
                      {z.total_pedidos}
                    </span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {zonaEditando ? 'Editar zona' : 'Nueva zona'}
              </h2>
            </div>

            <form onSubmit={handleGuardar} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  className={inputClase('nombre')}
                />
                {errores.nombre && <p className="text-red-500 text-xs mt-1">{errores.nombre}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
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
    </div>
  )
}

export default Zonas
