export interface DrugLot {
  id: number
  lot_number: string
  manufacturer: string | null
  quantity_on_hand: number
  unit_cost: string | null
  expires_at: string | null
  received_at: string | null
}

export interface Drug {
  id: number
  code: string
  name: string
  generic_name: string | null
  rxnorm_code: string | null
  form: string
  strength: string | null
  route: string
  unit: string
  unit_price: string
  reorder_level: number
  requires_prescription: boolean
  is_controlled: boolean
  is_active: boolean
  total_on_hand: number | null
  low_stock: boolean | null
  lots?: DrugLot[]
}

export interface Prescription {
  id: number
  prescription_number: string
  patient_id: number
  encounter_id: number | null
  drug_id: number | null
  drug_name: string
  dosage: string
  route: string | null
  frequency: string
  duration_days: number | null
  quantity_prescribed: number
  quantity_dispensed: number
  quantity_remaining: number
  indication: string | null
  instructions: string | null
  status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled'
  prescribed_at: string
  patient: { id: number; mrn: string; full_name: string } | null
  provider: { id: number; full_name: string } | null
  drug: { id: number; code: string; name: string; strength: string | null; form: string; unit_price: string } | null
}
