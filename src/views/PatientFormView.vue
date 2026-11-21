<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import type { PatientDetail } from '../types/patient'

const route = useRoute()
const router = useRouter()

const patientId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEdit = computed(() => Boolean(patientId.value))

const saving = ref(false)
const loading = ref(false)
const error = ref('')
const fieldErrors = ref<Record<string, string[]>>({})

const form = reactive({
  mrn: '',
  title: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  sex: 'female',
  marital_status: '',
  nationality: '',
  phone_cell: '',
  phone_home: '',
  email: '',
  national_id: '',
  street: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: '',
  registration_type: 'opd',
  referral_source: '',
  clinical_alert: '',
  billing_note: '',
  // Primary emergency contact
  emergency_name: '',
  emergency_relationship: '',
  emergency_phone: '',
  // Employer
  employer_name: '',
  employer_occupation: '',
  // Primary insurance
  insurance_provider: '',
  insurance_plan: '',
  insurance_policy: '',
  insurance_copay: '',
  // Consents
  allow_sms: true,
  allow_email: false,
  hipaa_notice_received: false,
})

onMounted(async () => {
  if (!isEdit.value || !patientId.value) return
  loading.value = true
  try {
    const res = await apiRequest<{ data: PatientDetail }>(`/patients/${patientId.value}`)
    const p = res.data
    form.mrn = p.mrn
    form.title = p.title || ''
    form.first_name = p.first_name
    form.middle_name = p.middle_name || ''
    form.last_name = p.last_name
    form.date_of_birth = p.date_of_birth || ''
    form.sex = p.sex
    form.marital_status = p.marital_status || ''
    form.nationality = p.nationality || ''
    form.phone_cell = p.phone_cell || ''
    form.phone_home = p.phone_home || ''
    form.email = p.email || ''
    form.national_id = p.national_id || ''
    form.street = p.street || ''
    form.city = p.city || ''
    form.state = p.state || ''
    form.postal_code = p.postal_code || ''
    form.country_code = p.country_code || ''
    form.registration_type = p.registration_type || 'opd'
    form.referral_source = p.referral_source || ''
    form.clinical_alert = p.clinical_alert || ''
    form.billing_note = p.billing_note || ''

    const ec = p.contacts[0]
    if (ec) {
      form.emergency_name = ec.full_name
      form.emergency_relationship = ec.relationship || ''
      form.emergency_phone = ec.phone || ''
    }

    const emp = p.employers.find((e) => e.is_current) || p.employers[0]
    if (emp) {
      form.employer_name = emp.employer_name
      form.employer_occupation = emp.occupation || ''
    }

    const ins = p.insurances.find((i) => i.tier === 'primary') || p.insurances[0]
    if (ins) {
      form.insurance_provider = ins.provider_name
      form.insurance_plan = ins.plan_name || ''
      form.insurance_policy = ins.policy_number || ''
      form.insurance_copay = ins.copay || ''
    }

    if (p.consent) {
      form.allow_sms = p.consent.allow_sms
      form.allow_email = p.consent.allow_email
      form.hipaa_notice_received = p.consent.hipaa_notice_received
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load patient.'
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  saving.value = true
  error.value = ''
  fieldErrors.value = {}

  const payload: Record<string, unknown> = {
    mrn: form.mrn.trim() || null,
    title: form.title.trim() || null,
    first_name: form.first_name.trim(),
    middle_name: form.middle_name.trim() || null,
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    sex: form.sex,
    marital_status: form.marital_status || null,
    nationality: form.nationality.trim() || null,
    phone_cell: form.phone_cell.trim() || null,
    phone_home: form.phone_home.trim() || null,
    email: form.email.trim() || null,
    national_id: form.national_id.trim() || null,
    street: form.street.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country_code: form.country_code.trim() || null,
    registration_type: form.registration_type || null,
    referral_source: form.referral_source.trim() || null,
    clinical_alert: form.clinical_alert.trim() || null,
    billing_note: form.billing_note.trim() || null,
    consent: {
      allow_sms: form.allow_sms,
      allow_email: form.allow_email,
      hipaa_notice_received: form.hipaa_notice_received,
    },
  }

  if (form.emergency_name.trim()) {
    payload.contacts = [
      {
        contact_type: 'emergency',
        full_name: form.emergency_name.trim(),
        relationship: form.emergency_relationship.trim() || null,
        phone: form.emergency_phone.trim() || null,
        is_primary: true,
      },
    ]
  }

  if (form.employer_name.trim()) {
    payload.employer = {
      employer_name: form.employer_name.trim(),
      occupation: form.employer_occupation.trim() || null,
    }
  }

  if (form.insurance_provider.trim()) {
    payload.insurances = [
      {
        tier: 'primary',
        provider_name: form.insurance_provider.trim(),
        plan_name: form.insurance_plan.trim() || null,
        policy_number: form.insurance_policy.trim() || null,
        copay: form.insurance_copay ? Number(form.insurance_copay) : null,
      },
    ]
  }

  try {
    const res = isEdit.value
      ? await apiRequest<{ data: PatientDetail }>(`/patients/${patientId.value}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      : await apiRequest<{ data: PatientDetail }>('/patients', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

    await router.push({ name: 'patients.show', params: { id: res.data.id } })
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message
      if (err.details && typeof err.details === 'object') {
        fieldErrors.value = err.details as Record<string, string[]>
      }
    } else {
      error.value = 'Unable to save patient.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>{{ isEdit ? 'Edit Patient' : 'Register New Patient' }}</h1>
        <p class="muted">
          {{ isEdit ? `Updating MRN ${form.mrn}` : 'Leave MRN blank to auto-generate.' }}
        </p>
      </div>
      <RouterLink to="/patients" class="btn-ghost link-btn">← Back to Patients</RouterLink>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <form v-if="!loading" class="form-stack mt-1" @submit.prevent="handleSubmit">
      <section class="card">
        <h2 class="section-title">Demographics</h2>
        <div class="form-grid">
          <label class="field">
            <span>MRN (External ID)</span>
            <input v-model="form.mrn" type="text" placeholder="Auto-generated if blank" />
            <small v-if="fieldErrors.mrn" class="field-err">{{ fieldErrors.mrn[0] }}</small>
          </label>
          <label class="field">
            <span>Title</span>
            <input v-model="form.title" type="text" placeholder="Mr., Mrs., Ms., Dr." />
          </label>
          <label class="field">
            <span>First Name *</span>
            <input v-model="form.first_name" type="text" required />
            <small v-if="fieldErrors.first_name" class="field-err">{{ fieldErrors.first_name[0] }}</small>
          </label>
          <label class="field">
            <span>Middle Name</span>
            <input v-model="form.middle_name" type="text" />
          </label>
          <label class="field">
            <span>Last Name *</span>
            <input v-model="form.last_name" type="text" required />
            <small v-if="fieldErrors.last_name" class="field-err">{{ fieldErrors.last_name[0] }}</small>
          </label>
          <label class="field">
            <span>Date of Birth</span>
            <input v-model="form.date_of_birth" type="date" />
            <small v-if="fieldErrors.date_of_birth" class="field-err">{{ fieldErrors.date_of_birth[0] }}</small>
          </label>
          <label class="field">
            <span>Sex *</span>
            <select v-model="form.sex" required>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label class="field">
            <span>National ID</span>
            <input v-model="form.national_id" type="text" />
          </label>
          <label class="field">
            <span>Mobile Phone</span>
            <input v-model="form.phone_cell" type="text" />
          </label>
          <label class="field">
            <span>Email</span>
            <input v-model="form.email" type="email" />
          </label>
          <label class="field">
            <span>Street Address</span>
            <input v-model="form.street" type="text" />
          </label>
          <label class="field">
            <span>City</span>
            <input v-model="form.city" type="text" />
          </label>
          <label class="field">
            <span>Clinical Alert</span>
            <input v-model="form.clinical_alert" type="text" placeholder="e.g. Severe allergy" />
          </label>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">Emergency Contact, Employer &amp; Primary Insurance</h2>
        <div class="form-grid">
          <label class="field">
            <span>Emergency Contact Name</span>
            <input v-model="form.emergency_name" type="text" />
          </label>
          <label class="field">
            <span>Relationship</span>
            <input v-model="form.emergency_relationship" type="text" placeholder="Spouse, Parent, Sibling" />
          </label>
          <label class="field">
            <span>Emergency Phone</span>
            <input v-model="form.emergency_phone" type="text" />
          </label>
          <label class="field">
            <span>Employer Name</span>
            <input v-model="form.employer_name" type="text" />
          </label>
          <label class="field">
            <span>Occupation</span>
            <input v-model="form.employer_occupation" type="text" />
          </label>
          <label class="field">
            <span>Insurance Provider</span>
            <input v-model="form.insurance_provider" type="text" placeholder="e.g. NHIS" />
          </label>
          <label class="field">
            <span>Plan Name</span>
            <input v-model="form.insurance_plan" type="text" />
          </label>
          <label class="field">
            <span>Policy Number</span>
            <input v-model="form.insurance_policy" type="text" />
          </label>
          <label class="field">
            <span>Copay</span>
            <input v-model="form.insurance_copay" type="number" step="0.01" min="0" />
          </label>
        </div>
      </section>

      <section class="card">
        <h2 class="section-title">Communication &amp; Privacy Consents</h2>
        <div class="checkbox-row">
          <label class="checkbox-inline">
            <input v-model="form.allow_sms" type="checkbox" />
            <span>Allow SMS reminders</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="form.allow_email" type="checkbox" />
            <span>Allow Email notifications</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="form.hipaa_notice_received" type="checkbox" />
            <span>Privacy notice acknowledged</span>
          </label>
        </div>
      </section>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Patient' }}
        </button>
        <RouterLink to="/patients" class="btn-ghost link-btn">Cancel</RouterLink>
      </div>
    </form>
  </AppLayout>
</template>
