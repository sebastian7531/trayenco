import { useState, useEffect } from 'react'
import autoTable from 'jspdf-autotable'
import api from '../../services/api'
import { crearDocumentoPDF, agregarPiePDF } from '../../utils/pdfHelper'

const FORM_VACIO    = { nombre: '', telefono: '', direccion: '', cod_zona: '' }
const ERRORES_VACIO = { nombre: '', telefono: '', direccion: '' }

const validarCampo = (name, value) => {
  switch (name) {
    case 'nombre': {
      if (!value.trim()) return 'El nombre es requerido'
      if (value.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres'
      if (value.trim().length > 100) return 'El nombre no puede superar 100 caracteres'
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(value.trim())) return 'El nombre solo puede contener letras'
      return ''
    }
    case 'telefono': {
      if (!value.trim()) return ''
      if (!/^\d+$/.test(value.trim())) return 'El teléfono solo puede contener números'
      if (value.trim().length < 8) return 'El teléfono debe tener al menos 8 dígitos'
      if (value.trim().length > 12) return 'El teléfono no puede superar 12 dígitos'
      return ''
    }
    case 'direccion': {
      if (!value.trim()) return 'La dirección es requerida'
      if (value.trim().length < 5) return 'La dirección debe tener al menos 5 caracteres'
      if (value.trim().length > 200) return 'La dirección no puede superar 200 caracteres'
      return ''
    }
    default: return ''
  }
}

const validarTodo = (form) => ({
  nombre:   validarCampo('nombre',   form.nombre),
  telefono: validarCampo('telefono', form.telefono),
  direccion: validarCampo('direccion', form.direccion),
})

const hayErrores = (errores) => Object.values(errores).some(Boolean)

