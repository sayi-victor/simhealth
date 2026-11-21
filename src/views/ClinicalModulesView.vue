<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

interface Bed {
  id: number
  ward_id: number
  bed_number: string
  status: string
}

interface Ward {
  id: number
  code: string
  name: string
  category: string
  daily_rate: string
  beds: Bed[]
}

interface Admission {
  id: number
  admission_number: string
  patient_id: number
  admission_type: string
  status: string
  admitted_at: string
  admission_diagnosis: string | null
  patient: { id: number; mrn: string; full_name: string } | null
  ward: { id: number; name: string } | null
  bed: { id: number; bed_number: string } | null
}

interface Surgery {
  id: number
  surgery_number: string
  patient_id: number
  procedure_name: string
  theater_room: string | null
  priority: string
  status: string
  scheduled_at: string
  consent_signed: boolean
  patient: { id: number; mrn: string; full_name: string } | null
  surgeon: { id: number; full_name: string } | null
}

interface Immunization {
  id: number
  patient_id: number
  vaccine_name: string
  dose_number: number | null
  route: string | null
  site: string | null
  lot_number: string | null
  administered_at: string
  next_due_date: string | null
  patient: { id: number; mrn: string; full_name: string } | null
  administered_by: string | null
}

const auth = useAuthStore()

const activeTab = ref<'inpatient' | 'surgery' | 'vaccination'>('inpatient')
const wards = ref<Ward[]>([])
const admissions = ref<Admission[]>([])
const surgeries = ref<Surgery[]>([])
const immunizations = ref<Immunization[]>([])
const patients = ref<PatientSummary[]>([])
const saving = ref(false)
const error = ref('')

const admitForm = reactive({
  patient_id: '',
  bed_id: '',
  admission_type: 'elective',
  admission_diagnosis: '',
})

const surgeryForm = reactive({
  patient_id: '',
  procedure_name: '',
  theater_room: 'OR-1',
  priority: 'elective',
  scheduled_at: new Date().toISOString().slice(0, 16),
  anesthesia_type: 'general',
  consent_signed: false,
  pre_op_diagnosis: '',
})

const immForm = reactive({
  patient_id: '',
  vaccine_name: '',
  dose_number: 1,
  route: 'im',
  site: 'left_deltoid',
  lot_number: '',
  next_due_date: '',
})

const availableBeds = computed(() =>
  wards.value.flatMap((w) =>
    w.beds
      .filter((b) => b.status === 'available')
      .map((b) => ({ ...b, wardName: w.name })),
  ),
)

async function fetchAll() {
  error.value = ''
  try {
    const [wRes, aRes, sRes, iRes, pRes] = await Promise.all([
      apiRequest<{ data: Ward[] }>('/wards'),
      apiRequest<PaginatedResponse<Admission>>('/admissions'),
      apiRequest<PaginatedResponse<Surgery>>('/surgeries'),
      apiRequest<PaginatedResponse<Immunization>>('/immunizations'),
      apiRequest<PaginatedResponse<PatientSummary>>('/patients?per_page=100'),
    ])
    wards.value = wRes.data
    admissions.value = aRes.data
    surgeries.value = sRes.data
    immunizations.value = iRes.data
    patients.value = pRes.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load clinical modules.'
  }
}

async function handleAdmit() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/admissions', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(admitForm.patient_id),
        bed_id: Number(admitForm.bed_id),
        admission_type: admitForm.admission_type,
        admission_diagnosis: admitForm.admission_diagnosis.trim() || null,
      }),
    })
    admitForm.patient_id = ''
    admitForm.bed_id = ''
    admitForm.admission_diagnosis = ''
    await fetchAll()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Admission failed.'
  } finally {
    saving.value = false
  }
}

async function handleDischarge(adm: Admission) {
  const summary = window.prompt(`Discharge summary for ${adm.admission_number}:`, 'Stable for home discharge')
  if (summary === null) return
  error.value = ''
  try {
    await apiRequest(`/admissions/${adm.id}/discharge`, {
      method: 'POST',
      body: JSON.stringify({ discharge_summary: summary, discharge_disposition: 'home' }),
    })
    await fetchAll()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Discharge failed.'
  }
}

