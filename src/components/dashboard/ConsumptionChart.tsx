import { Consumption, Rate } from '../../lib/types/api'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { format, parseISO, startOfDay, endOfDay, differenceInDays, addDays } from 'date-fns'
import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  ReferenceLine
} from 'recharts'

interface ConsumptionChartProps {
  title: string
  data: Consumption[]
  previousPeriodData?: Consumption[] | null
  showPreviousPeriod?: boolean
  rates?: Rate[] | null
  unit: string
  loading?: boolean
  standingCharge?: number  // Standing charge in pence per day (inc VAT)
}

interface ChartDataPoint {
  date: string
  dayNumber: number
  value: number
  previousValue: number
  price?: number
  formattedDate: string
  hasData: boolean
  actualDate?: string
  readingCount: number
  priceReadings: number
}

type MissingZone = {
  start: string
  end: string
}

interface DataPoint {
  date: string
  value: number
  previousValue: number
  value_inc_vat?: number
  price?: number
  formattedDate: string
  hasData: boolean
  actualDate?: string
  dayNumber: number
  readingCount: number
  priceReadings: number
}

// Add a constant for our bright red color with transparency
const BRIGHT_RED_BORDER = 'rgba(255, 80, 80, 1.0)'
const ORANGE = 'rgba(255, 165, 0, 0.4)'
const ORANGE_BORDER = 'rgba(255, 165, 0, 1.0)'

// Add constant for turquoise color
const TURQUOISE = 'rgba(64, 224, 208, 0.8)'
// Add constant for vivid purple
const VIVID_PURPLE = 'rgba(161, 0, 255, 0.8)'
// Add constant for bright pink
const BRIGHT_PINK = 'rgba(255, 20, 147, 0.8)'
// Add constant for bright green (from DailyPatternChart)
const LOW_COLOR = 'rgba(46, 213, 115, 0.9)'

// Add new color constant at the top with other colors
const PREVIOUS_PERIOD_COLOR = 'rgba(255, 140, 0, 0.9)' // Brighter orange for better visibility