const Clientes = () => {
  const [clientes, setClientes]             = useState([])
  const [zonas, setZonas]                   = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [mensaje, setMensaje]               = useState('')
  const [problemas, setProblemas]           = useState([])
  const [cargandoProblemas, setCargandoProblemas] = useState(true)

  const [modalAbierto, setModalAbierto]       = useState(false)
  const [clienteEditando, setClienteEditando] = useState(null)
  const [form, setForm]                       = useState(FORM_VACIO)
  const [errores, setErrores]                 = useState(ERRORES_VACIO)
  const [guardando, setGuardando]             = useState(false)
  const [errorModal, setErrorModal]           = useState('')

  const cargarDatos = async () => {
    try {
      setLoading(true)
      setError('')
      const [resClientes, resZonas] = await Promise.all([
        api.get('/clientes'),
        api.get('/zonas'),
      ])
      setClientes(resClientes.data.data)
      setZonas(resZonas.data.data)
    } catch {
      setError('No se pudieron cargar los clientes.')
    } finally {
      setLoading(false)
    }
  }

  const cargarProblemas = async () => {
    try {
      setCargandoProblemas(true)
      const { data } = await api.get('/clientes/problemas-entrega')
      setProblemas(data.data)
    } catch {
      setProblemas([])
    } finally {
      setCargandoProblemas(false)
    }
  }

  useEffect(() => {
    cargarDatos()
    cargarProblemas()
  }, [])

  const nombreZona = (cod_zona) => {
    const zona = zonas.find(z => z.cod_zona === cod_zona)
    return zona ? zona.nombre : '—'
  }

  const abrirCrear = () => {
    setClienteEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setModalAbierto(true)
  }

  const abrirEditar = (cliente) => {
    setClienteEditando(cliente)
    setForm({
      nombre:    cliente.nombre,
      telefono:  cliente.telefono || '',
      direccion: cliente.direccion,
      cod_zona:  cliente.cod_zona ? String(cliente.cod_zona) : '',
    })
    setErrores(ERRORES_VACIO)
    setErrorModal('')
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setClienteEditando(null)
    setForm(FORM_VACIO)
    setErrores(ERRORES_VACIO)
    setErrorModal('')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (name !== 'cod_zona') {
      setErrores(prev => ({ ...prev, [name]: validarCampo(name, value) }))
    }
  }

  const handleGuardar = async (e) => {
    e.preventDefault()
    const nuevosErrores = validarTodo(form)
    setErrores(nuevosErrores)
    if (hayErrores(nuevosErrores)) return

    setGuardando(true)
    setErrorModal('')
    try {
      const payload = {
        nombre:    form.nombre,
        telefono:  form.telefono,
        direccion: form.direccion,
        cod_zona:  form.cod_zona ? Number(form.cod_zona) : null,
      }
      if (clienteEditando) {
        await api.put(`/clientes/${clienteEditando.id_cliente}`, payload)
        mostrarMensaje('Cliente actualizado correctamente.')
      } else {
        await api.post('/clientes', payload)
        mostrarMensaje('Cliente creado. El sistema intentó geocodificar la dirección.')
      }
      cerrarModal()
      cargarDatos()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (cliente) => {
    if (!window.confirm(`¿Eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/clientes/${cliente.id_cliente}`)
      mostrarMensaje('Cliente eliminado.')
      cargarDatos()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar el cliente.')
    }
  }

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const generarPDFProblemas = () => {
    if (!problemas.length) return
    const hoyISO = new Date().toISOString().split('T')[0]
    const fechaLegible = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    const { doc, y } = crearDocumentoPDF(
      'Reporte de clientes con problemas de entrega',
      fechaLegible
    )

    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Zona', 'Incidencias', 'Último motivo']],
      body: problemas.map((p) => [
        p.nombre,
        p.zona_nombre || '—',
        String(p.incidencias),
        p.ultimo_motivo || '—',
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [12, 74, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'center' } },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      theme: 'striped',
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const p = problemas[data.row.index]
          if (p && p.incidencias >= 3) {
            data.cell.styles.textColor = [220, 38, 38]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })

    agregarPiePDF(doc)
    doc.save(`reporte_clientes_problemas_${hoyISO}.pdf`)
  }

  const inputClase = (campo) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errores[campo] ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientes.length} clientes activos</p>
        </div>
        <button
          onClick={abrirCrear}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Nuevo Cliente
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
            Cargando clientes...
          </div>
        ) : clientes.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            No hay clientes registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Dirección</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Zona</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Coordenadas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientes.map(c => (
                <tr key={c.id_cliente} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.direccion}</td>
                  <td className="px-4 py-3 text-gray-600">{nombreZona(c.cod_zona)}</td>
                  <td className="px-4 py-3">
                    {c.latitud && c.longitud ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Con GPS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                        Sin GPS
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="text-blue-600 hover:text-blue-800 font-medium transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(c)}
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
            <h2 className="text-lg font-semibold text-gray-800">Clientes con problemas de entrega</h2>
            <p className="text-sm text-gray-500 mt-0.5">Clientes con entregas con problemas, ordenados por cantidad de incidencias</p>
          </div>
          <button
            onClick={generarPDFProblemas}
            disabled={!problemas.length}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition disabled:opacity-40"
          >
            Descargar PDF
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {cargandoProblemas ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              Cargando...
            </div>
          ) : problemas.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              No hay clientes con problemas de entrega registrados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Zona</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Incidencias</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Último motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {problemas.map((p) => (
                  <tr key={p.id_cliente} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{p.zona_nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                        p.incidencias >= 3 ? 'bg-red-500' : 'bg-amber-400'
                      }`}>
                        {p.incidencias}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.ultimo_motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">
                {clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  name="telefono"
                  value={form.telefono}
                  onChange={handleChange}
                  className={inputClase('telefono')}
                />
                {errores.telefono && <p className="text-red-500 text-xs mt-1">{errores.telefono}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  className={inputClase('direccion')}
                />
                {errores.direccion && <p className="text-red-500 text-xs mt-1">{errores.direccion}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
                <select
                  name="cod_zona"
                  value={form.cod_zona}
                  onChange={handleChange}
                  className={inputClase('cod_zona')}
                >
                  <option value="">Sin zona asignada</option>
                  {zonas.map(z => (
                    <option key={z.cod_zona} value={z.cod_zona}>
                      {z.nombre}
                    </option>
                  ))}
                </select>
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

export default Clientes
