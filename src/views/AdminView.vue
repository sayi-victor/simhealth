<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { AuthUser, FacilitySummary } from '../stores/auth'
import type { PaginatedResponse } from '../types/patient'

interface RoleItem {
  id: number
  slug: string
  name: string
  description: string | null
  permissions: string[]
}

interface AuditLogRow {
  id: number
  event: string
  category: string
  success: boolean
  ip_address: string | null
  metadata: Record<string, unknown> | null
  user: { id: number; username: string; full_name: string } | null
  created_at: string | null
}

const auth = useAuthStore()

const activeTab = ref<'users' | 'facilities' | 'audit'>('users')
const users = ref<AuthUser[]>([])
const roles = ref<RoleItem[]>([])
const facilities = ref<FacilitySummary[]>([])
const auditLogs = ref<AuditLogRow[]>([])
const saving = ref(false)
const error = ref('')

const userForm = reactive({
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'clinician',
  is_provider: true,
})

const facilityForm = reactive({
  code: '',
  name: '',
  city: '',
  phone: '',
})

async function fetchAdminData() {
  error.value = ''
  try {
    const [uRes, rRes, fRes, aRes] = await Promise.all([
      auth.can('users.view') ? apiRequest<PaginatedResponse<AuthUser>>('/admin/users') : Promise.resolve({ data: [] }),
      auth.can('users.view') ? apiRequest<{ data: RoleItem[] }>('/admin/roles') : Promise.resolve({ data: [] }),
      auth.can('facilities.view') ? apiRequest<PaginatedResponse<FacilitySummary>>('/facilities') : Promise.resolve({ data: [] }),
      auth.can('audit.view') ? apiRequest<{ data: AuditLogRow[] }>('/admin/audit-logs') : Promise.resolve({ data: [] }),
    ])
    users.value = uRes.data
    roles.value = rRes.data
    facilities.value = fRes.data
    auditLogs.value = aRes.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load admin data.'
  }
}

async function handleCreateUser() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        username: userForm.username.trim(),
        email: userForm.email.trim() || null,
        password: userForm.password,
        first_name: userForm.first_name.trim(),
        last_name: userForm.last_name.trim(),
        is_provider: userForm.is_provider,
        roles: [userForm.role],
      }),
    })
    userForm.username = ''
    userForm.email = ''
    userForm.password = ''
    userForm.first_name = ''
    userForm.last_name = ''
    await fetchAdminData()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to create user.'
  } finally {
    saving.value = false
  }
}

async function handleToggleUserActive(u: AuthUser) {
  try {
    await apiRequest(`/admin/users/${u.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: !u.is_active }),
    })
    await fetchAdminData()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to update user.'
  }
}

async function handleCreateFacility() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/facilities', {
      method: 'POST',
      body: JSON.stringify({
        code: facilityForm.code.trim() || null,
        name: facilityForm.name.trim(),
        city: facilityForm.city.trim() || null,
        phone: facilityForm.phone.trim() || null,
      }),
    })
    facilityForm.code = ''
    facilityForm.name = ''
    facilityForm.city = ''
    facilityForm.phone = ''
    await fetchAdminData()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to create facility.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchAdminData)
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>System Administration</h1>
        <p class="muted">Staff accounts, clinical RBAC roles, facilities, and R13-safe audit logs</p>
      </div>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <div class="tabs mt-1">
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">
        Users &amp; Roles ({{ users.length }})
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'facilities' }" @click="activeTab = 'facilities'">
        Facilities ({{ facilities.length }})
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'audit' }" @click="activeTab = 'audit'">
        Audit Logs ({{ auditLogs.length }})
      </button>
    </div>

    <!-- Users Tab -->
    <template v-if="activeTab === 'users'">
      <form v-if="auth.can('users.manage')" class="card form-stack mt-1" @submit.prevent="handleCreateUser">
        <h2 class="section-title">Create Staff Account</h2>
        <div class="form-grid">
          <label class="field"><span>Username *</span><input v-model="userForm.username" type="text" required /></label>
          <label class="field"><span>Email</span><input v-model="userForm.email" type="email" /></label>
          <label class="field"><span>Password * (min 8)</span><input v-model="userForm.password" type="password" minlength="8" required /></label>
          <label class="field"><span>First Name *</span><input v-model="userForm.first_name" type="text" required /></label>
          <label class="field"><span>Last Name *</span><input v-model="userForm.last_name" type="text" required /></label>
          <label class="field">
            <span>Role *</span>
            <select v-model="userForm.role" required>
              <option v-for="r in roles" :key="r.id" :value="r.slug">{{ r.name }}</option>
            </select>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Create User</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td><strong>{{ u.username }}</strong></td>
              <td>{{ u.full_name }}</td>
              <td>
                <span v-for="r in u.roles" :key="r" class="badge">{{ r }}</span>
              </td>
              <td>{{ u.is_active ? 'Active' : 'Inactive' }}</td>
              <td>
                <button
                  v-if="auth.can('users.manage')"
                  type="button"
                  class="btn-ghost"
                  @click="handleToggleUserActive(u)"
                >
                  {{ u.is_active ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Facilities Tab -->
    <template v-else-if="activeTab === 'facilities'">
      <form v-if="auth.can('facilities.manage')" class="card form-stack mt-1" @submit.prevent="handleCreateFacility">
        <h2 class="section-title">Add Facility</h2>
        <div class="form-grid">
          <label class="field"><span>Code</span><input v-model="facilityForm.code" type="text" placeholder="MAIN" /></label>
          <label class="field"><span>Facility Name *</span><input v-model="facilityForm.name" type="text" required /></label>
          <label class="field"><span>City</span><input v-model="facilityForm.city" type="text" /></label>
          <label class="field"><span>Phone</span><input v-model="facilityForm.phone" type="text" /></label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Save Facility</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Code</th><th>Name</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in facilities" :key="f.id">
              <td><strong>{{ f.code || '—' }}</strong></td>
              <td>{{ f.name }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Audit Logs Tab -->
    <section v-else class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Event</th>
            <th>Category</th>
            <th>User</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!auditLogs.length"><td colspan="5" class="muted center">No audit logs found.</td></tr>
          <tr v-for="log in auditLogs" :key="log.id">
            <td>{{ log.created_at?.slice(0, 19).replace('T', ' ') }}</td>
            <td><strong>{{ log.event }}</strong></td>
            <td class="capitalize">{{ log.category }}</td>
            <td>{{ log.user?.username || 'system' }}</td>
            <td><span class="badge" :class="{ 'badge-warn': !log.success }">{{ log.success ? 'OK' : 'Failed' }}</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
