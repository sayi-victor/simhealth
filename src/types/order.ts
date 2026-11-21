export interface OrderCatalogItem {
  id: number
  code: string
  name: string
  order_type: 'laboratory' | 'imaging' | 'procedure' | 'service'
  category: string | null
  specimen_type: string | null
  units: string | null
  reference_range: string | null
  unit_price: string
}

export interface ClinicalOrderItem {
  id: number
  catalog_item_id: number | null
  item_code: string
  item_name: string
  status: 'pending' | 'resulted' | 'cancelled'
  notes: string | null
}

export interface ClinicalOrderResult {
  id: number
  clinical_order_item_id: number | null
  result_code: string | null
  result_label: string
  value: string | null
  units: string | null
  reference_range: string | null
  abnormal_flag: 'normal' | 'low' | 'high' | 'critical' | 'abnormal'
  findings: string | null
  impression: string | null
  comments: string | null
  result_status: string
  resulted_by: string | null
  resulted_at: string | null
}

export interface ClinicalOrder {
  id: number
  order_number: string
  patient_id: number
  encounter_id: number | null
  order_type: 'laboratory' | 'imaging' | 'procedure' | 'service'
  priority: 'routine' | 'urgent' | 'stat'
  status: 'ordered' | 'collected' | 'in_progress' | 'completed' | 'reviewed' | 'cancelled'
  specimen_type: string | null
  specimen_number: string | null
  collected_at: string | null
  ordered_at: string
  diagnosis: string | null
  clinical_history: string | null
  reviewed_at: string | null
  patient: { id: number; mrn: string; full_name: string } | null
  provider: { id: number; full_name: string } | null
  reviewer?: { id: number; full_name: string } | null
  items: ClinicalOrderItem[]
  results: ClinicalOrderResult[]
}
