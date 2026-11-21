<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

const router = useRouter()
const auth = useAuthStore()

const patients = ref<PatientSummary[]>([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const sex = ref('')
const archived = ref(false)
const sort = ref('created_at')
const direction = ref<'asc' | 'desc'>('desc')
const page = ref(1)
const meta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 })

async function fetchPatients() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    params.set('sort', sort.value)
    params.set('direction', direction.value)
    if (search.value.trim()) params.set('search', search.value.trim())
    if (sex.value) params.set('sex', sex.value)
    if (archived.value) params.set('archived', 'true')

    const res = await apiRequest<PaginatedResponse<PatientSummary>>(
      `/patients?${params.toString()}`,
    )
    patients.value = res.data
    meta.value = res.meta
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load patients.'
  } finally {
    loading.value = false
  }
}

function toggleSort(column: string) {
  if (sort.value === column) {
    direction.value = direction.value === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = column
    direction.value = 'asc'
  }
  page.value = 1
  fetchPatients()
}

function handleSearch() {
  page.value = 1
  fetchPatients()
}

async function handleRestore(patientId: number) {
  try {
    await apiRequest(`/patients/${patientId}/restore`, { method: 'POST' })
    await fetchPatients()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to restore patient.'
  }
}

watch([sex, archived], () => {
  page.value = 1
  fetchPatients()
})

onMounted(fetchPatients)
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Patients</h1>
        <p class="muted">{{ meta.total }} {{ archived ? 'archived' : 'active' }} patients</p>
      </div>
      <RouterLink
        v-if="auth.can('patients.create')"
        to="/patients/new"
        class="btn-primary link-btn"
      >
        + Register Patient
      </RouterLink>
    </section>

    <section class="card toolbar">
      <form class="toolbar-form" @submit.prevent="handleSearch">
        <input
          v-model="search"
          type="search"
          class="input"
          placeholder="Search by name, MRN, phone, or national ID..."
        />
        <select v-model="sex" class="input select-sm">
          <option value="">All sexes</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
          <option value="unknown">Unknown</option>
        </select>
        <label class="checkbox-inline">
          <input v-model="archived" type="checkbox" />
          <span>Archived</span>
        </label>
        <button type="submit" class="btn-primary">Search</button>
      </form>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <section class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" @click="toggleSort('mrn')">
              MRN {{ sort === 'mrn' ? (direction === 'asc' ? '↑' : '↓') : '' }}
            </th>
            <th class="sortable" @click="toggleSort('name')">
              Patient Name {{ sort === 'name' ? (direction === 'asc' ? '↑' : '↓') : '' }}
            </th>
            <th class="sortable" @click="toggleSort('date_of_birth')">
              DOB {{ sort === 'date_of_birth' ? (direction === 'asc' ? '↑' : '↓') : '' }}
            </th>
            <th>Sex</th>
            <th>Phone</th>
            <th>City</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="muted center">Loading patients...</td>
          </tr>
          <tr v-else-if="patients.length === 0">
            <td colspan="7" class="muted center">No patients found.</td>
          </tr>
          <tr
            v-for="patient in patients"
            :key="patient.id"
            class="clickable-row"
            @click="!archived && router.push({ name: 'patients.show', params: { id: patient.id } })"
          >
            <td><strong>{{ patient.mrn }}</strong></td>
            <td>
              {{ patient.full_name }}
              <span v-if="patient.clinical_alert" class="badge badge-warn">Alert</span>
            </td>
            <td>{{ patient.date_of_birth || '—' }}</td>
            <td class="capitalize">{{ patient.sex }}</td>
            <td>{{ patient.phone_cell || '—' }}</td>
            <td>{{ patient.city || '—' }}</td>
            <td @click.stop>
              <template v-if="archived">
                <button
                  v-if="auth.can('patients.archive')"
                  type="button"
                  class="btn-ghost"
                  @click="handleRestore(patient.id)"
                >
                  Restore
                </button>
              </template>
              <template v-else>
                <RouterLink
                  :to="{ name: 'patients.show', params: { id: patient.id } }"
                  class="text-link"
                >
                  Open
                </RouterLink>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          type="button"
          class="btn-ghost"
          :disabled="page <= 1"
          @click="page--; fetchPatients()"
        >
          Previous
        </button>
        <span class="muted">Page {{ meta.current_page }} of {{ meta.last_page }}</span>
        <button
          type="button"
          class="btn-ghost"
          :disabled="page >= meta.last_page"
          @click="page++; fetchPatients()"
        >
          Next
        </button>
      </div>
    </section>
  </AppLayout>
</template>
