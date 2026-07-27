export const cantidadCargaValida = (valor) => {
  const cantidad = Number(valor)
  return Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 100
}

export const construirLineasCarga = (fila, bidones) =>
  bidones
    .map(bidon => ({
      cod_bidon: Number(bidon.cod_bidon),
      cantidad: Number(fila.cantidades?.[bidon.cod_bidon]),
    }))
    .filter(linea =>
      Number.isInteger(linea.cod_bidon) &&
      linea.cod_bidon > 0 &&
      cantidadCargaValida(linea.cantidad)
    )

export const construirPedidosCarga = (filas, bidones) =>
  filas
    .map(fila => ({
      nombre: fila.nombre,
      payload: {
        id_cliente: Number(fila.id_cliente),
        prioridad: fila.urgente ? 'urgente' : 'normal',
        lineas: construirLineasCarga(fila, bidones),
      },
    }))
    .filter(pedido => pedido.payload.lineas.length > 0)
