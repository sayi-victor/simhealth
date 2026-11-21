<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PatientDetail } from '../types/patient'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const patient = ref<PatientDetail | null>(null)
const loading = ref(false)
const error = ref('')

const issueForm = reactive({
  type: 'allergy' as 'medical_problem' | 'allergy' | 'medication' | 'surgery' | 'dental',
  title: '',
  severity: '',
  reaction: '',
})
const addingIssue = ref(false)

async function fetchPatient() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiRequest<{ data: PatientDetail }>(`/patients/${route.params.id}`)
    patient.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load patient.'
  } finally {
    loading.value = false
  }
}

async function handleAddIssue() {
  if (!patient.value || !issueForm.title.trim()) return
  addingIssue.value = true
  try {
    await apiRequest(`/patients/${patient.value.id}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        type: issueForm.type,
        title: issueForm.title.trim(),
        severity: issueForm.severity || null,
        reaction: issueForm.reaction.trim() || null,
      }),
    })
    issueForm.title = ''
    issueForm.severity = ''
    issueForm.reaction = ''
    await fetchPatient()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to add clinical issue.'
  } finally {
    addingIssue.value = false
  }
}

async function handleDeleteIssue(issueId: number) {
  if (!patient.value) return
  try {
    await apiRequest(`/patients/${patient.value.id}/issues/${issueId}`, {
      method: 'DELETE',
    })
    await fetchPatient()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to remove issue.'
  }
}

async function handleArchive() {
  if (!patient.value) return
  if (!window.confirm(`Archive patient ${patient.value.full_name} (${patient.value.mrn})?`)) {
    return
  }
  try {
    await apiRequest(`/patients/${patient.value.id}`, { method: 'DELETE' })
    await router.push({ name: 'patients.index' })
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to archive patient.'
  }
}

onMounted(fetchPatient)
</script>

<template>
  <AppLayout>
    <div v-if="error" class="alert-error">{{ error }}</div>
    <p v-else-if="loading" class="muted">Loading patient summary...</p>

    <template v-else-if="patient">
      <section class="page-header">
        <div>
          <h1>{{ patient.full_name }}</h1>
          <p class="muted">
            MRN: <strong>{{ patient.mrn }}</strong> ·
            DOB: {{ patient.date_of_birth || 'Unknown' }} ·
            <span class="capitalize">{{ patient.sex }}</span>
          </p>
        </div>
        <div class="header-actions">
          <RouterLink
            v-if="auth.can('encounters.create')"
            :to="{ name: 'encounters.create', query: { patient_id: patient.id } }"
            class="btn-primary link-btn"
          >
            + Start Encounter
          </RouterLink>
          <RouterLink
            v-if="auth.can('patients.update')"
            :to="{ name: 'patients.edit', params: { id: patient.id } }"
            class="btn-ghost link-btn"
          >
            Edit Patient
          </RouterLink>
          <button
            v-if="auth.can('patients.archive')"
            type="button"
            class="btn-danger"
            @click="handleArchive"
          >
            Archive
          </button>
          <RouterLink to="/patients" class="btn-ghost link-btn">← Back</RouterLink>
        </div>
      </section>

      <div v-if="patient.clinical_alert" class="alert-error mt-1">
        <strong>Clinical Alert:</strong> {{ patient.clinical_alert }}
      </div>

      <div class="detail-grid mt-1">
        <section class="card">
          <h2 class="section-title">Demographics &amp; Contact</h2>
          <dl class="kv-list">
            <dt>Mobile</dt><dd>{{ patient.phone_cell || '—' }}</dd>
            <dt>Email</dt><dd>{{ patient.email || '—' }}</dd>
            <dt>National ID</dt><dd>{{ patient.national_id || '—' }}</dd>
            <dt>Address</dt><dd>{{ [patient.street, patient.city, patient.state].filter(Boolean).join(', ') || '—' }}</dd>
            <dt>Facility</dt><dd>{{ patient.facility?.name || '—' }}</dd>
            <dt>Registered</dt><dd>{{ patient.registration_date || '—' }}</dd>
          </dl>
        </section>

        <section class="card">
          <h2 class="section-title">Emergency Contacts &amp; Insurance</h2>
          <div v-if="patient.contacts.length">
            <p v-for="c in patient.contacts" :key="c.id" class="list-line">
              <strong>{{ c.full_name }}</strong>
              ({{ c.relationship || c.contact_type }}) — {{ c.phone || 'No phone' }}
            </p>
          </div>
          <p v-else class="muted">No contacts recorded.</p>

          <h3 class="sub-heading">Insurance</h3>
          <div v-if="patient.insurances.length">
            <p v-for="ins in patient.insurances" :key="ins.id" class="list-line">
              <strong class="capitalize">{{ ins.tier }}:</strong>
              {{ ins.provider_name }}
              <span v-if="ins.policy_number">(#{{ ins.policy_number }})</span>
              <span v-if="ins.copay"> · Copay {{ ins.copay }}</span>
            </p>
          </div>
          <p v-else class="muted">Self-pay / no insurance recorded.</p>
        </section>
      </div>

      <section class="card mt-1">
        <h2 class="section-title">Clinical Issues (Allergies, Problems, Medications)</h2>

        <form
          v-if="auth.can('patients.update')"
          class="toolbar-form mt-1"
          @submit.prevent="handleAddIssue"
        >
          <select v-model="issueForm.type" class="input select-sm">
            <option value="allergy">Allergy</option>
            <option value="medical_problem">Medical Problem</option>
            <option value="medication">Medication</option>
            <option value="surgery">Surgery</option>
            <option value="dental">Dental</option>
          </select>
          <input
            v-model="issueForm.title"
            type="text"
            class="input"
            placeholder="Condition, allergy, or medication..."
            required
          />
          <select v-model="issueForm.severity" class="input select-sm">
            <option value="">Severity</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">Life-threatening</option>
          </select>
          <input
            v-model="issueForm.reaction"
            type="text"
            class="input"
            placeholder="Reaction / notes"
          />
          <button type="submit" class="btn-primary" :disabled="addingIssue">
            + Add
          </button>
        </form>

        <table class="data-table mt-1">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Reaction</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="patient.issues.length === 0">
              <td colspan="5" class="muted center">No clinical issues recorded.</td>
            </tr>
            <tr v-for="issue in patient.issues" :key="issue.id">
              <td class="capitalize">{{ issue.type.replace('_', ' ') }}</td>
              <td><strong>{{ issue.title }}</strong></td>
              <td class="capitalize">{{ issue.severity || '—' }}</td>
              <td>{{ issue.reaction || '—' }}</td>
              <td>
                <button
                  v-if="auth.can('patients.update')"
                  type="button"
                  class="btn-ghost"
                  @click="handleDeleteIssue(issue.id)"
                >
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </AppLayout>
</template>
