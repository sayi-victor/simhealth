<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

interface Invoice {
  id: number
  invoice_number: string
  patient_id: number
  status: string
  subtotal: string
  discount_amount: string
  total_amount: string
  paid_amount: string
  balance_due: string
  issued_at: string | null
  patient: { id: number; mrn: string; full_name: string } | null
}

interface Claim {
  id: number
  claim_number: string
  invoice_id: number
  patient_id: number
  payer_name: string
  policy_number: string | null
  status: string
  claimed_amount: string
  approved_amount: string | null
  paid_amount: string
  submitted_at: string | null
  patient: { id: number; mrn: string; full_name: string } | null
  invoice: { id: number; invoice_number: string; total_amount: string; balance_due: string; status: string } | null
}

const auth = useAuthStore()

const activeTab = ref<'invoices' | 'claims'>('invoices')
const invoices = ref<Invoice[]>([])
const claims = ref<Claim[]>([])
const patients = ref<PatientSummary[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showNewInvoice = ref(false)

const search = ref('')
const statusFilter = ref('')

const invoiceForm = reactive({
  patient_id: '',
  discount_amount: '0',
  category: 'consultation',
  description: '',
  quantity: 1,
  unit_price: '',
})

async function fetchInvoices() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (statusFilter.value) params.set('status', statusFilter.value)
    const res = await apiRequest<PaginatedResponse<Invoice>>(`/invoices?${params.toString()}`)
    invoices.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load invoices.'
  } finally {
    loading.value = false
  }
}

async function fetchClaims() {
  try {
    const res = await apiRequest<PaginatedResponse<Claim>>('/claims')
    claims.value = res.data
  } catch {
    // Non-fatal
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

async function handleCreateInvoice() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(invoiceForm.patient_id),
        discount_amount: Number(invoiceForm.discount_amount) || 0,
        items: [
          {
            category: invoiceForm.category,
            description: invoiceForm.description.trim(),
            quantity: Number(invoiceForm.quantity),
            unit_price: Number(invoiceForm.unit_price),
          },
        ],
      }),
    })
    showNewInvoice.value = false
    invoiceForm.description = ''
    invoiceForm.unit_price = ''
    await fetchInvoices()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to create invoice.'
  } finally {
    saving.value = false
  }
}

