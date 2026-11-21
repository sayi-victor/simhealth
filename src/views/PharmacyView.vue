<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PaginatedResponse, PatientSummary } from '../types/patient'
import type { Drug, Prescription } from '../types/pharmacy'

const auth = useAuthStore()

const activeTab = ref<'prescriptions' | 'formulary'>('prescriptions')
const prescriptions = ref<Prescription[]>([])
const drugs = ref<Drug[]>([])
const patients = ref<PatientSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const rxSearch = ref('')
const rxStatus = ref('')
const drugSearch = ref('')
const showRxForm = ref(false)
const showDrugForm = ref(false)
const receiveLotDrug = ref<Drug | null>(null)

const rxForm = reactive({
  patient_id: '',
  drug_id: '',
  drug_name: '',
  dosage: '',
  frequency: 'TID',
  duration_days: 7,
  quantity_prescribed: 21,
  indication: '',
  instructions: '',
})

const drugForm = reactive({
  code: '',
  name: '',
  generic_name: '',
  form: 'tablet',
  strength: '',
  route: 'oral',
  unit: 'tablet',
  unit_price: '1.00',
  reorder_level: 20,
})

const lotForm = reactive({
  lot_number: '',
  quantity_on_hand: 100,
  unit_cost: '',
  expires_at: '',
})

async function fetchPrescriptions() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (rxSearch.value.trim()) params.set('search', rxSearch.value.trim())
    if (rxStatus.value) params.set('status', rxStatus.value)
    const res = await apiRequest<PaginatedResponse<Prescription>>(`/prescriptions?${params.toString()}`)
    prescriptions.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load prescriptions.'
  } finally {
    loading.value = false
  }
}

async function fetchDrugs() {
  try {
    const params = new URLSearchParams()
    if (drugSearch.value.trim()) params.set('search', drugSearch.value.trim())
    const res = await apiRequest<PaginatedResponse<Drug>>(`/drugs?${params.toString()}`)
    drugs.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load formulary.'
  }
}

async function fetchPatients() {
  try {
    const res = await apiRequest<PaginatedResponse<PatientSummary>>('/patients?per_page=100')
    patients.value = res.data
  } catch {
    // Non-fatal
  }
}

async function handleCreateRx() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/prescriptions', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(rxForm.patient_id),
        drug_id: rxForm.drug_id ? Number(rxForm.drug_id) : null,
        drug_name: rxForm.drug_id ? null : rxForm.drug_name.trim(),
        dosage: rxForm.dosage.trim(),
        frequency: rxForm.frequency.trim(),
        duration_days: Number(rxForm.duration_days) || null,
        quantity_prescribed: Number(rxForm.quantity_prescribed),
        indication: rxForm.indication.trim() || null,
        instructions: rxForm.instructions.trim() || null,
      }),
    })
    showRxForm.value = false
    rxForm.drug_id = ''
    rxForm.drug_name = ''
    rxForm.dosage = ''
    rxForm.indication = ''
    rxForm.instructions = ''
    await fetchPrescriptions()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to create prescription.'
  } finally {
    saving.value = false
  }
}

async function handleDispense(rx: Prescription) {
  const input = window.prompt(
    `Dispense ${rx.drug_name} for ${rx.patient?.full_name || 'patient'} (remaining: ${rx.quantity_remaining}):`,
    String(rx.quantity_remaining),
  )
  if (!input) return
  const qty = Number(input)
  if (!Number.isInteger(qty) || qty <= 0) return

  error.value = ''
  try {
    await apiRequest(`/prescriptions/${rx.id}/dispense`, {
      method: 'POST',
      body: JSON.stringify({ quantity: qty }),
    })
    await Promise.all([fetchPrescriptions(), fetchDrugs()])
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Dispensing failed.'
  }
}

async function handleCancelRx(rx: Prescription) {
  if (!window.confirm(`Cancel prescription ${rx.prescription_number}?`)) return
  error.value = ''
  try {
    await apiRequest(`/prescriptions/${rx.id}/cancel`, { method: 'POST' })
    await fetchPrescriptions()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to cancel prescription.'
  }
}

async function handleCreateDrug() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/drugs', {
      method: 'POST',
      body: JSON.stringify({
        code: drugForm.code.trim(),
        name: drugForm.name.trim(),
        generic_name: drugForm.generic_name.trim() || null,
        form: drugForm.form,
        strength: drugForm.strength.trim() || null,
        route: drugForm.route,
        unit: drugForm.unit.trim() || 'tablet',
        unit_price: Number(drugForm.unit_price),
        reorder_level: Number(drugForm.reorder_level),
      }),
    })
    showDrugForm.value = false
    drugForm.code = ''
    drugForm.name = ''
    drugForm.generic_name = ''
    drugForm.strength = ''
    await fetchDrugs()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to add drug.'
  } finally {
    saving.value = false
  }
}

