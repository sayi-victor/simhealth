<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { ClinicalOrder, OrderCatalogItem } from '../types/order'
import type { PaginatedResponse, PatientSummary } from '../types/patient'

const auth = useAuthStore()

const orders = ref<ClinicalOrder[]>([])
const catalog = ref<OrderCatalogItem[]>([])
const patients = ref<PatientSummary[]>([])
const selectedOrder = ref<ClinicalOrder | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showOrderForm = ref(false)

const typeFilter = ref('')
const statusFilter = ref('')
const search = ref('')

const orderForm = reactive({
  patient_id: '',
  order_type: 'laboratory' as 'laboratory' | 'imaging' | 'procedure' | 'service',
  priority: 'routine',
  diagnosis: '',
  selectedCatalogIds: [] as number[],
})

const resultForm = reactive({
  clinical_order_item_id: '',
  value: '',
  units: '',
  reference_range: '',
  abnormal_flag: 'normal',
  findings: '',
  impression: '',
})

const filteredCatalog = computed(() =>
  catalog.value.filter((c) => c.order_type === orderForm.order_type),
)

async function fetchOrders() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (typeFilter.value) params.set('order_type', typeFilter.value)
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (search.value.trim()) params.set('search', search.value.trim())

    const res = await apiRequest<PaginatedResponse<ClinicalOrder>>(`/orders?${params.toString()}`)
    orders.value = res.data
    if (selectedOrder.value) {
      selectedOrder.value = orders.value.find((o) => o.id === selectedOrder.value?.id) ?? null
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load orders.'
  } finally {
    loading.value = false
  }
}

async function fetchMetadata() {
  try {
    const [catRes, patRes] = await Promise.all([
      apiRequest<{ data: OrderCatalogItem[] }>('/order-catalog'),
      apiRequest<PaginatedResponse<PatientSummary>>('/patients?per_page=100'),
    ])
    catalog.value = catRes.data
    patients.value = patRes.data
  } catch {
    // Non-fatal
  }
}

async function handleCreateOrder() {
  if (!orderForm.selectedCatalogIds.length) {
    error.value = 'Select at least one test or procedure.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const res = await apiRequest<{ data: ClinicalOrder }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: Number(orderForm.patient_id),
        order_type: orderForm.order_type,
        priority: orderForm.priority,
        diagnosis: orderForm.diagnosis.trim() || null,
        items: orderForm.selectedCatalogIds.map((id) => ({ catalog_item_id: id })),
      }),
    })
    showOrderForm.value = false
    orderForm.diagnosis = ''
    orderForm.selectedCatalogIds = []
    selectedOrder.value = res.data
    await fetchOrders()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to create order.'
  } finally {
    saving.value = false
  }
}

