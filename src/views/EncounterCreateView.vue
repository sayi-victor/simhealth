<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import type { Encounter } from '../types/encounter'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

const route = useRoute()
const router = useRouter()

const patients = ref<PatientSummary[]>([])
const saving = ref(false)
const error = ref('')

const form = reactive({
  patient_id: route.query.patient_id ? String(route.query.patient_id) : '',
  visit_category: 'outpatient',
  onset_date: '',
  shift: 'day',
  room_number: '',
  reason: '',
  referral_source: '',
  nhis_vcode: '',
})

onMounted(async () => {
  try {
    const res = await apiRequest<PaginatedResponse<PatientSummary>>('/patients?per_page=100')
    patients.value = res.data
  } catch {
    // Non-fatal if user lacks patients.view
  }
})

async function handleSubmit() {
  saving.value = true
  error.value = ''
  try {
    const res = await apiRequest<{ data: Encounter }>('/encounters', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(form.patient_id),
        visit_category: form.visit_category,
        onset_date: form.onset_date || null,
        shift: form.shift || null,
        room_number: form.room_number.trim() || null,
        reason: form.reason.trim(),
        referral_source: form.referral_source.trim() || null,
        nhis_vcode: form.nhis_vcode.trim() || null,
      }),
    })
    await router.push({ name: 'encounters.show', params: { id: res.data.id } })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Unable to create encounter.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>New Clinical Encounter</h1>
        <p class="muted">Start a patient visit to record vitals, SOAP notes, and clinical forms.</p>
      </div>
      <RouterLink to="/encounters" class="btn-ghost link-btn">← Back</RouterLink>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <form class="card form-stack mt-1" @submit.prevent="handleSubmit">
      <div class="form-grid">
        <label class="field">
          <span>Patient *</span>
          <select v-model="form.patient_id" required>
            <option value="">Select patient...</option>
            <option v-for="p in patients" :key="p.id" :value="String(p.id)">
              {{ p.full_name }} ({{ p.mrn }})
            </option>
          </select>
        </label>

        <label class="field">
          <span>Visit Category *</span>
          <select v-model="form.visit_category" required>
            <option value="outpatient">Outpatient (OPD)</option>
            <option value="inpatient">Inpatient (IPD)</option>
            <option value="emergency">Emergency</option>
            <option value="follow_up">Follow-up</option>
            <option value="antenatal">Antenatal</option>
            <option value="surgery">Surgery</option>
            <option value="telehealth">Telehealth</option>
          </select>
        </label>

        <label class="field">
          <span>Onset Date</span>
          <input v-model="form.onset_date" type="date" />
        </label>

        <label class="field">
          <span>Shift</span>
          <select v-model="form.shift">
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </label>

        <label class="field">
          <span>Room / Consulting Bay</span>
          <input v-model="form.room_number" type="text" placeholder="e.g. Room 3" />
        </label>

        <label class="field">
          <span>NHIS Verification Code</span>
          <input v-model="form.nhis_vcode" type="text" />
        </label>
      </div>

      <label class="field">
        <span>Chief Complaint / Reason for Visit *</span>
        <textarea v-model="form.reason" rows="3" class="input" required />
      </label>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Creating...' : 'Create Encounter' }}
        </button>
        <RouterLink to="/encounters" class="btn-ghost link-btn">Cancel</RouterLink>
      </div>
    </form>
  </AppLayout>
</template>