async function handleReceiveLot() {
  if (!receiveLotDrug.value) return
  saving.value = true
  error.value = ''
  try {
    await apiRequest(`/drugs/${receiveLotDrug.value.id}/lots`, {
      method: 'POST',
      body: JSON.stringify({
        lot_number: lotForm.lot_number.trim(),
        quantity_on_hand: Number(lotForm.quantity_on_hand),
        unit_cost: lotForm.unit_cost ? Number(lotForm.unit_cost) : null,
        expires_at: lotForm.expires_at || null,
      }),
    })
    receiveLotDrug.value = null
    lotForm.lot_number = ''
    lotForm.quantity_on_hand = 100
    lotForm.unit_cost = ''
    lotForm.expires_at = ''
    await fetchDrugs()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to receive stock lot.'
  } finally {
    saving.value = false
  }
}

watch(rxStatus, fetchPrescriptions)

onMounted(async () => {
  await Promise.all([fetchPrescriptions(), fetchDrugs(), fetchPatients()])
})
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Prescriptions &amp; Pharmacy</h1>
        <p class="muted">Clinical prescribing, FEFO lot dispensing, and drug formulary</p>
      </div>
      <div class="header-actions">
        <button
          v-if="activeTab === 'prescriptions' && auth.can('prescriptions.create')"
          type="button"
          class="btn-primary"
          @click="showRxForm = !showRxForm"
        >
          {{ showRxForm ? 'Close' : '+ New Prescription' }}
        </button>
        <button
          v-if="activeTab === 'formulary' && auth.can('inventory.manage')"
          type="button"
          class="btn-primary"
          @click="showDrugForm = !showDrugForm"
        >
          {{ showDrugForm ? 'Close' : '+ Add Drug' }}
        </button>
      </div>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <div class="tabs mt-1">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'prescriptions' }"
        @click="activeTab = 'prescriptions'"
      >
        Prescriptions ({{ prescriptions.length }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'formulary' }"
        @click="activeTab = 'formulary'"
      >
        Formulary &amp; Stock ({{ drugs.length }})
      </button>
    </div>

    <!-- Prescriptions Tab -->
    <template v-if="activeTab === 'prescriptions'">
      <form v-if="showRxForm" class="card form-stack mt-1" @submit.prevent="handleCreateRx">
        <h2 class="section-title">Write Prescription</h2>
        <div class="form-grid">
          <label class="field">
            <span>Patient *</span>
            <select v-model="rxForm.patient_id" required>
              <option value="">Select patient...</option>
              <option v-for="p in patients" :key="p.id" :value="String(p.id)">
                {{ p.full_name }} ({{ p.mrn }})
              </option>
            </select>
          </label>
          <label class="field">
            <span>Formulary Drug</span>
            <select v-model="rxForm.drug_id">
              <option value="">External / Free-text drug</option>
              <option v-for="d in drugs" :key="d.id" :value="String(d.id)">
                {{ d.name }} ({{ d.total_on_hand ?? 0 }} in stock)
              </option>
            </select>
          </label>
          <label v-if="!rxForm.drug_id" class="field">
            <span>Drug Name *</span>
            <input v-model="rxForm.drug_name" type="text" required />
          </label>
          <label class="field">
            <span>Dosage *</span>
            <input v-model="rxForm.dosage" type="text" placeholder="e.g. 500 mg (1 tab)" required />
          </label>
          <label class="field">
            <span>Frequency *</span>
            <input v-model="rxForm.frequency" type="text" placeholder="TID, BID, OD" required />
          </label>
          <label class="field">
            <span>Duration (days)</span>
            <input v-model.number="rxForm.duration_days" type="number" min="1" />
          </label>
          <label class="field">
            <span>Quantity *</span>
            <input v-model.number="rxForm.quantity_prescribed" type="number" min="1" required />
          </label>
          <label class="field">
            <span>Indication</span>
            <input v-model="rxForm.indication" type="text" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Save Prescription</button>
        </div>
      </form>

      <section class="card toolbar mt-1">
        <form class="toolbar-form" @submit.prevent="fetchPrescriptions">
          <input v-model="rxSearch" type="search" class="input" placeholder="Search RX #, patient, or medication..." />
          <select v-model="rxStatus" class="input select-sm">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="partially_dispensed">Partially dispensed</option>
            <option value="dispensed">Dispensed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button type="submit" class="btn-primary">Filter</button>
        </form>
      </section>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>RX #</th>
              <th>Patient</th>
              <th>Medication &amp; Sig</th>
              <th>Qty (Disp / Rx)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="muted center">Loading prescriptions...</td>
            </tr>
            <tr v-else-if="prescriptions.length === 0">
              <td colspan="6" class="muted center">No prescriptions found.</td>
            </tr>
            <tr v-for="rx in prescriptions" :key="rx.id">
              <td><strong>{{ rx.prescription_number }}</strong></td>
              <td>
                {{ rx.patient?.full_name || `#${rx.patient_id}` }}
                <div v-if="rx.patient" class="muted">{{ rx.patient.mrn }}</div>
              </td>
              <td>
                <strong>{{ rx.drug_name }}</strong>
                <div class="muted">{{ rx.dosage }} · {{ rx.frequency }}</div>
              </td>
              <td>{{ rx.quantity_dispensed }} / {{ rx.quantity_prescribed }}</td>
              <td><span class="badge capitalize">{{ rx.status.replace('_', ' ') }}</span></td>
              <td>
                <div class="header-actions">
                  <button
                    v-if="auth.can('pharmacy.dispense') && rx.drug_id && rx.quantity_remaining > 0 && rx.status !== 'cancelled'"
                    type="button"
                    class="btn-primary"
                    @click="handleDispense(rx)"
                  >
                    Dispense
                  </button>
                  <button
                    v-if="auth.can('prescriptions.create') && rx.status === 'pending'"
                    type="button"
                    class="btn-ghost"
                    @click="handleCancelRx(rx)"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Formulary Tab -->
    <template v-else>
      <form v-if="showDrugForm" class="card form-stack mt-1" @submit.prevent="handleCreateDrug">
        <h2 class="section-title">Add Formulary Medication</h2>
        <div class="form-grid">
          <label class="field"><span>Code *</span><input v-model="drugForm.code" type="text" required placeholder="e.g. AMOX-500" /></label>
          <label class="field"><span>Name *</span><input v-model="drugForm.name" type="text" required /></label>
          <label class="field"><span>Generic Name</span><input v-model="drugForm.generic_name" type="text" /></label>
          <label class="field"><span>Strength</span><input v-model="drugForm.strength" type="text" placeholder="500 mg" /></label>
          <label class="field">
            <span>Form</span>
            <select v-model="drugForm.form">
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="injection">Injection</option>
              <option value="cream">Cream</option>
              <option value="drops">Drops</option>
            </select>
          </label>
          <label class="field"><span>Unit Price *</span><input v-model="drugForm.unit_price" type="number" step="0.01" min="0" required /></label>
          <label class="field"><span>Reorder Level</span><input v-model.number="drugForm.reorder_level" type="number" min="0" /></label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Save Drug</button>
        </div>
      </form>

      <form v-if="receiveLotDrug" class="card form-stack mt-1" @submit.prevent="handleReceiveLot">
        <h2 class="section-title">Receive Stock Lot — {{ receiveLotDrug.name }}</h2>
        <div class="form-grid">
          <label class="field"><span>Lot Number *</span><input v-model="lotForm.lot_number" type="text" required /></label>
          <label class="field"><span>Quantity *</span><input v-model.number="lotForm.quantity_on_hand" type="number" min="1" required /></label>
          <label class="field"><span>Unit Cost</span><input v-model="lotForm.unit_cost" type="number" step="0.01" min="0" /></label>
          <label class="field"><span>Expiry Date</span><input v-model="lotForm.expires_at" type="date" /></label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Receive Stock</button>
          <button type="button" class="btn-ghost" @click="receiveLotDrug = null">Cancel</button>
        </div>
      </form>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Medication</th>
              <th>Form / Strength</th>
              <th>Unit Price</th>
              <th>On Hand</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="drugs.length === 0">
              <td colspan="6" class="muted center">No drugs in formulary yet.</td>
            </tr>
            <tr v-for="drug in drugs" :key="drug.id">
              <td><strong>{{ drug.code }}</strong></td>
              <td>
                {{ drug.name }}
                <div v-if="drug.generic_name" class="muted">{{ drug.generic_name }}</div>
              </td>
              <td class="capitalize">{{ drug.form }} {{ drug.strength || '' }}</td>
              <td>{{ drug.unit_price }}</td>
              <td>
                <strong>{{ drug.total_on_hand ?? 0 }}</strong>
                <span v-if="drug.low_stock" class="badge badge-warn">Low</span>
              </td>
              <td>
                <button
                  v-if="auth.can('inventory.manage')"
                  type="button"
                  class="btn-ghost"
                  @click="receiveLotDrug = drug"
                >
                  + Receive Lot
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </AppLayout>
</template>
