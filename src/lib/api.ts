export interface ApiErrorPayload {
  code: string
  message: string
  details?: Record<string, string[]> | Record<string, unknown> | null
}

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, string[]> | Record<string, unknown> | null

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}

const TOKEN_KEY = 'hms_auth_token';

// Base URL of the API. Defaults to the dev-server proxy path so that
// `npm run dev` works against a local API without any configuration.
// Set VITE_API_BASE_URL (e.g. https://api.example.org/api) for other deployments.
const API_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const errPayload: ApiErrorPayload = body?.error ?? {
      code: 'HTTP_ERROR',
      message: body?.message || `Request failed with status ${response.status}`,
      details: body?.errors ?? null,
    }
    throw new ApiError(response.status, errPayload)
  }

  return body as T
}
