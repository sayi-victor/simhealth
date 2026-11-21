<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { PaginatedResponse } from '../types/patient'

interface Warehouse {
  id: number
  code: string
  name: string
  location: string | null
}

interface InventoryItem {
  id: number
  sku: string
  name: string
  category: string
  unit: string
  unit_cost: string
  unit_price: string
  reorder_level: number
  quantity_on_hand: number
  low_stock: boolean
  warehouse: { id: number; code: string; name: string } | null
}

const auth = useAuthStore()

const items = ref<InventoryItem[]>([])
const warehouses = ref<Warehouse[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const showNewItem = ref(false)

const search = ref('')
const category = ref('')
const lowStockOnly = ref(false)

const itemForm = reactive({
  warehouse_id: '',
  sku: '',
  name: '',
  category: 'consumable',
  unit: 'box',
  unit_cost: '0.00',
  unit_price: '0.00',
  reorder_level: 10,
  quantity_on_hand: 0,
})

async function fetchItems() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    if (search.value.trim()) params.set('search', search.value.trim())
    if (category.value) params.set('category', category.value)
    if (lowStockOnly.value) params.set('low_stock', 'true')
    const res = await apiRequest<PaginatedResponse<InventoryItem>>(`/inventory-items?${params.toString()}`)
    items.value = res.data
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to load inventory.'
  } finally {
    loading.value = false
  }
}

async function fetchWarehouses() {
  try {
    const res = await apiRequest<{ data: Warehouse[] }>('/warehouses')
    warehouses.value = res.data
  } catch {
    // Non-fatal
  }
}

async function handleCreateItem() {
  saving.value = true
  error.value = ''
  try {
    await apiRequest('/inventory-items', {
      method: 'POST',
      body: JSON.stringify({
        warehouse_id: itemForm.warehouse_id ? Number(itemForm.warehouse_id) : null,
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category,
        unit: itemForm.unit.trim() || 'unit',
        unit_cost: Number(itemForm.unit_cost),
        unit_price: Number(itemForm.unit_price),
        reorder_level: Number(itemForm.reorder_level),
        quantity_on_hand: Number(itemForm.quantity_on_hand),
      }),
    })
    showNewItem.value = false
    itemForm.sku = ''
    itemForm.name = ''
    itemForm.quantity_on_hand = 0
    await fetchItems()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Failed to add item.'
  } finally {
    saving.value = false
  }
}

async function handleMovement(item: InventoryItem, type: 'receipt' | 'issue') {
  const label = type === 'receipt' ? 'Receive stock for' : 'Issue stock from'
  const input = window.prompt(`${label} ${item.name} (On hand: ${item.quantity_on_hand}):`, '10')
  if (!input) return
  const qty = Number(input)
  if (!Number.isInteger(qty) || qty <= 0) return

  error.value = ''
  try {
    await apiRequest(`/inventory-items/${item.id}/movements`, {
      method: 'POST',
      body: JSON.stringify({ movement_type: type, quantity: qty }),
    })
    await fetchItems()
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Stock movement failed.'
  }
}

watch([category, lowStockOnly], fetchItems)

onMounted(async () => {
  await Promise.all([fetchWarehouses(), fetchItems()])
})
</script>

<template>
  <AppLayout>
    <section class="page-header">
      <div>
        <h1>Clinical Inventory</h1>
        <p class="muted">Consumables, lab reagents, surgical supplies, and stock movements</p>
      </div>
      <button
        v-if="auth.can('inventory.manage')"
        type="button"
        class="btn-primary"
        @click="showNewItem = !showNewItem"
      >
        {{ showNewItem ? 'Close' : '+ Add Stock Item' }}
      </button>
    </section>

    <div v-if="error" class="alert-error mt-1">{{ error }}</div>

    <form v-if="showNewItem" class="card form-stack mt-1" @submit.prevent="handleCreateItem">
      <h2 class="section-title">New Inventory Item</h2>
      <div class="form-grid">
        <label class="field"><span>SKU *</span><input v-model="itemForm.sku" type="text" required placeholder="CON-GLOVE-M" /></label>
        <label class="field"><span>Item Name *</span><input v-model="itemForm.name" type="text" required /></label>
        <label class="field">
          <span>Category</span>
          <select v-model="itemForm.category">
            <option value="consumable">Consumable</option>
            <option value="lab_reagent">Lab Reagent</option>
            <option value="surgical">Surgical</option>
            <option value="equipment">Equipment</option>
            <option value="general">General</option>
          </select>
        </label>
        <label class="field">
          <span>Warehouse</span>
          <select v-model="itemForm.warehouse_id">
            <option value="">Default / Unassigned</option>
            <option v-for="w in warehouses" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
          </select>
        </label>
        <label class="field"><span>Unit</span><input v-model="itemForm.unit" type="text" /></label>
        <label class="field"><span>Unit Cost *</span><input v-model="itemForm.unit_cost" type="number" step="0.01" min="0" required /></label>
        <label class="field"><span>Reorder Level</span><input v-model.number="itemForm.reorder_level" type="number" min="0" /></label>
        <label class="field"><span>Opening Qty</span><input v-model.number="itemForm.quantity_on_hand" type="number" min="0" /></label>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" :disabled="saving">Save Item</button>
      </div>
    </form>

    <section class="card toolbar mt-1">
      <form class="toolbar-form" @submit.prevent="fetchItems">
        <input v-model="search" type="search" class="input" placeholder="Search by SKU or name..." />
        <select v-model="category" class="input select-sm">
          <option value="">All categories</option>
          <option value="consumable">Consumable</option>
          <option value="lab_reagent">Lab Reagent</option>
          <option value="surgical">Surgical</option>
          <option value="equipment">Equipment</option>
          <option value="general">General</option>
        </select>
        <label class="checkbox-inline">
          <input v-model="lowStockOnly" type="checkbox" />
          <span>Low stock only</span>
        </label>
        <button type="submit" class="btn-primary">Filter</button>
      </form>
    </section>

    <section class="card mt-1 table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Item</th>
            <th>Category</th>
            <th>Unit Cost</th>
            <th>On Hand</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="muted center">Loading inventory...</td>
          </tr>
          <tr v-else-if="items.length === 0">
            <td colspan="6" class="muted center">No inventory items found.</td>
          </tr>
          <tr v-for="item in items" :key="item.id">
            <td><strong>{{ item.sku }}</strong></td>
            <td>
              {{ item.name }}
              <div v-if="item.warehouse" class="muted">{{ item.warehouse.name }}</div>
            </td>
            <td class="capitalize">{{ item.category.replace('_', ' ') }}</td>
            <td>{{ item.unit_cost }}</td>
            <td>
              <strong>{{ item.quantity_on_hand }}</strong> {{ item.unit }}
              <span v-if="item.low_stock" class="badge badge-warn">Low</span>
            </td>
            <td>
              <div v-if="auth.can('inventory.manage')" class="header-actions">
                <button type="button" class="btn-primary" @click="handleMovement(item, 'receipt')">
                  + Receive
                </button>
                <button type="button" class="btn-ghost" @click="handleMovement(item, 'issue')">
                  − Issue
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppLayout>
</template>
