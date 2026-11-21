<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { Encounter } from '../types/encounter'
import type { PaginatedResponse } from '../types/patient'

const router = useRouter()
const auth = useAuthStore()

const encounters = ref<Encounter[]>([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const status = ref('')
const visitCategory = ref('')
const page = ref(1)
const meta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 })

async function fetchEncounters() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    params.set('page', String(page.value))
    if (search.value.trim()) params.set('search', search.value.trim())
    if (status.value) params.set('status', status.value)
    if (visitCategory.value) params.set('visit_category', visitCategory.value)

    const res = await apiRequest<PaginatedResponse<Encounter>>(
      `/encounters?${params.toString()}`,
    )
    encounters.value = res.data
    meta.value = res.meta
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load encounters.'
  } finally {
    loading.value = false
  }
}

watch([status, visitCategory], () => {
  page.value = 1
  fetchEncounters()
})

onMounted(fetchEncounters)
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Encounters</h1>
        <p class="muted">{{ meta.total }} clinical visits</p>
      </div>
      <RouterLink
        v-if="auth.can('encounters.create')"
        to="/encounters/new"
        class="btn-primary link-btn"
      >
        + New Encounter
      </RouterLink>
    </section>

    <section class="card toolbar">
      <form class="toolbar-form" @submit.prevent="page = 1; fetchEncounters()">
        <input
          v-model="search"
          type="search"
          class="input"
          placeholder="Search encounter #, patient name, MRN, or reason..."
        />
        <select v-model="visitCategory" class="input select-sm">
          <option value="">All categories</option>
          <option value="outpatient">Outpatient</option>
          <option value="inpatient">Inpatient</option>
          <option value="emergency">Emergency</option>
          <option value="follow_up">Follow-up</option>
          <option value="antenatal">Antenatal</option>
          <option value="surgery">Surgery</option>
        </select>
        <select v-model="status" class="input select-sm">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="signed">Signed</option>
          <option value="closed">Closed</option>
        </select>
        <button type="submit" class="btn-primary">Search</button>
      </form>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <section class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Encounter #</th>
            <th>Patient</th>
            <th>Date</th>
            <th>Category</th>
            <th>Reason</th>
            <th>Provider</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="muted center">Loading encounters...</td>
          </tr>
          <tr v-else-if="encounters.length === 0">
            <td colspan="7" class="muted center">No encounters found.</td>
          </tr>
          <tr
            v-for="enc in encounters"
            :key="enc.id"
            class="clickable-row"
            @click="router.push({ name: 'encounters.show', params: { id: enc.id } })"
          >
            <td><strong>{{ enc.encounter_number }}</strong></td>
            <td>
              {{ enc.patient?.full_name || `#${enc.patient_id}` }}
              <span v-if="enc.patient?.mrn" class="muted"> ({{ enc.patient.mrn }})</span>
            </td>
            <td>{{ enc.encounter_date ? enc.encounter_date.slice(0, 10) : '—' }}</td>
            <td class="capitalize">{{ enc.visit_category.replace('_', ' ') }}</td>
            <td>{{ enc.reason || '—' }}</td>
            <td>{{ enc.provider?.full_name || '—' }}</td>
            <td>
              <span class="badge capitalize">{{ enc.status }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
