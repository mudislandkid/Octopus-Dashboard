import { AccountInfo, ElectricityMeterPoint } from '../types/api'

export interface MeterConfig {
  electricity?: {
    import: {
      mpan: string
      serialNumber: string
      validFrom: string | null
      validTo: string | null
    } | null
    export: {
      mpan: string
      serialNumber: string
      validFrom: string | null
      validTo: string | null
    } | null
  }
  gas?: {
    mprn: string
    serialNumber: string
    validFrom: string | null
    validTo: string | null
  } | null
}

export interface PropertyDetails {
  id: string
  address: string
  movedInAt: string | null
  movedOutAt: string | null
  meters: MeterConfig
}

function getLatestValidAgreement(point: ElectricityMeterPoint) {
  if (!point.agreements || point.agreements.length === 0) return null

  const now = new Date()
  return point.agreements
    .filter(a => {
      const validFrom = a.valid_from ? new Date(a.valid_from) : null
      const validTo = a.valid_to ? new Date(a.valid_to) : null
      return (!validFrom || validFrom <= now) && (!validTo || validTo > now)
    })
    .sort((a, b) => {
      const aFrom = new Date(a.valid_from)
      const bFrom = new Date(b.valid_from)
      return bFrom.getTime() - aFrom.getTime()
    })[0] || null
}

export function getCurrentPropertyDetails(accountInfo: AccountInfo): PropertyDetails | null {
  // Find the current property (where moved_out_at is null)
  const currentProperty = accountInfo.properties.find(p => p.moved_out_at === null)
  if (!currentProperty) return null

  // Format the address
  const address = [
    currentProperty.address_line_1,
    currentProperty.address_line_2,
    currentProperty.address_line_3,
    currentProperty.town,
    currentProperty.county,
    currentProperty.postcode
  ].filter(Boolean).join(', ')

  // Extract meter configurations
  const meters: MeterConfig = {
    electricity: {
      import: null,
      export: null
    },
    gas: null
  }

  // Process electricity meters
  if (currentProperty.electricity_meter_points?.length) {
    currentProperty.electricity_meter_points.forEach(point => {
      if (!point.meters?.length) return

      const latestMeter = point.meters[point.meters.length - 1]
      const firstAgreement = point.agreements?.[0]
      const latestAgreement = getLatestValidAgreement(point)

      const meterConfig = {
        mpan: point.mpan,
        serialNumber: latestMeter.serial_number,
        validFrom: firstAgreement?.valid_from || null,
        validTo: latestAgreement?.valid_to || null
      }

      if (point.is_export) {
        meters.electricity!.export = meterConfig
      } else {
        meters.electricity!.import = meterConfig
      }
    })

    // If no meters were found, remove the electricity config
    if (!meters.electricity!.import && !meters.electricity!.export) {
      delete meters.electricity
    }
  }

  // Process gas meter
  if (currentProperty.gas_meter_points?.[0]) {
    const gasPoint = currentProperty.gas_meter_points[0]
    if (gasPoint.meters?.length) {
      const latestMeter = gasPoint.meters[gasPoint.meters.length - 1]

      meters.gas = {
        mprn: gasPoint.mprn,
        serialNumber: latestMeter.serial_number,
        validFrom: null, // Gas meters might not have agreement data
        validTo: null
      }
    }
  }

  return {
    id: currentProperty.id,
    address,
    movedInAt: currentProperty.moved_in_at || null,
    movedOutAt: currentProperty.moved_out_at || null,
    meters
  }
}

export function isValidMeterConfig(meterConfig: MeterConfig): boolean {
  const now = new Date()

  // Check electricity meters
  if (meterConfig.electricity) {
    if (meterConfig.electricity.import) {
      const validTo = meterConfig.electricity.import.validTo 
        ? new Date(meterConfig.electricity.import.validTo)
        : null
      if (validTo && validTo < now) return false
    }
    if (meterConfig.electricity.export) {
      const validTo = meterConfig.electricity.export.validTo
        ? new Date(meterConfig.electricity.export.validTo)
        : null
      if (validTo && validTo < now) return false
    }
  }

  // Check gas meter
  if (meterConfig.gas) {
    const validTo = meterConfig.gas.validTo
      ? new Date(meterConfig.gas.validTo)
      : null
    if (validTo && validTo < now) return false
  }

  return true
} 