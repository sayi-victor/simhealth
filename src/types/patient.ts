export interface PatientContact {
  id?: number
  contact_type: 'emergency' | 'guardian' | 'next_of_kin' | 'mother' | 'father' | 'other'
  relationship: string | null
  full_name: string
  sex?: string | null
  phone: string | null
  email?: string | null
  address?: string | null
  country?: string | null
  is_primary?: boolean
}

export interface PatientConsent {
  allow_sms: boolean
  allow_email: boolean
  allow_voice: boolean
  allow_mail: boolean
  hipaa_notice_received: boolean
  hipaa_message?: string | null
  allow_immunization_registry: boolean
  allow_health_info_exchange: boolean
  advance_directive_completed: boolean
  advance_directive_reviewed_at?: string | null
}

export interface PatientEmployer {
  id?: number
  employer_name: string
  occupation?: string | null
  department?: string | null
  employment_status?: string | null
  phone?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  is_current?: boolean
}

export interface PatientInsurance {
  id?: number
  tier: 'primary' | 'secondary' | 'tertiary'
  provider_name: string
  plan_name?: string | null
  policy_number?: string | null
  group_number?: string | null
  policy_type?: string | null
  subscriber_relationship?: string | null
  copay?: string | null
  maximum_bill?: string | null
  accept_assignment?: boolean
  effective_date?: string | null
  expiration_date?: string | null
  is_active?: boolean
}

export interface PatientIssue {
  id: number
  patient_id: number
  type: 'medical_problem' | 'allergy' | 'medication' | 'surgery' | 'dental'
  title: string
  code: string | null
  severity: string | null
  reaction: string | null
  onset_date: string | null
  resolved_date: string | null
  is_active: boolean
  comments: string | null
  created_at: string | null
}

export interface PatientHistory {
  lifestyle: Record<string, string> | null
  family_history: Record<string, string> | null
  surgical_history: Record<string, string> | null
  preventive_exams: Record<string, string> | null
  mental_health: Record<string, string> | null
  additional_notes: string | null
  updated_at: string | null
}

export interface PatientSummary {
  id: number
  mrn: string
  title: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  full_name: string
  date_of_birth: string | null
  sex: string
  phone_cell: string | null
  email: string | null
  city: string | null
  registration_date: string | null
  clinical_alert: string | null
  facility: { id: number; name: string; code: string | null } | null
  created_at: string | null
  deleted_at: string | null
}

export interface PatientDetail extends PatientSummary {
  facility_id: number | null
  primary_provider_id: number | null
  referring_provider_id: number | null
  marital_status: string | null
  nationality: string | null
  religion: string | null
  language: string | null
  race: string | null
  ethnicity: string | null
  occupation: string | null
  national_id: string | null
  passport_number: string | null
  drivers_license: string | null
  phone_home: string | null
  phone_work: string | null
  street: string | null
  state: string | null
  postal_code: string | null
  country_code: string | null
  registration_type: string | null
  referral_source: string | null
  price_level: string
  billing_note: string | null
  deceased_at: string | null
  deceased_reason: string | null
  contacts: PatientContact[]
  consent: PatientConsent | null
  employers: PatientEmployer[]
  insurances: PatientInsurance[]
  issues: PatientIssue[]
  history: PatientHistory | null
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}
