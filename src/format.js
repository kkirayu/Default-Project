import dayjs from 'dayjs'

export function rupiah(n) {
  const value = Math.round((Number(n) || 0) * 100) / 100
  return 'Rp ' + value.toLocaleString('id-ID')
}

export function shortRupiah(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`
  if (Math.abs(v) >= 1_000) return `Rp ${(v / 1_000).toFixed(1)}rb`
  return 'Rp ' + v.toLocaleString('id-ID')
}

export function todayISO() {
  return dayjs().format('YYYY-MM-DD')
}

export function currentMonth() {
  return dayjs().format('YYYY-MM')
}

export function formatDate(iso, opts) {
  return dayjs(iso).format(opts || 'D MMM YYYY')
}

export function monthLabel(month) {
  return dayjs(month + '-01').format('MMMM YYYY')
}
