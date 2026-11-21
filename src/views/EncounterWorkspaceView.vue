<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { Encounter, FormDefinition } from '../types/encounter'

const route = useRoute()
const auth = useAuthStore()

const encounter = ref<Encounter | null>(null)
const formDefinitions = ref<FormDefinition[]>([])
const activeTab = ref<'vitals' | 'notes' | 'forms'>('vitals')
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const vitalForm = reactive({
  bp_systolic: '',
  bp_diastolic: '',
  pulse: '',
  respiration: '',
  temperature: '',
  temp_method: 'oral',
  weight_kg: '',
  height_cm: '',
  oxygen_saturation: '',
  pain_score: '',
  notes: '',
})

const noteForm = reactive({
  note_type: 'soap',
  title: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
  body: '',
})

const selectedFormId = ref<string>('')
const dynamicFormData = reactive<Record<string, string | number | boolean>>({})

const selectedDefinition = computed(() =>
  formDefinitions.value.find((f) => String(f.id) === selectedFormId.value) ?? null,
)

function selectFormDefinition() {
  for (const key of Object.keys(dynamicFormData)) {
    delete dynamicFormData[key]
  }
  if (!selectedDefinition.value) return
  for (const field of selectedDefinition.value.fields) {
    dynamicFormData[field.field_key] = field.field_type === 'checkbox' ? false : (field.default_value ?? '')
  }
}

async function fetchEncounter() {
  loading.value = true
  error.value = ''
  try {
    const [encRes, defsRes] = await Promise.all([
      apiRequest<{ data: Encounter }>(`/encounters/${route.params.id}`),
      apiRequest<{ data: FormDefinition[] }>('/form-definitions'),
    ])
    encounter.value = encRes.data
    formDefinitions.value = defsRes.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load encounter.'
  } finally {
    loading.value = false
  }
}

async function handleSaveVitals() {
  if (!encounter.value) return
  saving.value = true
  error.value = ''
  try {
    await apiRequest(`/encounters/${encounter.value.id}/vitals`, {
      method: 'POST',
      body: JSON.stringify({
        bp_systolic: vitalForm.bp_systolic ? Number(vitalForm.bp_systolic) : null,
        bp_diastolic: vitalForm.bp_diastolic ? Number(vitalForm.bp_diastolic) : null,
        pulse: vitalForm.pulse ? Number(vitalForm.pulse) : null,
        respiration: vitalForm.respiration ? Number(vitalForm.respiration) : null,
        temperature: vitalForm.temperature ? Number(vitalForm.temperature) : null,
        temp_method: vitalForm.temp_method || null,
        weight_kg: vitalForm.weight_kg ? Number(vitalForm.weight_kg) : null,
        height_cm: vitalForm.height_cm ? Number(vitalForm.height_cm) : null,
        oxygen_saturation: vitalForm.oxygen_saturation ? Number(vitalForm.oxygen_saturation) : null,
        pain_score: vitalForm.pain_score !== '' ? Number(vitalForm.pain_score) : null,
        notes: vitalForm.notes.trim() || null,
      }),
    })
    vitalForm.bp_systolic = ''
    vitalForm.bp_diastolic = ''
    vitalForm.pulse = ''
    vitalForm.respiration = ''
    vitalForm.temperature = ''
    vitalForm.weight_kg = ''
    vitalForm.height_cm = ''
    vitalForm.oxygen_saturation = ''
    vitalForm.pain_score = ''
    vitalForm.notes = ''
    await fetchEncounter()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to record vitals.'
  } finally {
    saving.value = false
  }
}

