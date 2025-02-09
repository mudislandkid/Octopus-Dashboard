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
  rates?: Rate[] | null
  unit: string
  loading?: boolean
  standingCharge?: number  // Standing charge in pence per day (inc VAT)
}

interface ChartDataPoint {
  date: string
  value: number
  price?: number
  formattedDate: string
  hasData: boolean
}

interface MissingZone {
  start: string
  end: string
}

// Add a constant for our bright red color with transparency
const BRIGHT_RED_BORDER = 'rgba(255, 80, 80, 1.0)'
const ORANGE = 'rgba(255, 165, 0, 0.4)'
const ORANGE_BORDER = 'rgba(255, 165, 0, 1.0)'

// Add constant for turquoise color
const TURQUOISE = 'rgba(64, 224, 208, 0.8)'
// Add constant for vivid purple
const VIVID_PURPLE = 'rgba(161, 0, 255, 0.8)'
// Add constant for bright green (from DailyPatternChart)
const LOW_COLOR = 'rgba(46, 213, 115, 0.9)'

export function ConsumptionChart({ title, data, rates, unit, loading = false, standingCharge }: ConsumptionChartProps) {
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
  if (rates) {
    // For gas, we just use the single fixed rate for all intervals
    if (rates.length === 1 && rates[0].payment_method === 'direct_debit_monthly') {
      const fixedRate = rates[0].value_inc_vat
      // Use the same fixed rate for all data points
      sortedData.forEach(reading => {
        rateMap.set(format(parseISO(reading.interval_start), "yyyy-MM-dd'T'HH:mm:ss'Z'"), fixedRate)
      })
    } else {
      // For electricity, continue with the existing time-based rate lookup
      rates.forEach(rate => {
        const startTime = new Date(rate.valid_from)
        if (!isNaN(startTime.getTime())) {
          const key = format(startTime, "yyyy-MM-dd'T'HH:mm:ss'Z'")
          rateMap.set(key, rate.value_inc_vat)
        }
      })
    }
  }

  // Get the date range from the data
  const firstDate = parseISO(sortedData[0].interval_start)
  const lastDate = parseISO(sortedData[sortedData.length - 1].interval_end)
  const endOfLastDate = endOfDay(lastDate)
  const daysDifference = differenceInDays(endOfLastDate, firstDate)

  // Process data for chart and mark dates with data
  const chartData = daysDifference > 1
    ? Object.entries(
        // Group and sum by day
        sortedData.reduce((acc, reading) => {
          const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
          if (!acc[dateKey]) {
            acc[dateKey] = {
              date: dateKey,
              value: 0,
              price: rates?.length === 1 ? rates[0].value_inc_vat : 0, // For gas, use the fixed rate
              formattedDate: format(parseISO(reading.interval_start), 'MMM d'),
              hasData: true,
              readingCount: 0,
              priceReadings: 0
            }
          }
          acc[dateKey].value += reading.consumption || 0
          // For electricity, average the rates. For gas, keep the fixed rate
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
      ).map(([date, data]) => ({
        date: data.date,
        value: data.value,
        price: data.price,
        formattedDate: data.formattedDate,
        hasData: data.readingCount >= 40 && data.value > 0
      }))
    : sortedData.map(reading => {
        const dateTime = parseISO(reading.interval_start)
        // For gas, use the fixed rate. For electricity, look up the rate
        const price = rates?.length === 1 ? rates[0].value_inc_vat : rateMap.get(format(dateTime, "yyyy-MM-dd'T'HH:mm:ss'Z'"))
        return {
          date: format(dateTime, 'yyyy-MM-dd'),
          value: reading.consumption || 0,
          price,
          formattedDate: format(dateTime, 'HH:mm'),
          hasData: reading.consumption > 0
        }
      })

  // Sort chart data
  chartData.sort((a, b) => a.date.localeCompare(b.date))

  // Group data by date to count readings
  const readingsPerDay = sortedData.reduce((acc, reading) => {
    const dateKey = format(parseISO(reading.interval_start), 'yyyy-MM-dd')
    if (!acc[dateKey]) {
      acc[dateKey] = 0
    }
    acc[dateKey]++
    return acc
  }, {} as Record<string, number>)

  // Create a map of expected dates and mark the ones we have data for
  const expectedDates = new Map<string, boolean>()
  for (let i = 0; i <= daysDifference; i++) {
    const date = format(addDays(firstDate, i), 'yyyy-MM-dd')
    expectedDates.set(date, false)
  }

  // Find missing data zones based on number of readings
  const missingZones: MissingZone[] = []
  let currentZone: MissingZone | null = null
  let lastGoodDate: string | null = null

  // Process all expected dates
  Array.from(expectedDates.keys())
    .sort()
    .forEach(date => {
      const readings = readingsPerDay[date] || 0
      
      if (readings < 40) { // Less than 40 readings for the day (expecting 48 for half-hourly)
        if (!currentZone && lastGoodDate) {
          // Start zone from the last good date
          currentZone = { start: lastGoodDate, end: date }
        } else if (currentZone) {
          currentZone.end = date
        }
      } else { // Good day (>= 40 readings)
        if (currentZone) {
          // End the current zone with this good day
          currentZone.end = date
          missingZones.push(currentZone)
          currentZone = null
        }
        lastGoodDate = date
      }
    })

  // Handle case where we end with missing data
  if (currentZone) {
    // If we have more dates in our chart range, find the next date
    const lastDate = Array.from(expectedDates.keys()).sort().pop()!
    const nextDate = format(addDays(parseISO(lastDate), 1), 'yyyy-MM-dd')
    missingZones.push({
      start: currentZone.start,
      end: nextDate
    })
  }

  // Mark dates that have actual data
  chartData.forEach(point => {
    expectedDates.set(point.date, point.hasData)
  })

  // Add missing dates to chart data with zero values
  const allDates = Array.from(expectedDates.keys()).sort()
  const fullChartData = allDates.map(date => {
    const existingData = chartData.find(d => d.date === date)
    if (existingData) {
      return existingData
    }
    return {
      date,
      value: 0,
      formattedDate: format(parseISO(date), 'MMM d'),
      hasData: false
    }
  })

  // Calculate statistics
  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  const validValues = chartData.map(item => item.value).filter(value => value > 0)
  const average = validValues.length > 0 ? total / validValues.length : 0

  // Calculate daily totals
  const dailyTotals = chartData.reduce((acc, item) => {
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

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <Card className="p-2 !bg-background/95 backdrop-blur-sm">
          <div className="text-sm font-medium">{data.formattedDate}</div>
          <div className="text-sm text-muted-foreground">
            {data.value.toFixed(2)} {unit}
          </div>
          {data.price && (
            <div className="text-sm text-muted-foreground">
              {data.price.toFixed(2)} p/kWh
            </div>
          )}
          {!data.hasData && (
            <div className="text-xs" style={{ color: BRIGHT_RED_BORDER }}>
              Data not available
            </div>
          )}
        </Card>
      )
    }
    return null
  }

  // Calculate total cost including standing charges if available
  const calculateTotalCost = () => {
    // Calculate consumption cost
    const consumptionCost = ((total * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
      (chartData.filter(item => item.price).length * 100))
    
    // Add standing charges if available
    if (standingCharge && numberOfDays > 0) {
      const totalStandingCharge = (standingCharge * numberOfDays) / 100 // Convert pence to pounds
      return (consumptionCost + totalStandingCharge).toFixed(2)
    }
    
    return consumptionCost.toFixed(2)
  }

  // Calculate daily cost including standing charge
  const calculateDailyCost = () => {
    const dailyConsumptionCost = ((averageDailyUsage * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
      (chartData.filter(item => item.price).length * 100))
    
    if (standingCharge) {
      const dailyStandingCharge = standingCharge / 100 // Convert pence to pounds
      return (dailyConsumptionCost + dailyStandingCharge).toFixed(2)
    }
    
    return dailyConsumptionCost.toFixed(2)
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold">{total.toFixed(2)}</div>
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
                      <span className="text-right">£{((total * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (chartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
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
            <div className="text-2xl font-bold">{averageDailyUsage.toFixed(2)}</div>
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
                      <span className="text-right">£{((averageDailyUsage * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (chartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
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
            <div className="text-2xl font-bold">{highestDailyTotal.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Peak Daily Total</div>
            {highestDailyDate && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(highestDailyDate), 'MMM d')}
              </div>
            )}
            {rates && (
              <div className="mt-4 space-y-2 border-t pt-2">
                <div className="text-xl font-semibold text-foreground">
                  £{(((highestDailyTotal * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                    (chartData.filter(item => item.price).length * 100)) + (standingCharge ? standingCharge / 100 : 0)).toFixed(2)}
                </div>
                {standingCharge && (
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div className="grid grid-cols-2 items-center">
                      <span className="text-left">Usage:</span>
                      <span className="text-right">£{((highestDailyTotal * chartData.reduce((sum, item) => sum + (item.price || 0), 0)) / 
                        (chartData.filter(item => item.price).length * 100)).toFixed(2)}</span>
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
                <div className="text-2xl font-bold">
                  {Math.min(...chartData.filter(item => item.price).map(item => item.price || 0)).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Lowest Price</div>
                <div className="text-xs text-muted-foreground">p/kWh</div>
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: VIVID_PURPLE }}>
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold">
                  {(chartData.reduce((sum, item) => sum + (item.price || 0), 0) / 
                    chartData.filter(item => item.price).length).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Average Price</div>
                <div className="text-xs text-muted-foreground">p/kWh</div>
              </div>
            </Card>
            <Card className="p-4" style={{ borderColor: BRIGHT_RED_BORDER }}>
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold">
                  {Math.max(...chartData.map(item => item.price || 0)).toFixed(2)}
                </div>
                <div className="text-sm text-muted-foreground">Peak Price</div>
                <div className="text-xs text-muted-foreground">p/kWh</div>
              </div>
            </Card>
          </>
        )}
      </div>
      
      {/* Chart Area */}
      <Card className="p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-transparent">
                <Info className="h-4 w-4 text-foreground hover:text-foreground/80" />
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
                  {rates && (
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
                    <span>Average Daily Usage</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>This chart shows your energy consumption over time{rates ? ' along with the unit price' : ''}. The orange bars indicate periods where data is missing or incomplete. The dashed turquoise line shows your average daily usage.</p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={fullChartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                interval={daysDifference > 15 ? 2 : 0}
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
              {/* Add reference line for average */}
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
                  offset: +6,
                  dy: -12
                }}
              />
              {/* Calculate max value for scaling the missing data bars */}
              {(() => {
                const maxValue = Math.max(...fullChartData.map(d => d.value))
                return (
                  <Bar
                    yAxisId="consumption"
                    dataKey="missingData"
                    data={fullChartData.map(point => ({
                      ...point,
                      missingData: !point.hasData ? maxValue : undefined
                    }))}
                    fill={ORANGE}
                    stroke={ORANGE_BORDER}
                    fillOpacity={0.8}
                    strokeOpacity={1}
                  />
                )
              })()}
              <Line
                yAxisId="consumption"
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--foreground))' }}
              />
              {rates && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="price"
                  stroke={VIVID_PURPLE}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: VIVID_PURPLE }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
} 