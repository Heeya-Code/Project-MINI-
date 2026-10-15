// Thin fetch wrapper for the TSEC Sync API. The session lives in an HttpOnly cookie set by the
// server, so no token (and no role) is ever kept in JavaScript or localStorage.
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra }
}
const H = { 'X-Requested-With': 'tsec-sync' }

async function parse(res) {
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  if (res.ok) return json
  // A dev-proxy / gateway failure (API not running) comes back as a non-JSON 500/502/503/504.
  if (!json && [500, 502, 503, 504].includes(res.status)) throw new ApiError(0, 'NETWORK', 'The timetable server is not running or cannot be reached. Start it with "npm run server" (or use "npm run dev:all") and try again.')
  const e = json?.error || {}
  throw new ApiError(res.status, e.code || 'HTTP_' + res.status, e.message || (res.status === 401 ? 'Please sign in again.' : `Request failed (${res.status}).`), e)
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch('/api' + path, { method, headers: body === undefined ? H : { ...H, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.')
  }
  return parse(res)
}

// multipart upload with progress (fetch has no upload progress events)
export function upload(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api' + path)
    xhr.setRequestHeader('X-Requested-With', 'tsec-sync')
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'The timetable server is not running or cannot be reached. Start it with "npm run dev:all" (or "npm run server" in a second terminal), then try again.'))
    xhr.onload = () => {
      let json = null
      try { json = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(json)
      if (!json && [0, 500, 502, 503, 504].includes(xhr.status)) return reject(new ApiError(0, 'NETWORK', 'The timetable server is not running or cannot be reached. Start it with "npm run dev:all" (or "npm run server" in a second terminal), then try again.'))
      const e = json?.error || {}
      reject(new ApiError(xhr.status, e.code || 'HTTP_' + xhr.status, e.message || `Upload failed (${xhr.status}).`, e))
    }
    xhr.send(formData)
  })
}

export const fileUrl = (versionId, download = false) => `/api/files/${versionId}${download ? '?download=1' : ''}`
