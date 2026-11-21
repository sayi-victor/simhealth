import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiRequest, getAuthToken, setAuthToken } from '../lib/api'

export interface FacilitySummary {
  id: number
  name: string
  code: string | null
}

export interface AuthUser {
  id: number
  username: string
  email: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  title: string | null
  department: string | null
  is_provider: boolean
  is_active: boolean
  facility: FacilitySummary | null
  roles: string[]
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getAuthToken())
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  function can(permission: string): boolean {
    if (!user.value) return false
    if (user.value.roles.includes('admin')) return true
    return user.value.permissions.includes(permission)
  }

  function hasRole(role: string): boolean {
    return Boolean(user.value?.roles.includes(role))
  }

  async function fetchMe(): Promise<void> {
    if (!token.value) {
      user.value = null
      initialized.value = true
      return
    }

    try {
      const res = await apiRequest<{ data: AuthUser }>('/me')
      user.value = res.data
    } catch {
      token.value = null
      user.value = null
      setAuthToken(null)
    } finally {
      initialized.value = true
    }
  }

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    try {
      const res = await apiRequest<{ data: { token: string; user: AuthUser } }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
      )
      token.value = res.data.token
      user.value = res.data.user
      setAuthToken(res.data.token)
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) {
        await apiRequest('/auth/logout', { method: 'POST' })
      }
    } catch {
      // Ignore network/token errors on logout
    } finally {
      token.value = null
      user.value = null
      setAuthToken(null)
    }
  }

  return {
    token,
    user,
    initialized,
    loading,
    isAuthenticated,
    can,
    hasRole,
    fetchMe,
    login,
    logout,
  }
})
