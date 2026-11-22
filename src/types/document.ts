export interface DocumentUploader {
  id: number
  full_name: string
}

export interface DocumentSummary {
  id: number
  category: string
  original_name: string
  mime_type: string
  size_bytes: number
  sha256: string
  download_url: string
  uploaded_by: DocumentUploader | null
  created_at: string | null
}

export interface DocumentCategory {
  value: string
  label: string
}

/** Which record a document is attached to. */
export type DocumentOwnerType = 'patient' | 'encounter' | 'order'

/** Paginated envelope returned by Laravel resource collections. */
export interface Paginated<T> {
  data: T[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  links?: Record<string, string | null>
}