async function handleRecordPayment(inv: Invoice) {
  const input = window.prompt(
    `Record payment for ${inv.invoice_number} (Balance due: ${inv.balance_due}):`,
    inv.balance_due,
  )
  if (!input) return
  const amount = Number(input)
  if (Number.isNaN(amount) || amount <= 0) return

  error.value = ''
  try {
    await apiRequest(`/invoices/${inv.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({
        payer_type: 'patient',
        payment_method: 'cash',
        amount,
      }),
    })
    await fetchInvoices()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to record payment.'
  }
}

async function handleSubmitClaim(inv: Invoice) {
  const payer = window.prompt(`Insurance payer name for ${inv.invoice_number}:`, 'NHIS')
  if (!payer) return
  error.value = ''
  try {
    await apiRequest('/claims', {
      method: 'POST',
      body: JSON.stringify({
        invoice_id: inv.id,
        payer_name: payer.trim(),
        claimed_amount: Number(inv.balance_due),
        submit_now: true,
      }),
    })
    await fetchClaims()
    activeTab.value = 'claims'
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to submit claim.'
  }
}

async function handleSettleClaim(claim: Claim) {
  const input = window.prompt(
    `Approved & paid remittance for ${claim.claim_number} (Claimed: ${claim.claimed_amount}):`,
    claim.claimed_amount,
  )
  if (!input) return
  const paid = Number(input)
  if (Number.isNaN(paid) || paid < 0) return

  error.value = ''
  try {
    await apiRequest(`/claims/${claim.id}/adjudicate`, {
      method: 'POST',
      body: JSON.stringify({
        status: 'paid',
        approved_amount: paid,
        paid_amount: paid,
        post_payment: true,
      }),
    })
    await Promise.all([fetchClaims(), fetchInvoices()])
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to adjudicate claim.'
  }
}

watch(statusFilter, fetchInvoices)

onMounted(async () => {
  await Promise.all([fetchInvoices(), fetchClaims(), fetchPatients()])
})
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Billing &amp; Claims</h1>
        <p class="muted">Patient charges, receipts, and insurance claims adjudication</p>
      </div>
      <button
        v-if="auth.can('billing.manage')"
        type="button"
        class="btn-primary"
        @click="showNewInvoice = !showNewInvoice"
      >
        {{ showNewInvoice ? 'Close' : '+ New Invoice' }}
      </button>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <div class="tabs mt-1">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'invoices' }"
        @click="activeTab = 'invoices'"
      >
        Invoices ({{ invoices.length }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'claims' }"
        @click="activeTab = 'claims'"
      >
        Insurance Claims ({{ claims.length }})
      </button>
    </div>

    <form v-if="showNewInvoice" class="card form-stack mt-1" @submit.prevent="handleCreateInvoice">
      <h2 class="section-title">Create Patient Invoice</h2>
      <div class="form-grid">
        <label class="field">
          <span>Patient *</span>
          <select v-model="invoiceForm.patient_id" required>
            <option value="">Select patient...</option>
            <option v-for="p in patients" :key="p.id" :value="String(p.id)">
              {{ p.full_name }} ({{ p.mrn }})
            </option>
          </select>
        </label>
        <label class="field">
          <span>Charge Category</span>
          <select v-model="invoiceForm.category">
            <option value="consultation">Consultation</option>
            <option value="laboratory">Laboratory</option>
            <option value="imaging">Imaging</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="procedure">Procedure</option>
          </select>
        </label>
        <label class="field"><span>Description *</span><input v-model="invoiceForm.description" type="text" required /></label>
        <label class="field"><span>Qty *</span><input v-model.number="invoiceForm.quantity" type="number" min="1" required /></label>
        <label class="field"><span>Unit Price *</span><input v-model="invoiceForm.unit_price" type="number" step="0.01" min="0" required /></label>
        <label class="field"><span>Discount</span><input v-model="invoiceForm.discount_amount" type="number" step="0.01" min="0" /></label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">Issue Invoice</button>
      </div>
    </form>

    <!-- Invoices Tab -->
    <template v-if="activeTab === 'invoices'">
      <section class="card toolbar mt-1">
        <form class="toolbar-form" @submit.prevent="fetchInvoices">
          <input v-model="search" type="search" class="input" placeholder="Search invoice #, patient name, or MRN..." />
          <select v-model="statusFilter" class="input select-sm">
            <option value="">All statuses</option>
            <option value="issued">Issued</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
          <button type="submit" class="btn-primary">Filter</button>
        </form>
      </section>

      <section class="card mt-1 table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Patient</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="muted center">Loading invoices...</td>
            </tr>
            <tr v-else-if="invoices.length === 0">
              <td colspan="7" class="muted center">No invoices found.</td>
            </tr>
            <tr v-for="inv in invoices" :key="inv.id">
              <td><strong>{{ inv.invoice_number }}</strong></td>
              <td>
                {{ inv.patient?.full_name || `#${inv.patient_id}` }}
                <div v-if="inv.patient" class="muted">{{ inv.patient.mrn }}</div>
              </td>
              <td>{{ inv.total_amount }}</td>
              <td>{{ inv.paid_amount }}</td>
              <td><strong>{{ inv.balance_due }}</strong></td>
              <td><span class="badge capitalize">{{ inv.status.replace('_', ' ') }}</span></td>
              <td>
                <div class="header-actions">
                  <button
                    v-if="auth.can('billing.manage') && Number(inv.balance_due) > 0 && inv.status !== 'void'"
                    type="button"
                    class="btn-primary"
                    @click="handleRecordPayment(inv)"
                  >
                    Pay
                  </button>
                  <button
                    v-if="auth.can('claims.manage') && Number(inv.balance_due) > 0 && inv.status !== 'void'"
                    type="button"
                    class="btn-ghost"
                    @click="handleSubmitClaim(inv)"
                  >
                    Claim
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- Claims Tab -->
    <section v-else class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Claim #</th>
            <th>Invoice</th>
            <th>Patient</th>
            <th>Payer</th>
            <th>Claimed</th>
            <th>Paid</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="claims.length === 0">
            <td colspan="8" class="muted center">No insurance claims submitted.</td>
          </tr>
          <tr v-for="c in claims" :key="c.id">
            <td><strong>{{ c.claim_number }}</strong></td>
            <td>{{ c.invoice?.invoice_number || `#${c.invoice_id}` }}</td>
            <td>{{ c.patient?.full_name || `#${c.patient_id}` }}</td>
            <td>{{ c.payer_name }}</td>
            <td>{{ c.claimed_amount }}</td>
            <td>{{ c.paid_amount }}</td>
            <td><span class="badge capitalize">{{ c.status.replace('_', ' ') }}</span></td>
            <td>
              <button
                v-if="auth.can('claims.manage') && c.status !== 'paid'"
                type="button"
                class="btn-primary"
                @click="handleSettleClaim(c)"
              >
                Post Remittance
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
