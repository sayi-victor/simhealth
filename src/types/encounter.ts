export interface FormFieldDef {
  id: number
  field_key: string
  label: string
  group_name: string
  field_type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'radio'
  is_required: boolean
  sort_order: number
  options: string[] | null
  default_value: string | null
  help_text: string | null
}

export interface FormDefinition {
  id: number
  slug: string
  name: string
  category: string
  description: string | null
  version: number
  is_active: boolean
  fields: FormFieldDef[]
}

export interface EncounterVital {
  id: number
  recorded_at: string | null
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  respiration: number | null
  temperature: string | null
  temp_method: string | null
  weight_kg: string | null
  height_cm: string | null
  bmi: string | null
  bmi_status: string | null
  oxygen_saturation: string | null
  oxygen_sat_condition: string | null
  pain_score: number | null
  triage_level: string | null
  notes: string | null
  recorded_by: string | null
}

export interface EncounterNote {
  id: number
  note_type: string
  title: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  body: string | null
  is_signed: boolean
  author: string | null
  created_at: string | null
}

export interface EncounterFormInstance {
  id: number
  form_definition_id: number
  form_slug: string | null
  form_name: string | null
  status: string
  data: Record<string, unknown>
  filled_by: string | null
  created_at: string | null
}

export interface Encounter {
  id: number
  encounter_number: string
  patient_id: number
  facility_id: number | null
  provider_id: number | null
  encounter_date: string | null
  onset_date: string | null
  visit_category: string
  sensitivity: string
  status: 'open' | 'in_progress' | 'signed' | 'closed' | 'cancelled'
  shift: string | null
  room_number: string | null
  reason: string | null
  referral_source: string | null
  nhis_vcode: string | null
  price_level: string
  billing_note: string | null
  signed_at: string | null
  patient: {
    id: number
    mrn: string
    full_name: string
    date_of_birth: string | null
    sex: string
    clinical_alert: string | null
  } | null
  facility: { id: number; name: string; code: string | null } | null
  provider: { id: number; full_name: string } | null
  signer?: { id: number; full_name: string } | null
  vitals?: EncounterVital[]
  notes?: EncounterNote[]
  forms?: EncounterFormInstance[]
}
