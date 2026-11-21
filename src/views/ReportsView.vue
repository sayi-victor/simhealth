<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'

interface OverviewReport {
  period: { date_from: string; date_to: string }
  patients: { total_active: number; new_in_period: number }
  encounters: { total_in_period: number; by_category: Record<string, number> }
  appointments: { total_in_period: number; by_status: Record<string, number> }
  inpatient: { active_admissions: number; total_beds: number; occupied_beds: number; available_beds: number; occupancy_rate_pct: number }
  orders: { total_in_period: number; by_type: Record<string, number>; abnormal_results: number }
  pharmacy: { dispensations_count: number; dispensed_revenue: string }
}

interface RevenueReport {
  invoices: { count: number; total_billed: string; total_paid: string; total_outstanding: string }
  payments_by_method: Array<{ payment_method: string; count: number; total: string }>
  claims_by_status: Array<{ status: string; count: number; claimed_amount: string; paid_amount: string }>
}

interface InventoryAlerts {
  low_stock_inventory: Array<{ id: number; sku: string; name: string; quantity_on_hand: number; reorder_level: number; unit: string }>
  low_stock_drugs: Array<{ id: number; code: string; name: string; total_on_hand: number; reorder_level: number }>
  expiring_drug_lots: Array<{ id: number; drug_name: string | null; lot_number: string; quantity_on_hand: number; expires_at: string | null }>
}

const dateFrom = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
const dateTo = ref(new Date().toISOString().slice(0, 10))
const overview = ref<OverviewReport | null>(null)
const revenue = ref<RevenueReport | null>(null)
const alerts = ref<InventoryAlerts | null>(null)
const loading = ref(false)
const error = ref('')

async function fetchReports() {
  loading.value = true
  error.value = ''
  try {
    const qs = `date_from=${dateFrom.value}&date_to=${dateTo.value}`
    const [ov, rev, al] = await Promise.all([
      apiRequest<{ data: OverviewReport }>(`/reports/overview?${qs}`),
      apiRequest<{ data: RevenueReport }>(`/reports/revenue?${qs}`),
      apiRequest<{ data: InventoryAlerts }>('/reports/inventory-alerts'),
    ])
    overview.value = ov.data
    revenue.value = rev.data
    alerts.value = al.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load reports.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchReports)
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Clinical &amp; Operational Reports</h1>
        <p class="muted">Real-time clinical volume, bed occupancy, revenue, and stock alerts</p>
      </div>
      <form class="toolbar-form" @submit.prevent="fetchReports">
        <input v-model="dateFrom" type="date" class="input select-sm" />
        <input v-model="dateTo" type="date" class="input select-sm" />
        <button type="submit" class="btn-primary" :disabled="loading">Refresh</button>
      </form>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <template v-if="overview">
      <div class="card-grid mt-1">
        <article class="card">
          <h3>Active Patients</h3>
          <p class="card-value">{{ overview.patients.total_active }}</p>
          <p class="muted">+{{ overview.patients.new_in_period }} new in period</p>
        </article>
        <article class="card">
          <h3>Encounters</h3>
          <p class="card-value">{{ overview.encounters.total_in_period }}</p>
          <p class="muted">{{ overview.appointments.total_in_period }} appointments</p>
        </article>
        <article class="card">
          <h3>Bed Occupancy</h3>
          <p class="card-value">{{ overview.inpatient.occupancy_rate_pct }}%</p>
          <p class="muted">{{ overview.inpatient.occupied_beds }} / {{ overview.inpatient.total_beds }} beds occupied</p>
        </article>
        <article class="card">
          <h3>Orders &amp; Abnormal</h3>
          <p class="card-value">{{ overview.orders.total_in_period }}</p>
          <p class="muted">{{ overview.orders.abnormal_results }} abnormal results</p>
        </article>
        <article class="card">
          <h3>Pharmacy Dispensed</h3>
          <p class="card-value">{{ overview.pharmacy.dispensed_revenue }}</p>
          <p class="muted">{{ overview.pharmacy.dispensations_count }} dispensations</p>
        </article>
      </div>
    </template>

    <section v-if="revenue" class="card mt-1">
      <h2 class="section-title">Revenue &amp; Claims Summary</h2>
      <div class="card-grid">
        <article class="card">
          <h3>Total Billed</h3>
          <p class="card-value">{{ revenue.invoices.total_billed }}</p>
          <p class="muted">{{ revenue.invoices.count }} invoices</p>
        </article>
        <article class="card">
          <h3>Collected</h3>
          <p class="card-value">{{ revenue.invoices.total_paid }}</p>
        </article>
        <article class="card">
          <h3>Outstanding Balance</h3>
          <p class="card-value">{{ revenue.invoices.total_outstanding }}</p>
        </article>
      </div>
    </section>

    <section v-if="alerts" class="card mt-1">
      <h2 class="section-title">Inventory &amp; Expiry Alerts</h2>
      <div class="detail-grid">
        <div>
          <h3 class="sub-heading">Low-Stock Clinical Supplies ({{ alerts.low_stock_inventory.length }})</h3>
          <p v-if="!alerts.low_stock_inventory.length" class="muted">All supplies above reorder level.</p>
          <p v-for="item in alerts.low_stock_inventory" :key="item.id" class="list-line">
            <strong>{{ item.sku }}</strong> — {{ item.name }}: {{ item.quantity_on_hand }} {{ item.unit }} (min {{ item.reorder_level }})
          </p>
        </div>
        <div>
          <h3 class="sub-heading">Drug Lots Expiring Within 60 Days ({{ alerts.expiring_drug_lots.length }})</h3>
          <p v-if="!alerts.expiring_drug_lots.length" class="muted">No expiring lots in the next 60 days.</p>
          <p v-for="lot in alerts.expiring_drug_lots" :key="lot.id" class="list-line">
            <strong>{{ lot.drug_name }}</strong> (Lot {{ lot.lot_number }}) — {{ lot.quantity_on_hand }} left, exp {{ lot.expires_at }}
          </p>
        </div>
      </div>
    </section>
  </AppLayout>
</template>
