const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

const KEYS = {
  access: 'tracklook_access',
  refresh: 'tracklook_refresh',
  username: 'tracklook_username',
}

// ── 토큰 저장/조회/삭제 ──
export function saveTokens(access, refresh, username) {
  localStorage.setItem(KEYS.access, access)
  localStorage.setItem(KEYS.refresh, refresh)
  if (username) localStorage.setItem(KEYS.username, username)
}

export function getAccessToken() {
  return localStorage.getItem(KEYS.access)
}

export function getRefreshToken() {
  return localStorage.getItem(KEYS.refresh)
}

export function getSavedUsername() {
  return localStorage.getItem(KEYS.username)
}

export function clearTokens() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}

// ── 회원가입 ──
export async function register(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.username?.[0] || data.password?.[0] || '회원가입에 실패했어요.')
  return data
}

// ── 로그인 ──
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error('아이디 또는 비밀번호가 올바르지 않아요.')
  saveTokens(data.access, data.refresh, username)
  return data
}

// ── 로그아웃 ──
export async function logout() {
  const refresh = getRefreshToken()
  if (refresh) {
    try {
      await fetch(`${API_BASE}/api/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
    } catch {}
  }
  clearTokens()
}

// ── access 토큰 자동 갱신 ──
// 만료 시 refresh로 새 access 발급, 실패 시 로그아웃 처리 후 null 반환
export async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) return null
  const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) { clearTokens(); return null }
  const data = await res.json()
  localStorage.setItem(KEYS.access, data.access)
  return data.access
}

// ── 인증 헤더 포함 fetch (토큰 만료 시 자동 재발급) ──
export async function authFetch(url, options = {}) {
  let token = getAccessToken()
  const doFetch = (t) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    })

  let res = await doFetch(token)

  // 401이면 토큰 갱신 후 재시도
  if (res.status === 401) {
    token = await refreshAccessToken()
    if (!token) throw new Error('로그인이 필요해요.')
    res = await doFetch(token)
  }

  return res
}