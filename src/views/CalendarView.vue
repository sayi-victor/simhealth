<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { Appointment, AppointmentCategory } from '../types/appointment'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

const router = useRouter()
const auth = useAuthStore()

const appointments = ref<Appointment[]>([])
const categories = ref<AppointmentCategory[]>([])
const patients = ref<PatientSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showBookForm = ref(false)

const today = new Date().toISOString().slice(0, 10)
const dateFrom = ref(today)
const dateTo = ref('')
const statusFilter = ref('')
const search = ref('')

const bookForm = reactive({
  patient_id: '',
  category_id: '',
  date: today,
  time: '09:00',
  duration_minutes: 30,
  room: '',
  reason: '',
})

async function fetchCalendar() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (dateFrom.value) params.set('date_from', dateFrom.value)
    if (dateTo.value) params.set('date_to', dateTo.value)
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (search.value.trim()) params.set('search', search.value.trim())

    const res = await apiRequest<PaginatedResponse<Appointment>>(
      `/appointments?${params.toString()}`,
    )
    appointments.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load appointments.'
  } finally {
    loading.value = false
  }
}

async function fetchMetadata() {
  try {
    const [catRes, patRes] = await Promise.all([
      apiRequest<{ data: AppointmentCategory[] }>('/appointment-categories'),
      apiRequest<PaginatedResponse<PatientSummary>>('/patients?per_page=100'),
    ])
    categories.value = catRes.data
    patients.value = patRes.data
  } catch {
    // Non-fatal
  }
}

function handleCategoryChange() {
  const cat = categories.value.find((c) => String(c.id) === bookForm.category_id)
  if (cat) {
    bookForm.duration_minutes = cat.default_duration_minutes
  }
}

async function handleBook() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(bookForm.patient_id),
        category_id: bookForm.category_id ? Number(bookForm.category_id) : null,
        starts_at: `${bookForm.date} ${bookForm.time}:00`,
        duration_minutes: Number(bookForm.duration_minutes),
        room: bookForm.room.trim() || null,
        reason: bookForm.reason.trim() || null,
      }),
    })
    showBookForm.value = false
    bookForm.patient_id = ''
    bookForm.reason = ''
    bookForm.room = ''
    await fetchCalendar()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to book appointment.'
  } finally {
    saving.value = false
  }
}

async function handleStatus(appt: Appointment, newStatus: string) {
  error.value = ''
  try {
    await apiRequest(`/appointments/${appt.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus }),
    })
    await fetchCalendar()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to update status.'
  }
}

async function handleCheckIn(appt: Appointment, createEncounter: boolean) {
  error.value = ''
  try {
    const res = await apiRequest<{ data: Appointment }>(`/appointments/${appt.id}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ create_encounter: createEncounter }),
    })
    if (createEncounter && res.data.encounter_id) {
      await router.push({ name: 'encounters.show', params: { id: res.data.encounter_id } })
      return
    }
    await fetchCalendar()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to check in patient.'
  }
}

watch([dateFrom, dateTo, statusFilter], fetchCalendar)