async function handleScheduleSurgery() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/surgeries', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(surgeryForm.patient_id),
        procedure_name: surgeryForm.procedure_name.trim(),
        theater_room: surgeryForm.theater_room.trim() || null,
        priority: surgeryForm.priority,
        scheduled_at: surgeryForm.scheduled_at.replace('T', ' ') + ':00',
        anesthesia_type: surgeryForm.anesthesia_type,
        consent_signed: surgeryForm.consent_signed,
        pre_op_diagnosis: surgeryForm.pre_op_diagnosis.trim() || null,
      }),
    })
    surgeryForm.procedure_name = ''
    surgeryForm.pre_op_diagnosis = ''
    surgeryForm.consent_signed = false
    await fetchAll()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to schedule surgery.'
  } finally {
    saving.value = false
  }
}

async function handleCompleteSurgery(s: Surgery) {
  const notes = window.prompt(`Operative notes for ${s.surgery_number}:`, 'Completed without complications.')
  if (notes === null) return
  error.value = ''
  try {
    await apiRequest(`/surgeries/${s.id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ operative_notes: notes }),
    })
    await fetchAll()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to complete surgery.'
  }
}

async function handleRecordImmunization() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/immunizations', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(immForm.patient_id),
        vaccine_name: immForm.vaccine_name.trim(),
        dose_number: Number(immForm.dose_number) || null,
        route: immForm.route,
        site: immForm.site.trim() || null,
        lot_number: immForm.lot_number.trim() || null,
        next_due_date: immForm.next_due_date || null,
      }),
    })
    immForm.vaccine_name = ''
    immForm.lot_number = ''
    immForm.next_due_date = ''
    await fetchAll()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to record immunization.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchAll)
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Inpatient, Surgery &amp; Vaccination</h1>
        <p class="muted">Ward bed management, theater scheduling, and immunization registry</p>
      </div>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <div class="tabs mt-1">
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'inpatient' }" @click="activeTab = 'inpatient'">
        Inpatient &amp; Beds ({{ admissions.length }})
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'surgery' }" @click="activeTab = 'surgery'">
        Surgery ({{ surgeries.length }})
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'vaccination' }" @click="activeTab = 'vaccination'">
        Vaccination ({{ immunizations.length }})
      </button>
    </div>

    <!-- Inpatient Tab -->
    <template v-if="activeTab === 'inpatient'">
      <div class="card-grid mt-1">
        <article v-for="w in wards" :key="w.id" class="card">
          <h3>{{ w.name }} ({{ w.code }})</h3>
          <p class="card-value">
            {{ w.beds.filter((b) => b.status === 'available').length }} / {{ w.beds.length }} available
          </p>
          <p class="muted">Rate: {{ w.daily_rate }}/day</p>
        </article>
      </div>

      <form v-if="auth.can('encounters.create')" class="card form-stack mt-1" @submit.prevent="handleAdmit">
        <h2 class="section-title">Admit Patient</h2>
        <div class="form-grid">
          <label class="field">
            <span>Patient *</span>
            <select v-model="admitForm.patient_id" required>
              <option value="">Select patient...</option>
              <option v-for="p in patients" :key="p.id" :value="String(p.id)">{{ p.full_name }} ({{ p.mrn }})</option>
            </select>
          </label>
          <label class="field">
            <span>Available Bed *</span>
            <select v-model="admitForm.bed_id" required>
              <option value="">Select bed...</option>
              <option v-for="b in availableBeds" :key="b.id" :value="String(b.id)">
                {{ b.wardName }} — {{ b.bed_number }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Type</span>
            <select v-model="admitForm.admission_type">
              <option value="elective">Elective</option>
              <option value="emergency">Emergency</option>
              <option value="maternity">Maternity</option>
              <option value="observation">Observation</option>
            </select>
          </label>
          <label class="field"><span>Diagnosis</span><input v-model="admitForm.admission_diagnosis" type="text" /></label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Admit Patient</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Admission #</th>
              <th>Patient</th>
              <th>Ward / Bed</th>
              <th>Diagnosis</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!admissions.length"><td colspan="6" class="muted center">No admissions recorded.</td></tr>
            <tr v-for="adm in admissions" :key="adm.id">
              <td><strong>{{ adm.admission_number }}</strong></td>
              <td>{{ adm.patient?.full_name || `#${adm.patient_id}` }}</td>
              <td>{{ adm.ward?.name }} · {{ adm.bed?.bed_number || '—' }}</td>
              <td>{{ adm.admission_diagnosis || '—' }}</td>
              <td><span class="badge capitalize">{{ adm.status }}</span></td>
              <td>
                <button
                  v-if="auth.can('encounters.update') && adm.status === 'admitted'"
                  type="button"
                  class="btn-primary"
                  @click="handleDischarge(adm)"
                >
                  Discharge
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Surgery Tab -->
    <template v-else-if="activeTab === 'surgery'">
      <form v-if="auth.can('encounters.create')" class="card form-stack mt-1" @submit.prevent="handleScheduleSurgery">
        <h2 class="section-title">Schedule Surgery</h2>
        <div class="form-grid">
          <label class="field">
            <span>Patient *</span>
            <select v-model="surgeryForm.patient_id" required>
              <option value="">Select patient...</option>
              <option v-for="p in patients" :key="p.id" :value="String(p.id)">{{ p.full_name }} ({{ p.mrn }})</option>
            </select>
          </label>
          <label class="field"><span>Procedure *</span><input v-model="surgeryForm.procedure_name" type="text" required /></label>
          <label class="field"><span>Theater Room</span><input v-model="surgeryForm.theater_room" type="text" /></label>
          <label class="field"><span>Scheduled At *</span><input v-model="surgeryForm.scheduled_at" type="datetime-local" required /></label>
          <label class="field"><span>Pre-op Diagnosis</span><input v-model="surgeryForm.pre_op_diagnosis" type="text" /></label>
          <label class="checkbox-inline">
            <input v-model="surgeryForm.consent_signed" type="checkbox" />
            <span>Surgical consent signed</span>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Schedule</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Surgery #</th>
              <th>Patient</th>
              <th>Procedure</th>
              <th>Theater / Scheduled</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!surgeries.length"><td colspan="6" class="muted center">No surgeries scheduled.</td></tr>
            <tr v-for="s in surgeries" :key="s.id">
              <td><strong>{{ s.surgery_number }}</strong></td>
              <td>{{ s.patient?.full_name || `#${s.patient_id}` }}</td>
              <td>{{ s.procedure_name }}</td>
              <td>{{ s.theater_room || '—' }} · {{ s.scheduled_at.slice(0, 16).replace('T', ' ') }}</td>
              <td><span class="badge capitalize">{{ s.status.replace('_', ' ') }}</span></td>
              <td>
                <button
                  v-if="auth.can('encounters.update') && s.status !== 'completed'"
                  type="button"
                  class="btn-primary"
                  @click="handleCompleteSurgery(s)"
                >
                  Complete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Vaccination Tab -->
    <template v-else>
      <form v-if="auth.can('encounters.create')" class="card form-stack mt-1" @submit.prevent="handleRecordImmunization">
        <h2 class="section-title">Record Vaccination</h2>
        <div class="form-grid">
          <label class="field">
            <span>Patient *</span>
            <select v-model="immForm.patient_id" required>
              <option value="">Select patient...</option>
              <option v-for="p in patients" :key="p.id" :value="String(p.id)">{{ p.full_name }} ({{ p.mrn }})</option>
            </select>
          </label>
          <label class="field"><span>Vaccine Name *</span><input v-model="immForm.vaccine_name" type="text" required placeholder="e.g. Hepatitis B" /></label>
          <label class="field"><span>Dose #</span><input v-model.number="immForm.dose_number" type="number" min="1" max="10" /></label>
          <label class="field">
            <span>Route</span>
            <select v-model="immForm.route">
              <option value="im">IM</option>
              <option value="sc">SC</option>
              <option value="oral">Oral</option>
              <option value="intradermal">Intradermal</option>
            </select>
          </label>
          <label class="field"><span>Lot Number</span><input v-model="immForm.lot_number" type="text" /></label>
          <label class="field"><span>Next Due Date</span><input v-model="immForm.next_due_date" type="date" /></label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Record Dose</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              <th>Vaccine</th>
              <th>Dose / Route</th>
              <th>Lot #</th>
              <th>Next Due</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!immunizations.length"><td colspan="6" class="muted center">No vaccinations recorded.</td></tr>
            <tr v-for="im in immunizations" :key="im.id">
              <td>{{ im.administered_at.slice(0, 10) }}</td>
              <td>{{ im.patient?.full_name || `#${im.patient_id}` }}</td>
              <td><strong>{{ im.vaccine_name }}</strong></td>
              <td>Dose {{ im.dose_number ?? '—' }} · {{ (im.route || '—').toUpperCase() }}</td>
              <td>{{ im.lot_number || '—' }}</td>
              <td>{{ im.next_due_date || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </AppLayout>
</template>
