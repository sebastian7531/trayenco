export const formatearHoras = (valor) => {
  const horasDecimales = Number(valor)

  if (!Number.isFinite(horasDecimales) || horasDecimales <= 0) {
    return '0 min'
  }

  const minutosTotales = Math.round(horasDecimales * 60)
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60

  if (horas === 0) return `${minutos} min`
  if (minutos === 0) return `${horas} h`

  return `${horas} h ${minutos} min`
}