async function handleSaveNote() {
  if (!encounter.value) return
  saving.value = true
  error.value = ''
  try {
    await apiRequest(`/encounters/${encounter.value.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        note_type: noteForm.note_type,
        title: noteForm.title.trim() || null,
        subjective: noteForm.subjective.trim() || null,
        objective: noteForm.objective.trim() || null,
        assessment: noteForm.assessment.trim() || null,
        plan: noteForm.plan.trim() || null,
        body: noteForm.body.trim() || null,
      }),
    })
    noteForm.title = ''
    noteForm.subjective = ''
    noteForm.objective = ''
    noteForm.assessment = ''
    noteForm.plan = ''
    noteForm.body = ''
    await fetchEncounter()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to add clinical note.'
  } finally {
    saving.value = false
  }
}

async function handleSubmitDynamicForm() {
  if (!encounter.value || !selectedDefinition.value) return
  saving.value = true
  error.value = ''
  try {
    await apiRequest(`/encounters/${encounter.value.id}/forms`, {
      method: 'POST',
      body: JSON.stringify({
        form_definition_id: selectedDefinition.value.id,
        data: { ...dynamicFormData },
      }),
    })
    selectedFormId.value = ''
    selectFormDefinition()
    await fetchEncounter()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to submit clinical form.'
  } finally {
    saving.value = false
  }
}

async function handleSignEncounter() {
  if (!encounter.value) return
  if (!window.confirm('Sign and lock this encounter? Signed encounters cannot be edited.')) return
  saving.value = true
  error.value = ''
  try {
    const res = await apiRequest<{ data: Encounter }>(`/encounters/${encounter.value.id}/sign`, {
      method: 'POST',
    })
    encounter.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to sign encounter.'
  } finally {
    saving.value = false
  }
}

onMounted(fetchEncounter)
</script>

<template>
  <AppLayout>
    <div v-if="error" class="alert-error">{{ error }}</div>
    <p v-else-if="loading && !encounter" class="muted">Loading encounter...</p>

    <template v-else-if="encounter">
      <section class="page-header">
        <div>
          <h1>
            {{ encounter.encounter_number }}
            <span class="badge capitalize">{{ encounter.status }}</span>
          </h1>
          <p class="muted">
            Patient:
            <RouterLink
              v-if="encounter.patient"
              :to="{ name: 'patients.show', params: { id: encounter.patient.id } }"
              class="text-link"
            >
              {{ encounter.patient.full_name }} ({{ encounter.patient.mrn }})
            </RouterLink>
            · <span class="capitalize">{{ encounter.visit_category.replace('_', ' ') }}</span>
            · {{ encounter.encounter_date?.slice(0, 10) }}
          </p>
        </div>
        <div class="header-actions">
          <button
            v-if="encounter.status !== 'signed' && auth.can('encounters.sign')"
            type="button"
            class="btn-primary"
            :disabled="saving"
            @click="handleSignEncounter"
          >
            Sign &amp; Lock Encounter
          </button>
          <RouterLink to="/encounters" class="btn-ghost link-btn">← Back</RouterLink>
        </div>
      </section>

      <div v-if="encounter.patient?.clinical_alert" class="alert-error mt-1">
        <strong>Patient Clinical Alert:</strong> {{ encounter.patient.clinical_alert }}
      </div>

      <section class="card mt-1">
        <strong>Chief Complaint:</strong> {{ encounter.reason || '—' }}
        <span class="muted"> · Provider: {{ encounter.provider?.full_name || 'Unassigned' }}</span>
      </section>

      <div class="tabs mt-1">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'vitals' }"
          @click="activeTab = 'vitals'"
        >
          Vitals ({{ encounter.vitals?.length ?? 0 }})
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'notes' }"
          @click="activeTab = 'notes'"
        >
          SOAP &amp; Clinical Notes ({{ encounter.notes?.length ?? 0 }})
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'forms' }"
          @click="activeTab = 'forms'"
        >
          Clinical Forms / LBF ({{ encounter.forms?.length ?? 0 }})
        </button>
      </div>

      <!-- Vitals Tab -->
      <section v-if="activeTab === 'vitals'" class="card mt-1">
        <h2 class="section-title">Record Vitals</h2>
        <form
          v-if="auth.can('encounters.update') && encounter.status !== 'signed'"
          class="form-grid"
          @submit.prevent="handleSaveVitals"
        >
          <label class="field"><span>BP Systolic</span><input v-model="vitalForm.bp_systolic" type="number" placeholder="120" /></label>
          <label class="field"><span>BP Diastolic</span><input v-model="vitalForm.bp_diastolic" type="number" placeholder="80" /></label>
          <label class="field"><span>Pulse (bpm)</span><input v-model="vitalForm.pulse" type="number" placeholder="72" /></label>
          <label class="field"><span>Resp (/min)</span><input v-model="vitalForm.respiration" type="number" placeholder="16" /></label>
          <label class="field"><span>Temp (°C)</span><input v-model="vitalForm.temperature" type="number" step="0.1" placeholder="36.8" /></label>
          <label class="field"><span>SpO2 (%)</span><input v-model="vitalForm.oxygen_saturation" type="number" step="0.1" placeholder="98" /></label>
          <label class="field"><span>Weight (kg)</span><input v-model="vitalForm.weight_kg" type="number" step="0.1" /></label>
          <label class="field"><span>Height (cm)</span><input v-model="vitalForm.height_cm" type="number" step="0.1" /></label>
          <label class="field"><span>Pain (0-10)</span><input v-model="vitalForm.pain_score" type="number" min="0" max="10" /></label>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saving">Save Vitals</button>
          </div>
        </form>

        <table class="data-table mt-1">
          <thead>
            <tr>
              <th>Recorded</th>
              <th>BP</th>
              <th>Pulse</th>
              <th>Temp</th>
              <th>SpO2</th>
              <th>Weight / Height</th>
              <th>BMI</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!encounter.vitals?.length">
              <td colspan="7" class="muted center">No vitals recorded yet.</td>
            </tr>
            <tr v-for="v in encounter.vitals" :key="v.id">
              <td>{{ v.recorded_at?.slice(0, 16).replace('T', ' ') }}</td>
              <td>{{ v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—' }}</td>
              <td>{{ v.pulse ?? '—' }}</td>
              <td>{{ v.temperature ? `${v.temperature} °C` : '—' }}</td>
              <td>{{ v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—' }}</td>
              <td>{{ v.weight_kg || '—' }} kg / {{ v.height_cm || '—' }} cm</td>
              <td>{{ v.bmi ? `${v.bmi} (${v.bmi_status})` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Notes Tab -->
      <section v-if="activeTab === 'notes'" class="card mt-1">
        <h2 class="section-title">Add Clinical / SOAP Note</h2>
        <form
          v-if="auth.can('encounters.update') && encounter.status !== 'signed'"
          class="form-stack"
          @submit.prevent="handleSaveNote"
        >
          <div class="form-grid">
            <label class="field">
              <span>Note Type</span>
              <select v-model="noteForm.note_type">
                <option value="soap">SOAP Note</option>
                <option value="consultation">Consultation</option>
                <option value="nursing">Nursing Note</option>
                <option value="observation">Observation</option>
                <option value="discharge">Discharge Summary</option>
              </select>
            </label>
            <label class="field">
              <span>Title</span>
              <input v-model="noteForm.title" type="text" placeholder="e.g. Follow-up Assessment" />
            </label>
          </div>
          <div class="form-grid">
            <label class="field"><span>Subjective</span><textarea v-model="noteForm.subjective" rows="2" class="input" /></label>
            <label class="field"><span>Objective</span><textarea v-model="noteForm.objective" rows="2" class="input" /></label>
            <label class="field"><span>Assessment</span><textarea v-model="noteForm.assessment" rows="2" class="input" /></label>
            <label class="field"><span>Plan</span><textarea v-model="noteForm.plan" rows="2" class="input" /></label>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saving">Add Note</button>
          </div>
        </form>

        <div class="mt-1 form-stack">
          <p v-if="!encounter.notes?.length" class="muted">No clinical notes yet.</p>
          <article v-for="note in encounter.notes" :key="note.id" class="card">
            <div class="page-header">
              <strong>{{ note.title || note.note_type.toUpperCase() }}</strong>
              <span class="muted">{{ note.author }} · {{ note.created_at?.slice(0, 16).replace('T', ' ') }}</span>
            </div>
            <p v-if="note.subjective" class="list-line"><strong>S:</strong> {{ note.subjective }}</p>
            <p v-if="note.objective" class="list-line"><strong>O:</strong> {{ note.objective }}</p>
            <p v-if="note.assessment" class="list-line"><strong>A:</strong> {{ note.assessment }}</p>
            <p v-if="note.plan" class="list-line"><strong>P:</strong> {{ note.plan }}</p>
            <p v-if="note.body" class="list-line">{{ note.body }}</p>
          </article>
        </div>
      </section>

      <!-- Dynamic LBF Forms Tab -->
      <section v-if="activeTab === 'forms'" class="card mt-1">
        <h2 class="section-title">Dynamic Clinical Forms (LBF Engine)</h2>

        <div v-if="auth.can('encounters.update') && encounter.status !== 'signed'" class="form-stack">
          <label class="field">
            <span>Select Clinical Form</span>
            <select v-model="selectedFormId" @change="selectFormDefinition">
              <option value="">Choose a form template...</option>
              <option v-for="def in formDefinitions" :key="def.id" :value="String(def.id)">
                {{ def.name }} ({{ def.category }})
              </option>
            </select>
          </label>

          <form
            v-if="selectedDefinition"
            class="form-stack"
            @submit.prevent="handleSubmitDynamicForm"
          >
            <div class="form-grid">
              <label
                v-for="field in selectedDefinition.fields"
                :key="field.field_key"
                class="field"
              >
                <span>{{ field.label }} {{ field.is_required ? '*' : '' }}</span>
                <select
                  v-if="field.field_type === 'select'"
                  v-model="dynamicFormData[field.field_key]"
                  :required="field.is_required"
                >
                  <option value="">Select...</option>
                  <option v-for="opt in field.options || []" :key="opt" :value="opt">
                    {{ opt }}
                  </option>
                </select>
                <textarea
                  v-else-if="field.field_type === 'textarea'"
                  v-model="dynamicFormData[field.field_key] as string"
                  rows="2"
                  class="input"
                  :required="field.is_required"
                />
                <input
                  v-else-if="field.field_type === 'number'"
                  v-model.number="dynamicFormData[field.field_key]"
                  type="number"
                  :required="field.is_required"
                />
                <input
                  v-else-if="field.field_type === 'date'"
                  v-model="dynamicFormData[field.field_key]"
                  type="date"
                  :required="field.is_required"
                />
                <input
                  v-else
                  v-model="dynamicFormData[field.field_key]"
                  type="text"
                  :required="field.is_required"
                />
              </label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn-primary" :disabled="saving">
                Submit {{ selectedDefinition.name }}
              </button>
            </div>
          </form>
        </div>

        <div class="mt-1 form-stack">
          <p v-if="!encounter.forms?.length" class="muted">No clinical forms submitted on this encounter.</p>
          <article v-for="f in encounter.forms" :key="f.id" class="card">
            <div class="page-header">
              <strong>{{ f.form_name }}</strong>
              <span class="muted">{{ f.filled_by }} · {{ f.created_at?.slice(0, 16).replace('T', ' ') }}</span>
            </div>
            <dl class="kv-list mt-1">
              <template v-for="(val, key) in f.data" :key="key">
                <dt class="capitalize">{{ String(key).replace(/_/g, ' ') }}</dt>
                <dd>{{ val }}</dd>
              </template>
            </dl>
          </article>
        </div>
      </section>
    </template>
  </AppLayout>
</template>
