export interface Consumption {
  consumption: number
  interval_start: string
  interval_end: string
}

export interface ConsumptionResponse {
  count: number
  next: string | null
  previous: string | null
  results: Consumption[]
}

export interface Rate {
  value_exc_vat: number
  value_inc_vat: number
  valid_from: string
  valid_to: string
}

export interface TariffResponse {
  results: {
    unit_rate: Rate[]
    standing_charge: Rate[]
  }[]
}

export interface ElectricityMeterPoint {
  mpan: string
  serial_number: string
  is_export: boolean
  agreements: Array<{
    tariff_code: string
    valid_from: string
    valid_to: string | null
  }>
  meters: Array<{
    serial_number: string
  }>
}

export interface GasMeterPoint {
  mprn: string
  serial_number: string
  meters: Array<{
    serial_number: string
  }>
}

export interface Property {
  id: string
  moved_in_at: string
  moved_out_at: string | null
  address_line_1: string
  address_line_2: string | null
  address_line_3: string | null
  town: string
  county: string | null
  postcode: string
  electricity_meter_points: ElectricityMeterPoint[]
  gas_meter_points: GasMeterPoint[]
}

export interface AccountInfo {
  number: string
  properties: Property[]
} 