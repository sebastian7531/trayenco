const numeroStock = (valor) => Number(valor) || 0

export const calcularSaldosStock = (stock) => {
  const bidonesPlanta = numeroStock(stock?.bidones_planta)
  const bidonesCargados = numeroStock(stock?.bidones_cargados)
  const bidonesEntregados = numeroStock(stock?.bidones_entregados)
  const bidonesRetornados = numeroStock(stock?.bidones_retornados)

  return {
    plantaDisponible: bidonesPlanta - bidonesCargados + bidonesRetornados,
    enRuta: bidonesCargados - bidonesEntregados - bidonesRetornados,
  }
}

export const fechaHoySantiago = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha)
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]))
  return `${valores.year}-${valores.month}-${valores.day}`
}

export const desplazarFechaISO = (fechaISO, dias) => {
  const [year, month, day] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(year, month - 1, day + dias))
  const yearFinal = fecha.getUTCFullYear()
  const monthFinal = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const dayFinal = String(fecha.getUTCDate()).padStart(2, '0')
  return `${yearFinal}-${monthFinal}-${dayFinal}`
}
