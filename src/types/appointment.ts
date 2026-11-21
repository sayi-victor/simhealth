export interface AppointmentCategory {
  id: number
  slug: string
  name: string
  color: string
  default_duration_minutes: number
  provider_mandatory: boolean
}

export interface Appointment {
  id: number
  patient_id: number
  provider_id: number | null
  facility_id: number | null
  category_id: number | null
  encounter_id: number | null
  title: string | null
  starts_at: string
  ends_at: string
  duration_minutes: number
  all_day: boolean
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_room' | 'completed' | 'cancelled' | 'no_show'
  room: string | null
  reason: string | null
  notes: string | null
  checked_in_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  patient: {
    id: number
    mrn: string
    full_name: string
    phone_cell: string | null
  } | null
  provider: { id: number; full_name: string } | null
  facility: { id: number; name: string; code: string | null } | null
  category: AppointmentCategory | null
  encounter: { id: number; encounter_number: string; status: string } | null
}
