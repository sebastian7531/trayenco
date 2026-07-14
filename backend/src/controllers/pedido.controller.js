const service = require('../services/pedido.service');
const { success, error } = require('../utils/response');

const getPedidos = async (req, res) => {
  try {
    return success(res, await service.getPedidos());
  } catch (err) {
    return error(res, err.message);
  }
};

const getPedidoById = async (req, res) => {
  try {
    const data = await service.getPedidoById(req.params.id);
    if (!data) return error(res, 'Pedido no encontrado', 404);
    return success(res, data);
  } catch (err) {
    return error(res, err.message);
  }
};

const createPedido = async (req, res) => {
  try {
    const { id_cliente, lineas } = req.body;

    if (!id_cliente) return error(res, 'Debe seleccionar un cliente', 400);
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return error(res, 'Debe agregar al menos una línea de bidón', 400);
    }
    for (const linea of lineas) {
      if (!linea.cod_bidon) return error(res, 'Cada línea debe tener un tipo de bidón', 400);
      const cantidadNum = Number(linea.cantidad);
      if (!Number.isInteger(cantidadNum) || cantidadNum < 1 || cantidadNum > 100) {
        return error(res, 'La cantidad de cada línea debe ser un entero entre 1 y 100', 400);
      }
    }

    const data = await service.createPedido(req.body);
    const io = req.app.get('io');
    io.to('repartidores').emit('pedido_creado', data);
    io.to('administradores').emit('pedido_creado', data);
    return success(res, data, 'Pedido creado', 201);
  } catch (err) {
    const status = err.message === 'Cliente no encontrado' ? 404 : 500;
    return error(res, err.message, status);
  }
};

const updatePedido = async (req, res) => {
  try {
    const { lineas, prioridad } = req.body;

    if (Array.isArray(lineas)) {
      for (const linea of lineas) {
        if (!linea.cod_bidon) return error(res, 'Cada línea debe tener un tipo de bidón', 400);
        const cantidadNum = Number(linea.cantidad);
        if (!Number.isInteger(cantidadNum) || cantidadNum < 1 || cantidadNum > 100) {
          return error(res, 'La cantidad de cada línea debe ser un entero entre 1 y 100', 400);
        }
      }
    }

    const data = await service.updatePedido(req.params.id, req.body);
    if (!data) return error(res, 'Pedido no encontrado', 404);
    if (prioridad !== undefined) {
      const io = req.app.get('io');
      io.to('repartidores').emit('ruta_actualizada', data);
      io.to('administradores').emit('ruta_actualizada', data);
    }
    return success(res, data, 'Pedido actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

const cambiarEstado = async (req, res) => {
  try {
    const { estado, cantidad_entregada, motivo, observacion } = req.body;
    if (estado === 'problema_entrega' && (!motivo || !motivo.trim())) {
      return error(res, 'Debe indicar un motivo cuando hay problema de entrega', 400);
    }
    if (req.user.rol === 'repartidor') {
      const rutaInfo = await service.getPedidoRutaRepartidor(req.params.id);
      if (!rutaInfo || rutaInfo.id_repartidor !== req.user.id) {
        return error(res, 'Solo puedes cambiar el estado de pedidos de tu propia ruta', 403);
      }
    }
    const id_repartidor = req.user?.id || null;
    const data = await service.cambiarEstado(req.params.id, estado, cantidad_entregada || 0, motivo || null, observacion || null, id_repartidor);
    const io = req.app.get('io');
    io.to('repartidores').emit('pedido_actualizado', data);
    io.to('administradores').emit('pedido_actualizado', data);
    if (data.estado === 'entregado' || data.estado === 'problema_entrega') {
      io.to('administradores').emit('entrega_confirmada', data);
    }
    return success(res, data, 'Estado actualizado');
  } catch (err) {
    const status = err.message.includes('no encontrado') ? 404
      : err.message.includes('inválida') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const deletePedido = async (req, res) => {
  try {
    await service.deletePedido(req.params.id);
    return success(res, null, 'Pedido eliminado');
  } catch (err) {
    const status = err.message.includes('no encontrado') ? 404
      : err.message.includes('Solo se pueden') ? 400
      : err.message.includes('ya está asignado') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const getPedidosPendientesPorZonas = async (req, res) => {
  try {
    const zonasParam = req.query.zonas;
    if (!zonasParam) {
      return success(res, await service.getPedidosPendientes());
    }
    const cod_zonas = zonasParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
    if (cod_zonas.length === 0) return error(res, 'Las zonas indicadas no son válidas', 400);
    return success(res, await service.getPedidosPendientesPorZonas(cod_zonas));
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getPedidos, getPedidoById, createPedido, updatePedido, cambiarEstado, deletePedido, getPedidosPendientesPorZonas };
