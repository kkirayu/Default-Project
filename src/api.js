export async function api(path, { method = 'GET', body, params } = {}) {
  let url = '/api' + path
  if (params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, v)
    }
    const s = q.toString()
    if (s) url += '?' + s
  }
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || 'Terjadi kesalahan')
    err.status = res.status
    throw err
  }
  return data
}