export function ConsumptionChart({ title, data, previousPeriodData, showPreviousPeriod, rates, unit, loading = false, standingCharge }: ConsumptionChartProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Loading */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card className="p-4" key={i}>
              <div className="space-y-3">
                <Skeleton className="h-8 w-24 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-3 w-20 mx-auto" />
              </div>
            </Card>
          ))}
        </div>
        
        {/* Chart Loading */}
        <Card className="p-4">
          <div className="h-[300px] w-full flex items-center justify-center">
            <Skeleton className="h-[250px] w-[90%]" />
          </div>
        </Card>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No data available
      </div>
    )
  }

  // Sort data by interval_start
  const sortedData = [...data].sort((a, b) => 
    new Date(a.interval_start).getTime() - new Date(b.interval_start).getTime()
  )

  // Process rates data into a map for quick lookup
  const rateMap = new Map<string, number>()
  const previousPeriodRateMap = new Map<string, number>()
  if (rates) {
    // For gas, we just use the single fixed rate for all intervals
    if (rates.length === 1 && rates[0].payment_method === 'direct_debit_monthly') {
      const fixedRate = rates[0].value_inc_vat
      // Use the same fixed rate for all data points
      sortedData.forEach(reading => {
        rateMap.set(format(parseISO(reading.interval_start), "yyyy-MM-dd'T'HH:mm:ss'Z'"), fixedRate)
      })
      if (previousPeriodData) {
        previousPeriodData.forEach(reading => {
          previousPeriodRateMap.set(format(parseISO(reading.interval_start), "yyyy-MM-dd'T'HH:mm:ss'Z'"), fixedRate)
        })
      }
    } else {
      // For electricity, continue with the existing time-based rate lookup
      rates.forEach(rate => {
        const startTime = new Date(rate.valid_from)
        if (!isNaN(startTime.getTime())) {
          const key = format(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'")
          rateMap.set(key, rate.value_inc_vat)
          previousPeriodRateMap.set(key, rate.value_inc_vat)
        }
      })
    }
  }

  // Calculate previous period price statistics
  const previousPeriodPrices = previousPeriodData && rates
    ? previousPeriodData.reduce((acc, reading) => {
        const price = previousPeriodRateMap.get(format(parseISO(reading.interval_start), "yyyy-MM-dd'T'HH:mm:ss'Z'"))
        if (price) {
          acc.push(price)
        }
        return acc
      }, [] as number[])
    : []

  const previousPeriodStats = previousPeriodPrices.length > 0
    ? {
        lowestPrice: Math.min(...previousPeriodPrices),
        averagePrice: previousPeriodPrices.reduce((sum, price) => sum + price, 0) / previousPeriodPrices.length,
        peakPrice: Math.max(...previousPeriodPrices)
      }
    : null

  // Get the date range from the data
  const firstDate = parseISO(sortedData[0].interval_start)
  const lastDate = parseISO(sortedData[sortedData.length - 1].interval_end)
  const endOfLastDate = endOfDay(lastDate)
  const daysDifference = differenceInDays(endOfLastDate, firstDate)

  // Process data for chart and mark dates with data
  let chartData = daysDifference > 1
    ? Object.entries(
        // Group and sum by day
        sortedData.reduce((acc, reading) => {
          const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
          if (!acc[dateKey]) {
            const dayNumber = Object.keys(acc).length + 1
            acc[dateKey] = {
              date: dateKey,
              dayNumber,
              value: 0,
              previousValue: 0,
              price: rates?.length === 1 ? rates[0].value_inc_vat : 0,
              formattedDate: `Day ${dayNumber}`,
              actualDate: format(parseISO(reading.interval_start), 'MMM d'),
              hasData: true,
              readingCount: 0,
              priceReadings: 0
            }
          }
          acc[dateKey].value += reading.consumption || 0
          if (rates?.length !== 1) {
            const price = rateMap.get(format(parseISO(reading.interval_start), "yyyy-MM-dd'T'HH:mm:ss'Z'"))
            if (price) {
              acc[dateKey].price = ((acc[dateKey].price || 0) * acc[dateKey].priceReadings + price) / (acc[dateKey].priceReadings + 1)
              acc[dateKey].priceReadings++
            }
          }
          acc[dateKey].readingCount += 1
          return acc
        }, {} as Record<string, ChartDataPoint & { readingCount: number, priceReadings: number }>)
      ).map(([_, data]) => ({
        ...data,
        hasData: data.readingCount >= 40 && data.value > 0
      }))
    : sortedData.map((reading, index) => {
        const dateTime = parseISO(reading.interval_start)
        const price = rates?.length === 1 ? rates[0].value_inc_vat : rateMap.get(format(dateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"))
        return {
          date: format(dateTime, 'yyyy-MM-dd'),
          dayNumber: index + 1,
          value: reading.consumption || 0,
          previousValue: 0,
          price,
          formattedDate: `Hour ${format(dateTime, 'HH')}`,
          actualDate: format(dateTime, 'MMM d HH:mm'),
          hasData: reading.consumption > 0,
          readingCount: 1,
          priceReadings: price ? 1 : 0
        }
      })

  // Process previous period data if available
  if (previousPeriodData && showPreviousPeriod) {
    console.group('Previous Period Data Processing')
    // Calculate daily totals for previous period
    const previousDailyTotals = previousPeriodData.reduce((acc, reading) => {
      const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
      const readingDate = parseISO(reading.interval_start)
      
      // Only include readings from complete days (not the partial current day)
      if (readingDate < startOfDay(new Date())) {
        if (!acc[dateKey]) {
          acc[dateKey] = {
            total: 0,
            count: 0
          }
        }
        acc[dateKey].total += reading.consumption || 0
        acc[dateKey].count++
      }
      return acc
    }, {} as Record<string, { total: number, count: number }>)

    console.log('Previous Daily Totals:', previousDailyTotals)

    // Convert to array and sort by date
    const sortedPreviousDays = Object.entries(previousDailyTotals)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        value: data.total,
        date,
        actualDate: format(parseISO(date), 'MMM d'),
        readingCount: data.count
      }))

    console.log('Sorted Previous Days:', sortedPreviousDays)

    // Create a map of previous period data for easier lookup
    const previousPeriodMap = new Map(
      sortedPreviousDays.map((day, index) => [index + 1, day.value])
    )

    // Create new chart data with previous values
    chartData = chartData.map((point, index) => {
      // Align previous period data with current period dates
      const previousValue = sortedPreviousDays[sortedPreviousDays.length - chartData.length + index]?.value || 0
      
      return {
        ...point,
        previousValue,
        readingCount: Math.max(point.readingCount || 0, 48),
        priceReadings: point.priceReadings || 0
      }
    })
  }
  // Create a map of expected dates and mark the ones we have data for
  const expectedDates = new Map<string, boolean>()
  for (let i = 0; i < 30; i++) {
    const date = format(addDays(firstDate, i), 'yyyy-MM-dd')
    expectedDates.set(date, false)
  }

  // Mark dates that have actual data
  chartData.forEach(point => {
    expectedDates.set(point.date, point.hasData)
  })

  // Add missing dates to chart data with zero values
  const allDates = Array.from(expectedDates.keys()).sort()
  const chartDataWithMissingDates = allDates.map((date, index) => {
    const existingData = chartData.find(d => d.date === date)
    if (existingData) {
      return {
        ...existingData,
        dayNumber: index + 1,
        formattedDate: format(parseISO(date), 'MMM d'),
        actualDate: format(parseISO(date), 'MMM d'),
        readingCount: existingData.readingCount || 0,
        priceReadings: existingData.priceReadings || 0
      }
    }
    return {
      date,
      dayNumber: index + 1,
      value: 0,
      previousValue: 0,
      price: 0,
      formattedDate: format(parseISO(date), 'MMM d'),
      actualDate: format(parseISO(date), 'MMM d'),
      hasData: false,
      readingCount: 0,
      priceReadings: 0
    }
  }).slice(0, 30) // Ensure we only take exactly 30 days

  // Sort chart data
  const finalChartData = chartDataWithMissingDates.sort((a, b) => a.date.localeCompare(b.date))

  // Group data by date to count readings
  const readingsPerDay = sortedData.reduce((acc, reading) => {
    const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
    if (!acc[dateKey]) {
      acc[dateKey] = 0
    }
    acc[dateKey]++
    return acc
  }, {} as Record<string, number>)

  // Calculate statistics using finalChartData
  const total = finalChartData.reduce((sum, item) => sum + item.value, 0)
  const validValues = finalChartData.map(item => item.value).filter(value => value > 0)
  const average = validValues.length > 0 ? total / validValues.length : 0

  // Calculate previous period average
  const previousPeriodTotals = previousPeriodData && showPreviousPeriod
    ? previousPeriodData.reduce((acc, reading) => {
        const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
        if (!acc[dateKey]) {
          acc[dateKey] = { total: 0, count: 0 }
        }
        acc[dateKey].total += reading.consumption || 0
        acc[dateKey].count++
        return acc
      }, {} as Record<string, { total: number, count: number }>)
    : null

  const previousDailyAverage = previousPeriodTotals
    ? Object.values(previousPeriodTotals).reduce((sum, day) => sum + day.total, 0) / Object.keys(previousPeriodTotals).length
    : 0

  // Calculate daily totals
  const dailyTotals = finalChartData.reduce((acc, item) => {
    const date = format(item.date, 'yyyy-MM-dd')
    acc[date] = (acc[date] || 0) + item.value
    return acc
  }, {} as Record<string, number>)

  // Calculate average daily usage (excluding missing days)
  const numberOfDays = Object.keys(dailyTotals).length
  const averageDailyUsage = Object.values(dailyTotals).reduce((sum, value) => sum + value, 0) / numberOfDays

  // Get highest daily total
  const highestDailyTotal = Math.max(...Object.values(dailyTotals))
  const highestDailyDate = Object.entries(dailyTotals)
    .find(([_, value]) => value === highestDailyTotal)?.[0]

  // Custom tooltip component with debugging
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const closest = payload[0].payload as DataPoint;
      console.log('Tooltip Data:', {
        label,
        formattedDate: closest.formattedDate,
        actualDate: closest.actualDate,
        value: closest.value,
        previousValue: closest.previousValue
      })
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{closest.formattedDate}</div>
                {closest.actualDate && (
                  <div className="text-sm text-muted-foreground">({closest.actualDate})</div>
                )}
              </div>
              <div className="flex flex-col items-end">
                <div>{closest.value.toFixed(2)}kWh</div>
                {showPreviousPeriod && closest.previousValue > 0 && (
                  <div className="text-sm text-muted-foreground">Previous: {closest.previousValue.toFixed(2)}kWh</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Calculate total cost including standing charges if available
  const calculateTotalCost = () => {
    // Calculate consumption cost
    const consumptionCost = ((total * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
      (finalChartData.filter(item => item.price).length * 100))
    
    // Add standing charges if available
    if (standingCharge && numberOfDays > 0) {
      const totalStandingCharge = (standingCharge * numberOfDays) / 100 // Convert pence to pounds
      return (consumptionCost + totalStandingCharge).toFixed(2)
    }
    
    return consumptionCost.toFixed(2)
  }

  // Calculate daily cost including standing charge
  const calculateDailyCost = () => {
    const dailyConsumptionCost = ((averageDailyUsage * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
      (finalChartData.filter(item => item.price).length * 100))
    
    if (standingCharge) {
      const dailyStandingCharge = standingCharge / 100 // Convert pence to pounds
      return (dailyConsumptionCost + dailyStandingCharge).toFixed(2)
    }
    
    return dailyConsumptionCost.toFixed(2)
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        <Card className="p-4" style={{ borderColor: 'white' }}>
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold">{total.toFixed(2)} kWh</div>
            <div className="text-sm text-muted-foreground">Total {unit}</div>
            <div className="text-xs text-muted-foreground">
              Over {numberOfDays} days
            </div>
            {rates && (
              <div className="mt-4 space-y-2 border-t pt-2">
                <div className="text-xl font-semibold text-foreground">
                  £{calculateTotalCost()}
                </div>
                {standingCharge && (
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Usage:</span>
                      <span className="text-right">£{((total * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (finalChartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Standing charge:</span>
                      <span className="text-right">£{((standingCharge * numberOfDays) / 100).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-center mt-1">
                      ({(standingCharge).toFixed(2)}p/day)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: TURQUOISE }}>
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold">{averageDailyUsage.toFixed(2)} kWh</div>
            <div className="text-sm text-muted-foreground">Average {unit}/day</div>
            <div className="text-xs text-muted-foreground">
              ({validValues.length} valid readings)
            </div>
            {rates && (
              <div className="mt-4 space-y-2 border-t pt-2">
                <div className="text-xl font-semibold text-foreground">
                  £{calculateDailyCost()}/day
                </div>
                {standingCharge && (
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Usage:</span>
                      <span className="text-right">£{((averageDailyUsage * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (finalChartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Standing charge:</span>
                      <span className="text-right">£{(standingCharge / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: BRIGHT_RED_BORDER }}>
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold">{highestDailyTotal.toFixed(2)} kWh</div>
            <div className="text-sm text-muted-foreground">Peak Daily Total</div>
            {highestDailyDate && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(highestDailyDate), 'MMM d')}
              </div>
            )}
            {rates && (
              <div className="mt-4 space-y-2 border-t pt-2">
                <div className="text-xl font-semibold text-foreground">
                  £{(((highestDailyTotal * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                    (finalChartData.filter(item => item.price).length * 100)) + (standingCharge ? standingCharge / 100 : 0)).toFixed(2)}
                </div>
                {standingCharge && (
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Usage:</span>
                      <span className="text-right">£{((highestDailyTotal * finalChartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (finalChartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Standing charge:</span>
                      <span className="text-right">£{(standingCharge / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {rates && (
          <>
            <Card className="p-4" style={{ borderColor: LOW_COLOR }}>
              <div className="text-center space-y-2">
                {(() => {
                  const validPrices = finalChartData.filter(item => item.price).map(item => item.price || 0)
                  const lowestPrice = Math.min(...validPrices)
                  const lowestPriceRate = rates?.reduce((acc, rate) => {
                    const currentDiff = Math.abs(rate.value_inc_vat - lowestPrice)
                    const accDiff = Math.abs((acc?.value_inc_vat ?? 0) - lowestPrice)
                    return currentDiff < accDiff ? rate : acc
                  }, null as (typeof rates)[0] | null)
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {lowestPrice.toFixed(2)}p
                      </div>
                      <div className="text-sm text-muted-foreground">Lowest Price</div>
                      <div className="text-xs text-muted-foreground">per kWh</div>
                      {lowestPriceRate && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(lowestPriceRate.valid_from), 'MMM d, HH:mm')}
                        </div>
                      )}
                    </>
                  )
                })()}
                <div className="mt-4 space-y-2 border-t pt-2">
                  <div className="text-sm text-muted-foreground">
                    Cost at this rate:
                  </div>
                  <div className="grid gap-1 text-sm">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per day:</span>
                      <span className="text-right">£{((averageDailyUsage * Math.min(...finalChartData.filter(item => item.price).map(item => item.price || 0))) / 100).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per month:</span>
                      <span className="text-right">£{((averageDailyUsage * Math.min(...finalChartData.filter(item => item.price).map(item => item.price || 0)) * 30) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: VIVID_PURPLE }}>
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold">
                  {(finalChartData.reduce((sum, item) => sum + (item.price || 0), 0) / 
                    finalChartData.filter(item => item.price).length).toFixed(2)}p
                </div>
                <div className="text-sm text-muted-foreground">Average Price</div>
                <div className="text-xs text-muted-foreground">per kWh</div>
                <div className="mt-4 space-y-2 border-t pt-2">
                  <div className="text-sm text-muted-foreground">
                    Cost at this rate:
                  </div>
                  <div className="grid gap-1 text-sm">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per day:</span>
                      <span className="text-right">£{((averageDailyUsage * (finalChartData.reduce((sum, item) => sum + (item.price || 0), 0) / 
                        finalChartData.filter(item => item.price).length)) / 100).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per month:</span>
                      <span className="text-right">£{((averageDailyUsage * (finalChartData.reduce((sum, item) => sum + (item.price || 0), 0) / 
                        finalChartData.filter(item => item.price).length) * 30) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: BRIGHT_RED_BORDER }}>
              <div className="text-center space-y-2">
                {(() => {
                  const validPrices = finalChartData.filter(item => item.price).map(item => item.price || 0)
                  const peakPrice = Math.max(...validPrices)
                  const peakPriceRate = rates?.reduce((acc, rate) => {
                    const currentDiff = Math.abs(rate.value_inc_vat - peakPrice)
                    const accDiff = Math.abs((acc?.value_inc_vat ?? 0) - peakPrice)
                    return currentDiff < accDiff ? rate : acc
                  }, null as (typeof rates)[0] | null)
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {peakPrice.toFixed(2)}p
                      </div>
                      <div className="text-sm text-muted-foreground">Peak Price</div>
                      <div className="text-xs text-muted-foreground">per kWh</div>
                      {peakPriceRate && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(peakPriceRate.valid_from), 'MMM d, HH:mm')}
                        </div>
                      )}
                    </>
                  )
                })()}
                <div className="mt-4 space-y-2 border-t pt-2">
                  <div className="text-sm text-muted-foreground">
                    Cost at this rate:
                  </div>
                  <div className="grid gap-1 text-sm">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per day:</span>
                      <span className="text-right">£{((averageDailyUsage * Math.max(...finalChartData.filter(item => item.price).map(item => item.price || 0))) / 100).toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Per month:</span>
                      <span className="text-right">£{((averageDailyUsage * Math.max(...finalChartData.filter(item => item.price).map(item => item.price || 0)) * 30) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
      
      {/* Previous Period Stats Grid */}
      {showPreviousPeriod && previousPeriodData && (
        <>
          <h4 className="text-lg font-semibold mt-8 mb-4">Previous Period</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            <Card className="p-4" style={{ borderColor: ORANGE_BORDER }}>
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold">
                  {previousPeriodData.reduce((sum, r) => sum + r.consumption, 0).toFixed(2)} kWh
                </div>
                <div className="text-sm text-muted-foreground">Total {unit}</div>
                <div className="text-xs text-muted-foreground">
                  Over {Object.keys(previousPeriodTotals || {}).length} days
                </div>
                {rates && previousPeriodStats && (
                  <div className="mt-4 space-y-2 border-t pt-2">
                    <div className="text-xl font-semibold text-foreground">
                      £{((previousPeriodData.reduce((sum, r) => sum + r.consumption, 0) * previousPeriodStats.averagePrice) / 100).toFixed(2)}
                    </div>
                    {standingCharge && (
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Usage:</span>
                          <span className="text-right">£{((previousPeriodData.reduce((sum, r) => sum + r.consumption, 0) * previousPeriodStats.averagePrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Standing charge:</span>
                          <span className="text-right">£{((standingCharge * Object.keys(previousPeriodTotals || {}).length) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: BRIGHT_PINK }}>
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold">{previousDailyAverage.toFixed(2)} kWh</div>
                <div className="text-sm text-muted-foreground">Average {unit}/day</div>
                <div className="text-xs text-muted-foreground">
                  ({previousPeriodData.length} readings)
                </div>
                {rates && previousPeriodStats && (
                  <div className="mt-4 space-y-2 border-t pt-2">
                    <div className="text-xl font-semibold text-foreground">
                      £{((previousDailyAverage * previousPeriodStats.averagePrice) / 100).toFixed(2)}/day
                    </div>
                    {standingCharge && (
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Usage:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.averagePrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Standing charge:</span>
                          <span className="text-right">£{(standingCharge / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: BRIGHT_RED_BORDER }}>
              <div className="text-center space-y-2">
                {(() => {
                  const dailyTotals = Object.values(previousPeriodTotals || {}).map(day => day.total)
                  const highestDaily = Math.max(...dailyTotals)
                  const highestDate = Object.entries(previousPeriodTotals || {}).find(([_, data]) => data.total === highestDaily)?.[0]
                  return (
                    <>
                      <div className="text-2xl font-bold">{highestDaily.toFixed(2)} kWh</div>
                      <div className="text-sm text-muted-foreground">Peak Daily Total</div>
                      {highestDate && (
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(highestDate), 'MMM d')}
                        </div>
                      )}
                      {rates && previousPeriodStats && (
                        <div className="mt-4 space-y-2 border-t pt-2">
                          <div className="text-xl font-semibold text-foreground">
                            £{((highestDaily * previousPeriodStats.averagePrice) / 100 + 
                              (standingCharge ? standingCharge / 100 : 0)).toFixed(2)}
                          </div>
                          {standingCharge && (
                            <div className="grid gap-1 text-sm text-muted-foreground">
                              <div className="grid grid-cols-2 items-center">
                                <span className="text-left">Usage:</span>
                                <span className="text-right">£{((highestDaily * previousPeriodStats.averagePrice) / 100).toFixed(2)}</span>
                              </div>
                              <div className="grid grid-cols-2 items-center">
                                <span className="text-left">Standing charge:</span>
                                <span className="text-right">£{(standingCharge / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </Card>

            {rates && previousPeriodStats && (
              <>
                <Card className="p-4" style={{ borderColor: LOW_COLOR }}>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold">
                      {previousPeriodStats.lowestPrice.toFixed(2)}p
                    </div>
                    <div className="text-sm text-muted-foreground">Lowest Price</div>
                    <div className="text-xs text-muted-foreground">per kWh</div>
                    <div className="mt-4 space-y-2 border-t pt-2">
                      <div className="text-sm text-muted-foreground">
                        Cost at this rate:
                      </div>
                      <div className="grid gap-1 text-sm">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per day:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.lowestPrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per month:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.lowestPrice * 30) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-4" style={{ borderColor: VIVID_PURPLE }}>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold">
                      {previousPeriodStats.averagePrice.toFixed(2)}p
                    </div>
                    <div className="text-sm text-muted-foreground">Average Price</div>
                    <div className="text-xs text-muted-foreground">per kWh</div>
                    <div className="mt-4 space-y-2 border-t pt-2">
                      <div className="text-sm text-muted-foreground">
                        Cost at this rate:
                      </div>
                      <div className="grid gap-1 text-sm">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per day:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.averagePrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per month:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.averagePrice * 30) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-4" style={{ borderColor: BRIGHT_RED_BORDER }}>
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold">
                      {previousPeriodStats.peakPrice.toFixed(2)}p
                    </div>
                    <div className="text-sm text-muted-foreground">Peak Price</div>
                    <div className="text-xs text-muted-foreground">per kWh</div>
                    <div className="mt-4 space-y-2 border-t pt-2">
                      <div className="text-sm text-muted-foreground">
                        Cost at this rate:
                      </div>
                      <div className="grid gap-1 text-sm">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per day:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.peakPrice) / 100).toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-left">Per month:</span>
                          <span className="text-right">£{((previousDailyAverage * previousPeriodStats.peakPrice * 30) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Chart Area */}
      <Card className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              >
                <Info className="w-5 h-5 stroke-[2] text-foreground [shape-rendering:geometricPrecision]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-semibold">Chart Legend</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-foreground" />
                    <span>Consumption ({unit})</span>
                  </div>
                  {rates && !showPreviousPeriod && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-0.5" style={{ backgroundColor: VIVID_PURPLE }} />
                      <span>Price (p/kWh)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4" style={{ backgroundColor: ORANGE }} />
                    <span>Missing Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ backgroundColor: TURQUOISE }} />
                    <span>Current Average</span>
                  </div>
                  {showPreviousPeriod && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5" style={{ backgroundColor: PREVIOUS_PERIOD_COLOR, borderStyle: 'dashed' }} />
                        <span>Previous Period Data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5" style={{ backgroundColor: BRIGHT_PINK, borderStyle: 'dashed' }} />
                        <span>Previous Period Average</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>This chart shows your energy consumption over time{rates ? ' along with the unit price' : ''}. The orange bars indicate periods where data is missing or incomplete. The reference lines show the average daily usage for both current and previous periods.</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="h-[300px] lg:h-[400px] 2xl:h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={finalChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                interval={2}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                yAxisId="consumption"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value.toFixed(1)}`}
                label={{ 
                  value: unit,
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'hsl(var(--muted-foreground))'
                }}
              />
              {rates && (
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${value.toFixed(0)}p`}
                  label={{ 
                    value: 'Price (p/kWh)',
                    angle: 90,
                    position: 'insideRight',
                    fill: 'hsl(var(--muted-foreground))'
                  }}
                />
              )}
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                yAxisId="consumption"
                y={averageDailyUsage}
                stroke={TURQUOISE}
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{
                  value: `Avg: ${averageDailyUsage.toFixed(1)} ${unit}`,
                  fill: TURQUOISE,
                  position: 'insideLeft',
                  offset: +12,
                  dy: -12
                }}
              />
              {showPreviousPeriod && previousDailyAverage > 0 && (
                <ReferenceLine
                  yAxisId="consumption"
                  y={previousDailyAverage}
                  stroke={BRIGHT_PINK}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Prev Avg: ${previousDailyAverage.toFixed(1)} ${unit}`,
                    fill: BRIGHT_PINK,
                    position: 'insideRight',
                    offset: +20,
                    dy: -12
                  }}
                />
              )}
              <Line
                yAxisId="consumption"
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--foreground))' }}
              />
              {showPreviousPeriod && (
                <Line
                  yAxisId="consumption"
                  type="monotone"
                  dataKey="previousValue"
                  stroke={PREVIOUS_PERIOD_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Previous Period"
                  connectNulls={true}
                />
              )}
              {rates && !showPreviousPeriod && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke={VIVID_PURPLE}
                  strokeWidth={2}
                  dot={false}
                  name="Price"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
} 