onMounted(async () => {
  await Promise.all([fetchMetadata(), fetchCalendar()])
})
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Calendar &amp; Appointments</h1>
        <p class="muted">{{ appointments.length }} scheduled visits in view</p>
      </div>
      <button
        v-if="auth.can('calendar.manage')"
        type="button"
        class="btn-primary"
        @click="showBookForm = !showBookForm"
      >
        {{ showBookForm ? 'Close Booking' : '+ Book Appointment' }}
      </button>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <form v-if="showBookForm" class="card form-stack mt-1" @submit.prevent="handleBook">
      <h2 class="section-title">Book Appointment</h2>
      <div class="form-grid">
        <label class="field">
          <span>Patient *</span>
          <select v-model="bookForm.patient_id" required>
            <option value="">Select patient...</option>
            <option v-for="p in patients" :key="p.id" :value="String(p.id)">
              {{ p.full_name }} ({{ p.mrn }})
            </option>
          </select>
        </label>
        <label class="field">
          <span>Category</span>
          <select v-model="bookForm.category_id" @change="handleCategoryChange">
            <option value="">General</option>
            <option v-for="c in categories" :key="c.id" :value="String(c.id)">
              {{ c.name }} ({{ c.default_duration_minutes }}m)
            </option>
          </select>
        </label>
        <label class="field">
          <span>Date *</span>
          <input v-model="bookForm.date" type="date" required />
        </label>
        <label class="field">
          <span>Start Time *</span>
          <input v-model="bookForm.time" type="time" required />
        </label>
        <label class="field">
          <span>Duration (min)</span>
          <input v-model.number="bookForm.duration_minutes" type="number" min="5" max="480" />
        </label>
        <label class="field">
          <span>Room</span>
          <input v-model="bookForm.room" type="text" placeholder="e.g. Room 1" />
        </label>
      </div>
      <label class="field">
        <span>Reason for Visit</span>
        <input v-model="bookForm.reason" type="text" placeholder="Chief complaint or follow-up reason" />
      </label>
      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Booking...' : 'Confirm Booking' }}
        </button>
      </div>
    </form>

    <section class="card toolbar mt-1">
      <form class="toolbar-form" @submit.prevent="fetchCalendar">
        <input v-model="search" type="search" class="input" placeholder="Search patient, MRN, or reason..." />
        <input v-model="dateFrom" type="date" class="input select-sm" />
        <input v-model="dateTo" type="date" class="input select-sm" />
        <select v-model="statusFilter" class="input select-sm">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="confirmed">Confirmed</option>
          <option value="checked_in">Checked in</option>
          <option value="in_room">In room</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No show</option>
        </select>
        <button type="submit" class="btn-primary">Filter</button>
      </form>
    </section>

    <section class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Patient</th>
            <th>Category</th>
            <th>Provider / Room</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="muted center">Loading schedule...</td>
          </tr>
          <tr v-else-if="appointments.length === 0">
            <td colspan="6" class="muted center">No appointments scheduled for this range.</td>
          </tr>
          <tr v-for="appt in appointments" :key="appt.id">
            <td>
              <strong>{{ appt.starts_at.slice(0, 10) }}</strong>
              <div class="muted">
                {{ appt.starts_at.slice(11, 16) }} ({{ appt.duration_minutes }}m)
              </div>
            </td>
            <td>
              <RouterLink
                v-if="appt.patient"
                :to="{ name: 'patients.show', params: { id: appt.patient.id } }"
                class="text-link"
              >
                {{ appt.patient.full_name }}
              </RouterLink>
              <div v-if="appt.patient" class="muted">{{ appt.patient.mrn }}</div>
            </td>
            <td>
              <span
                class="badge"
                :style="appt.category ? { background: appt.category.color + '20', color: appt.category.color } : undefined"
              >
                {{ appt.category?.name || appt.title || 'Appointment' }}
              </span>
              <div v-if="appt.reason" class="muted">{{ appt.reason }}</div>
            </td>
            <td>
              {{ appt.provider?.full_name || 'Unassigned' }}
              <div v-if="appt.room" class="muted">{{ appt.room }}</div>
            </td>
            <td>
              <span class="badge capitalize">{{ appt.status.replace('_', ' ') }}</span>
            </td>
            <td>
              <div class="header-actions">
                <RouterLink
                  v-if="appt.encounter"
                  :to="{ name: 'encounters.show', params: { id: appt.encounter.id } }"
                  class="text-link"
                >
                  {{ appt.encounter.encounter_number }}
                </RouterLink>
                <template v-if="auth.can('calendar.manage') && !['cancelled', 'completed'].includes(appt.status)">
                  <button
                    v-if="appt.status === 'scheduled'"
                    type="button"
                    class="btn-ghost"
                    @click="handleStatus(appt, 'confirmed')"
                  >
                    Confirm
                  </button>
                  <button
                    v-if="['scheduled', 'confirmed'].includes(appt.status)"
                    type="button"
                    class="btn-primary"
                    @click="handleCheckIn(appt, auth.can('encounters.create'))"
                  >
                    Check In
                  </button>
                  <button
                    type="button"
                    class="btn-ghost"
                    @click="handleStatus(appt, 'cancelled')"
                  >
                    Cancel
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