async function handleCollect(order: ClinicalOrder) {
  error.value = ''
  try {
    const res = await apiRequest<{ data: ClinicalOrder }>(`/orders/${order.id}/collect`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    selectedOrder.value = res.data
    await fetchOrders()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to collect specimen.'
  }
}

async function handlePostResult() {
  if (!selectedOrder.value) return
  saving.value = true
  error.value = ''
  try {
    await apiRequest(`/orders/${selectedOrder.value.id}/results`, {
      method: 'POST',
      body: JSON.stringify({
        clinical_order_item_id: resultForm.clinical_order_item_id
          ? Number(resultForm.clinical_order_item_id)
          : null,
        value: resultForm.value.trim() || null,
        units: resultForm.units.trim() || null,
        reference_range: resultForm.reference_range.trim() || null,
        abnormal_flag: resultForm.abnormal_flag,
        findings: resultForm.findings.trim() || null,
        impression: resultForm.impression.trim() || null,
      }),
    })
    resultForm.clinical_order_item_id = ''
    resultForm.value = ''
    resultForm.units = ''
    resultForm.reference_range = ''
    resultForm.abnormal_flag = 'normal'
    resultForm.findings = ''
    resultForm.impression = ''
    await fetchOrders()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to post result.'
  } finally {
    saving.value = false
  }
}

async function handleReview(order: ClinicalOrder) {
  error.value = ''
  try {
    const res = await apiRequest<{ data: ClinicalOrder }>(`/orders/${order.id}/review`, {
      method: 'POST',
    })
    selectedOrder.value = res.data
    await fetchOrders()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to review order.'
  }
}

watch([typeFilter, statusFilter], fetchOrders)
watch(() => orderForm.order_type, () => {
  orderForm.selectedCatalogIds = []
})

onMounted(async () => {
  await Promise.all([fetchMetadata(), fetchOrders()])
})
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Clinical Orders &amp; Results</h1>
        <p class="muted">Laboratory, diagnostic imaging, and procedure orders</p>
      </div>
      <button
        v-if="auth.can('orders.create')"
        type="button"
        class="btn-primary"
        @click="showOrderForm = !showOrderForm"
      >
        {{ showOrderForm ? 'Close' : '+ Place Order' }}
      </button>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <form v-if="showOrderForm" class="card form-stack mt-1" @submit.prevent="handleCreateOrder">
      <h2 class="section-title">New Clinical Order</h2>
      <div class="form-grid">
        <label class="field">
          <span>Patient *</span>
          <select v-model="orderForm.patient_id" required>
            <option value="">Select patient...</option>
            <option v-for="p in patients" :key="p.id" :value="String(p.id)">
              {{ p.full_name }} ({{ p.mrn }})
            </option>
          </select>
        </label>
        <label class="field">
          <span>Order Type *</span>
          <select v-model="orderForm.order_type">
            <option value="laboratory">Laboratory</option>
            <option value="imaging">Diagnostic Imaging</option>
            <option value="procedure">Procedure</option>
            <option value="service">Service</option>
          </select>
        </label>
        <label class="field">
          <span>Priority</span>
          <select v-model="orderForm.priority">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
        </label>
        <label class="field">
          <span>Diagnosis / Indication</span>
          <input v-model="orderForm.diagnosis" type="text" />
        </label>
      </div>

      <div>
        <p class="field"><span>Select Tests / Studies *</span></p>
        <div class="checkbox-row mt-1">
          <label
            v-for="item in filteredCatalog"
            :key="item.id"
            class="checkbox-inline"
          >
            <input
              v-model="orderForm.selectedCatalogIds"
              type="checkbox"
              :value="item.id"
            />
            <span>{{ item.name }} ({{ item.code }})</span>
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">Submit Order</button>
      </div>
    </form>

    <section class="card toolbar mt-1">
      <form class="toolbar-form" @submit.prevent="fetchOrders">
        <input v-model="search" type="search" class="input" placeholder="Search order #, specimen #, patient..." />
        <select v-model="typeFilter" class="input select-sm">
          <option value="">All types</option>
          <option value="laboratory">Laboratory</option>
          <option value="imaging">Imaging</option>
          <option value="procedure">Procedure</option>
        </select>
        <select v-model="statusFilter" class="input select-sm">
          <option value="">All statuses</option>
          <option value="ordered">Ordered</option>
          <option value="collected">Collected</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="reviewed">Reviewed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button type="submit" class="btn-primary">Filter</button>
      </form>
    </section>

    <section class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Patient</th>
            <th>Type / Priority</th>
            <th>Tests</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="muted center">Loading orders...</td>
          </tr>
          <tr v-else-if="orders.length === 0">
            <td colspan="6" class="muted center">No clinical orders found.</td>
          </tr>
          <tr
            v-for="ord in orders"
            :key="ord.id"
            class="clickable-row"
            @click="selectedOrder = ord"
          >
            <td><strong>{{ ord.order_number }}</strong></td>
            <td>
              {{ ord.patient?.full_name || `#${ord.patient_id}` }}
              <div v-if="ord.patient" class="muted">{{ ord.patient.mrn }}</div>
            </td>
            <td class="capitalize">
              {{ ord.order_type }}
              <span v-if="ord.priority !== 'routine'" class="badge badge-warn">{{ ord.priority }}</span>
            </td>
            <td>{{ ord.items.map((i) => i.item_name).join(', ') }}</td>
            <td><span class="badge capitalize">{{ ord.status.replace('_', ' ') }}</span></td>
            <td @click.stop>
              <button type="button" class="btn-ghost" @click="selectedOrder = ord">Inspect</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Selected Order Results Panel -->
    <section v-if="selectedOrder" class="card mt-1 form-stack">
      <div class="page-header">
        <div>
          <h2 class="section-title">
            {{ selectedOrder.order_number }} — {{ selectedOrder.patient?.full_name }}
          </h2>
          <p class="muted">
            Specimen: {{ selectedOrder.specimen_number || 'Not collected' }} ·
            Status: <strong class="capitalize">{{ selectedOrder.status.replace('_', ' ') }}</strong>
          </p>
        </div>
        <div class="header-actions">
          <button
            v-if="auth.can('orders.result') && selectedOrder.status === 'ordered'"
            type="button"
            class="btn-primary"
            @click="handleCollect(selectedOrder)"
          >
            Collect Specimen
          </button>
          <button
            v-if="auth.can('orders.create') && selectedOrder.status === 'completed'"
            type="button"
            class="btn-primary"
            @click="handleReview(selectedOrder)"
          >
            Review &amp; Sign Off
          </button>
          <button type="button" class="btn-ghost" @click="selectedOrder = null">Close</button>
        </div>
      </div>

      <form
        v-if="auth.can('orders.result') && !['cancelled', 'reviewed'].includes(selectedOrder.status)"
        class="form-grid"
        @submit.prevent="handlePostResult"
      >
        <label class="field">
          <span>Order Item *</span>
          <select v-model="resultForm.clinical_order_item_id" required>
            <option value="">Select item...</option>
            <option v-for="item in selectedOrder.items" :key="item.id" :value="String(item.id)">
              {{ item.item_name }} ({{ item.status }})
            </option>
          </select>
        </label>
        <label class="field"><span>Result Value</span><input v-model="resultForm.value" type="text" placeholder="e.g. 13.8 or Negative" /></label>
        <label class="field"><span>Units</span><input v-model="resultForm.units" type="text" placeholder="g/dL" /></label>
        <label class="field"><span>Reference Range</span><input v-model="resultForm.reference_range" type="text" /></label>
        <label class="field">
          <span>Abnormal Flag</span>
          <select v-model="resultForm.abnormal_flag">
            <option value="normal">Normal</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
            <option value="abnormal">Abnormal</option>
          </select>
        </label>
        <label class="field"><span>Findings / Impression</span><input v-model="resultForm.impression" type="text" /></label>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving">Post Result</button>
        </div>
      </form>

      <table class="data-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Result</th>
            <th>Reference</th>
            <th>Flag</th>
            <th>Impression / Notes</th>
            <th>Resulted By</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!selectedOrder.results.length">
            <td colspan="6" class="muted center">No results posted yet.</td>
          </tr>
          <tr v-for="res in selectedOrder.results" :key="res.id">
            <td><strong>{{ res.result_label }}</strong></td>
            <td>{{ res.value || '—' }} {{ res.units || '' }}</td>
            <td>{{ res.reference_range || '—' }}</td>
            <td>
              <span
                class="badge capitalize"
                :class="{ 'badge-warn': res.abnormal_flag !== 'normal' }"
              >
                {{ res.abnormal_flag }}
              </span>
            </td>
            <td>{{ res.impression || res.findings || '—' }}</td>
            <td>{{ res.resulted_by || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
