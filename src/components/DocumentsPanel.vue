<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { apiDownload, apiRequest, ApiError } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import type { DocumentCategory, DocumentOwnerType, DocumentSummary } from '../types/document'

const props = defineProps<{
  ownerType: DocumentOwnerType
  ownerId: number
}>()

const auth = useAuthStore()

const documents = ref<DocumentSummary[]>([])
const categories = ref<DocumentCategory[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const uploading = ref(false)
const deletingId = ref<number | null>(null)

const search = ref('')
const categoryFilter = ref('')

const selectedFile = ref<File | null>(null)
const uploadCategory = ref('general')
const fileInput = ref<HTMLInputElement | null>(null)

const canView = computed(() => auth.can('documents.view'))
const canUpload = computed(() => auth.can('documents.upload'))
const canDelete = computed(() => auth.can('documents.delete'))

const basePath = computed(() => {
  switch (props.ownerType) {
    case 'encounter':
      return `/encounters/${props.ownerId}/documents`
    case 'order':
      return `/orders/${props.ownerId}/documents`
    default:
      return `/patients/${props.ownerId}/documents`
  }
})

function describeError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback

  const details = (err.details ?? {}) as Record<string, string[] | string>
  for (const value of Object.values(details)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) return first
  }

  return err.message
}

async function fetchDocuments() {
  if (!canView.value) return

  loading.value = true
  error.value = ''

  const params = new URLSearchParams({ per_page: '50' })
  if (search.value.trim()) params.set('q', search.value.trim())
  if (categoryFilter.value) params.set('category', categoryFilter.value)

  try {
    const res = await apiRequest<{ data: DocumentSummary[]; meta?: { total: number } }>(
      `${basePath.value}?${params.toString()}`,
    )
    documents.value = res.data
    total.value = res.meta?.total ?? res.data.length
  } catch (err) {
    error.value = describeError(err, 'Failed to load documents.')
  } finally {
    loading.value = false
  }
}

async function fetchCategories() {
  if (!canView.value) return

  try {
    const res = await apiRequest<{ data: DocumentCategory[] }>('/document-categories')
    categories.value = res.data
    if (res.data.length && !res.data.some((c) => c.value === uploadCategory.value)) {
      uploadCategory.value = res.data[0]!.value
    }
  } catch {
    // Category metadata is cosmetic; the upload form still works with "general".
    categories.value = categories.value.length ? categories.value : [{ value: 'general', label: 'General' }]
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] ?? null
}

async function handleUpload() {
  if (!selectedFile.value) return

  uploading.value = true
  error.value = ''

  const form = new FormData()
  form.append('file', selectedFile.value)
  form.append('category', uploadCategory.value || 'general')

  try {
    await apiRequest(basePath.value, { method: 'POST', body: form })
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    await fetchDocuments()
  } catch (err) {
    error.value = describeError(err, 'Failed to upload document.')
  } finally {
    uploading.value = false
  }
}

async function handleDownload(doc: DocumentSummary) {
  error.value = ''
  try {
    await apiDownload(`/documents/${doc.id}/download`, doc.original_name)
  } catch (err) {
    error.value = describeError(err, 'Failed to download document.')
  }
}

async function handleDelete(doc: DocumentSummary) {
  if (!window.confirm(`Archive "${doc.original_name}"? The record is retained for audit.`)) return

  deletingId.value = doc.id
  error.value = ''

  try {
    await apiRequest(`/documents/${doc.id}`, { method: 'DELETE' })
    await fetchDocuments()
  } catch (err) {
    error.value = describeError(err, 'Failed to remove document.')
  } finally {
    deletingId.value = null
  }
}

function categoryLabel(slug: string): string {
  const match = categories.value.find((c) => c.value === slug)
  if (match) return match.label
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${exponent === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

watch(
  () => [props.ownerType, props.ownerId],
  () => {
    search.value = ''
    categoryFilter.value = ''
    void fetchDocuments()
  },
)

onMounted(() => {
  void fetchCategories()
  void fetchDocuments()
})
</script>

<template>
  <section class="card mt-1">
    <div class="page-header">
      <h2 class="section-title">Documents &amp; Attachments</h2>
      <span v-if="canView && !loading" class="muted">
        {{ total }} file{{ total === 1 ? '' : 's' }}
      </span>
    </div>

    <p v-if="!canView" class="muted mt-1">
      You do not have access to patient documents.
    </p>

    <template v-else>
      <div v-if="error" class="alert-error mt-1">{{ error }}</div>

      <form v-if="canUpload" class="toolbar-form mt-1" @submit.prevent="handleUpload">
        <label class="field">
          <span>Attach file</span>
          <input ref="fileInput" type="file" class="input" @change="handleFileChange" />
        </label>
        <label class="field">
          <span>Category</span>
          <select v-model="uploadCategory" class="input select-sm">
            <option v-for="cat in categories" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </label>
        <button type="submit" class="btn-primary" :disabled="!selectedFile || uploading">
          {{ uploading ? 'Uploading...' : 'Upload document' }}
        </button>
      </form>

      <form class="toolbar-form mt-1" @submit.prevent="fetchDocuments">
        <input
          v-model="search"
          type="search"
          class="input"
          placeholder="Search file name or type..."
        />
        <select v-model="categoryFilter" class="input select-sm" @change="fetchDocuments">
          <option value="">All categories</option>
          <option v-for="cat in categories" :key="cat.value" :value="cat.value">
            {{ cat.label }}
          </option>
        </select>
        <button type="submit" class="btn-primary" :disabled="loading">Filter</button>
      </form>

      <div class="table-wrap mt-1">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Category</th>
              <th scope="col">Size</th>
              <th scope="col">Uploaded by</th>
              <th scope="col">Uploaded</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="muted center">Loading documents...</td>
            </tr>
            <tr v-else-if="documents.length === 0">
              <td colspan="6" class="muted center">No documents attached.</td>
            </tr>
            <tr v-for="doc in documents" :key="doc.id">
              <td>
                <strong class="break-all">{{ doc.original_name }}</strong>
                <div class="muted">{{ doc.mime_type }}</div>
              </td>
              <td><span class="badge">{{ categoryLabel(doc.category) }}</span></td>
              <td>{{ formatBytes(doc.size_bytes) }}</td>
              <td>{{ doc.uploaded_by?.full_name || '—' }}</td>
              <td>{{ formatDate(doc.created_at) }}</td>
              <td>
                <div class="row-actions">
                  <button type="button" class="btn-ghost" @click="handleDownload(doc)">
                    Download
                  </button>
                  <button
                    v-if="canDelete"
                    type="button"
                    class="btn-danger"
                    :disabled="deletingId === doc.id"
                    @click="handleDelete(doc)"
                  >
                    {{ deletingId === doc.id ? 'Removing...' : 'Delete' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
