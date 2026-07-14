import { useState, useEffect } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const FORM_CREAR_VACIO  = { nombre: '', email: '', password: '', rol: 'repartidor' }
const FORM_EDITAR_VACIO = { nombre: '', email: '', rol: 'repartidor' }
const FORM_PWD_VACIO    = { password_nuevo: '' }
const ERR_CREAR_VACIO   = { nombre: '', email: '', password: '' }
const ERR_EDITAR_VACIO  = { nombre: '', email: '' }
const ERR_PWD_VACIO     = { password_nuevo: '' }

const ROL_BADGE = {
  administrador: 'bg-blue-100 text-blue-700',
  repartidor:    'bg-gray-100 text-gray-600',
}
const ROL_LABEL = {
  administrador: 'Administrador',
  repartidor:    'Repartidor',
}

const validarNombre = (v) => {
  if (!v.trim()) return 'El nombre es requerido'
  if (v.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres'
  if (v.trim().length > 100) return 'El nombre no puede superar 100 caracteres'
  return ''
}

const validarEmail = (v) => {
  if (!v.trim()) return 'El email es requerido'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'El email no tiene un formato válido'
  return ''
}

const validarPassword = (v) => {
  if (!v) return 'La contraseña es requerida'
  if (v.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
  return ''
}

const hayErrores = (errores) => Object.values(errores).some(Boolean)

const Usuarios = () => {
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [mensaje, setMensaje]   = useState('')

  const [modalTipo, setModalTipo]           = useState(null)
  const [usuarioEditando, setUsuarioEditando] = useState(null)

  const [formCrear, setFormCrear]     = useState(FORM_CREAR_VACIO)
  const [erroresCrear, setErroresCrear] = useState(ERR_CREAR_VACIO)

  const [formEditar, setFormEditar]     = useState(FORM_EDITAR_VACIO)
  const [erroresEditar, setErroresEditar] = useState(ERR_EDITAR_VACIO)

  const [formPwd, setFormPwd]       = useState(FORM_PWD_VACIO)
  const [erroresPwd, setErroresPwd] = useState(ERR_PWD_VACIO)

  const [guardando, setGuardando]   = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const cargarUsuarios = async () => {
    try {
      setLoading(true)
      setError('')
      const { data } = await api.get('/usuarios')
      setUsuarios(data.data)
    } catch {
      setError('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargarUsuarios() }, [])

  const mostrarMensaje = (texto) => {
    setMensaje(texto)
    setTimeout(() => setMensaje(''), 4000)
  }

  const abrirCrear = () => {
    setFormCrear(FORM_CREAR_VACIO)
    setErroresCrear(ERR_CREAR_VACIO)
    setErrorModal('')
    setModalTipo('crear')
  }

  const abrirEditar = (u) => {
    setUsuarioEditando(u)
    setFormEditar({ nombre: u.nombre, email: u.email, rol: u.rol || 'repartidor' })
    setErroresEditar(ERR_EDITAR_VACIO)
    setErrorModal('')
    setModalTipo('editar')
  }

  const abrirPassword = (u) => {
    setUsuarioEditando(u)
    setFormPwd(FORM_PWD_VACIO)
    setErroresPwd(ERR_PWD_VACIO)
    setErrorModal('')
    setModalTipo('password')
  }

  const cerrarModal = () => {
    setModalTipo(null)
    setUsuarioEditando(null)
    setErrorModal('')
  }

  const handleChangeCrear = (e) => {
    const { name, value } = e.target
    setFormCrear((prev) => ({ ...prev, [name]: value }))
    const err =
      name === 'nombre'   ? validarNombre(value) :
      name === 'email'    ? validarEmail(value) :
      name === 'password' ? validarPassword(value) : ''
    if (name !== 'rol') setErroresCrear((prev) => ({ ...prev, [name]: err }))
  }

  const handleChangeEditar = (e) => {
    const { name, value } = e.target
    setFormEditar((prev) => ({ ...prev, [name]: value }))
    const err =
      name === 'nombre' ? validarNombre(value) :
      name === 'email'  ? validarEmail(value) : ''
    if (name !== 'rol') setErroresEditar((prev) => ({ ...prev, [name]: err }))
  }

  const handleChangePwd = (e) => {
    const value = e.target.value
    setFormPwd({ password_nuevo: value })
    setErroresPwd({ password_nuevo: validarPassword(value) })
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    const nuevos = {
      nombre:   validarNombre(formCrear.nombre),
      email:    validarEmail(formCrear.email),
      password: validarPassword(formCrear.password),
    }
    setErroresCrear(nuevos)
    if (hayErrores(nuevos)) return

    setGuardando(true)
    setErrorModal('')
    try {
      await api.post('/usuarios', formCrear)
      mostrarMensaje('Usuario creado correctamente.')
      cerrarModal()
      cargarUsuarios()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al crear el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEditar = async (e) => {
    e.preventDefault()
    const nuevos = {
      nombre: validarNombre(formEditar.nombre),
      email:  validarEmail(formEditar.email),
    }
    setErroresEditar(nuevos)
    if (hayErrores(nuevos)) return

    setGuardando(true)
    setErrorModal('')
    try {
      await api.put(`/usuarios/${usuarioEditando.id_repartidor}`, formEditar)
      mostrarMensaje('Usuario actualizado correctamente.')
      cerrarModal()
      cargarUsuarios()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al actualizar el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  const handleCambiarPassword = async (e) => {
    e.preventDefault()
    const err = validarPassword(formPwd.password_nuevo)
    setErroresPwd({ password_nuevo: err })
    if (err) return

    setGuardando(true)
    setErrorModal('')
    try {
      await api.patch(`/usuarios/${usuarioEditando.id_repartidor}/password`, formPwd)
      mostrarMensaje('Contraseña actualizada correctamente.')
      cerrarModal()
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al actualizar la contraseña.')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminar = async (u) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return
    try {
      await api.delete(`/usuarios/${u.id_repartidor}`)
      mostrarMensaje('Usuario eliminado.')
      cargarUsuarios()
    } catch (err) {
      setError(err.response?.data?.message || 'Error al eliminar el usuario.')
    }
  }

  const inputClase = (err) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      err ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={abrirCrear}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + Nuevo usuario
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
            Cargando usuarios...
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
            No hay usuarios registrados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => {
                const esSelf = u.id_repartidor === user?.id
                return (
                  <tr key={u.id_repartidor} className={`hover:bg-gray-50 transition ${esSelf ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {u.nombre}
                      {esSelf && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">tú</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROL_BADGE[u.rol] || 'bg-gray-100 text-gray-600'}`}>
                        {ROL_LABEL[u.rol] || u.rol || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => abrirPassword(u)}
                          className="text-gray-600 hover:text-gray-800 font-medium transition"
                        >
                          Contraseña
                        </button>
                        <button
                          onClick={() => handleEliminar(u)}
                          disabled={esSelf}
                          className="text-red-500 hover:text-red-700 font-medium transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalTipo === 'crear' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo usuario</h2>
            </div>
            <form onSubmit={handleCrear} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formCrear.nombre}
                  onChange={handleChangeCrear}
                  className={inputClase(erroresCrear.nombre)}
                />
                {erroresCrear.nombre && <p className="text-red-500 text-xs mt-1">{erroresCrear.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formCrear.email}
                  onChange={handleChangeCrear}
                  className={inputClase(erroresCrear.email)}
                />
                {erroresCrear.email && <p className="text-red-500 text-xs mt-1">{erroresCrear.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formCrear.password}
                  onChange={handleChangeCrear}
                  className={inputClase(erroresCrear.password)}
                />
                {erroresCrear.password && <p className="text-red-500 text-xs mt-1">{erroresCrear.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  name="rol"
                  value={formCrear.rol}
                  onChange={handleChangeCrear}
                  className={inputClase('')}
                >
                  <option value="repartidor">Repartidor</option>
                  <option value="administrador">Administrador</option>
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
                  disabled={guardando || hayErrores(erroresCrear)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalTipo === 'editar' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Editar usuario</h2>
              <p className="text-sm text-gray-500 mt-0.5">{usuarioEditando?.nombre}</p>
            </div>
            <form onSubmit={handleEditar} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formEditar.nombre}
                  onChange={handleChangeEditar}
                  className={inputClase(erroresEditar.nombre)}
                />
                {erroresEditar.nombre && <p className="text-red-500 text-xs mt-1">{erroresEditar.nombre}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formEditar.email}
                  onChange={handleChangeEditar}
                  className={inputClase(erroresEditar.email)}
                />
                {erroresEditar.email && <p className="text-red-500 text-xs mt-1">{erroresEditar.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  name="rol"
                  value={formEditar.rol}
                  onChange={handleChangeEditar}
                  className={inputClase('')}
                >
                  <option value="repartidor">Repartidor</option>
                  <option value="administrador">Administrador</option>
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
                  disabled={guardando || hayErrores(erroresEditar)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalTipo === 'password' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Cambiar contraseña</h2>
              <p className="text-sm text-gray-500 mt-0.5">{usuarioEditando?.nombre}</p>
            </div>
            <form onSubmit={handleCambiarPassword} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password_nuevo"
                  value={formPwd.password_nuevo}
                  onChange={handleChangePwd}
                  autoFocus
                  className={inputClase(erroresPwd.password_nuevo)}
                />
                {erroresPwd.password_nuevo && (
                  <p className="text-red-500 text-xs mt-1">{erroresPwd.password_nuevo}</p>
                )}
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
                  disabled={guardando || !!erroresPwd.password_nuevo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Usuarios
