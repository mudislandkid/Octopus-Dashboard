import React from 'react'
import { Consumption, Rate } from '../../lib/types/api'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { format, parseISO, startOfDay, endOfDay, differenceInDays, addDays } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
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
}

interface ChartDataPoint {
  date: string
  value: number
  formattedDate: string
  hasData: boolean
}

interface MissingZone {
  start: string;
  end: string;
}

// Add a constant for our bright red color with transparency
const BRIGHT_RED = 'rgba(255, 80, 80, 0.4)'
const BRIGHT_RED_BORDER = 'rgba(255, 80, 80, 1.0)'

// Add constant for turquoise color
const TURQUOISE = 'rgba(64, 224, 208, 0.8)'

export function ConsumptionChart({ title, data, rates, unit, loading = false }: ConsumptionChartProps) {
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

  // Get the date range from the data
  const firstDate = parseISO(sortedData[0].interval_start)
  const lastDate = parseISO(sortedData[sortedData.length - 1].interval_end)
  const endOfLastDate = endOfDay(lastDate)  // Get end of the last day
  const daysDifference = differenceInDays(endOfLastDate, firstDate)

  console.log('Date range:', {
    firstDate: firstDate.toISOString(),
    lastDate: lastDate.toISOString(),
    endOfLastDate: endOfLastDate.toISOString(),
    daysDifference
  })

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
              formattedDate: format(parseISO(reading.interval_start), 'MMM d'),
              hasData: true,
              readingCount: 0
            }
          }
          acc[dateKey].value += reading.consumption || 0
          acc[dateKey].readingCount += 1
          return acc
        }, {} as Record<string, ChartDataPoint & { readingCount: number }>)
      ).map(([date, data]) => ({
        date: data.date,
        value: data.value,
        formattedDate: data.formattedDate,
        hasData: data.readingCount >= 40 && data.value > 0  // Must have enough readings AND some consumption
      }))
    : sortedData.map(reading => ({
        date: format(parseISO(reading.interval_start), 'yyyy-MM-dd'),
        value: reading.consumption || 0,
        formattedDate: format(parseISO(reading.interval_start), 'HH:mm'),
        hasData: reading.consumption > 0
      }))

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

  console.log('Readings per day:', readingsPerDay)

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
      console.log(`Processing date ${date} with ${readings} readings`)
      
      if (readings < 40) { // Less than 40 readings for the day (expecting 48 for half-hourly)
        if (!currentZone && lastGoodDate) {
          // Start zone from the last good date
          const newZone: MissingZone = { start: lastGoodDate, end: date }
          currentZone = newZone
          console.log(`Starting new zone from ${lastGoodDate} to ${date}`)
        } else if (currentZone) {
          currentZone.end = date
          console.log(`Extending zone to ${date}`)
        }
      } else { // Good day (>= 40 readings)
        if (currentZone) {
          // End the current zone with this good day
          currentZone.end = date
          console.log(`Ending zone at ${date}`)
          missingZones.push(currentZone)
          currentZone = null
        }
        lastGoodDate = date
        console.log(`Setting last good date to ${date}`)
      }
    })

  // Handle case where we end with missing data
  if (currentZone) {
    // If we have more dates in our chart range, find the next date
    const lastDate = Array.from(expectedDates.keys()).sort().pop()!
    const nextDate = format(addDays(parseISO(lastDate), 1), 'yyyy-MM-dd')
    const finalZone: MissingZone = { 
      start: currentZone.start, 
      end: nextDate 
    }
    console.log(`Ending final zone at ${nextDate}`)
    missingZones.push(finalZone)
  }

  console.log('Missing zones based on readings:', missingZones)

  console.log('Chart data points:', chartData.length)

  // Mark dates that have actual data
  chartData.forEach(point => {
    expectedDates.set(point.date, point.hasData)
  })

  console.log('Expected dates:', Array.from(expectedDates.entries()))

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

  console.log('Full chart data:', fullChartData)

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

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{total.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total {unit}</div>
            <div className="text-xs text-muted-foreground">
              Over {numberOfDays} days
            </div>
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: TURQUOISE }}>
          <div className="text-center">
            <div className="text-2xl font-bold">{averageDailyUsage.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Average {unit}/day</div>
            <div className="text-xs text-muted-foreground">
              ({validValues.length} valid readings)
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{highestDailyTotal.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Peak Daily Total</div>
            {highestDailyDate && (
              <div className="text-xs text-muted-foreground">
                {format(parseISO(highestDailyDate), 'MMM d')}
              </div>
            )}
          </div>
        </Card>
      </div>
      
      {/* Chart Area */}
      <Card className="p-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={fullChartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                interval={daysDifference > 15 ? 2 : 0}
              />
              <YAxis
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
              <Tooltip content={<CustomTooltip />} />
              {/* Add reference line for average */}
              <ReferenceLine
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
                    dataKey="missingData"
                    data={fullChartData.map(point => ({
                      ...point,
                      missingData: !point.hasData ? maxValue : undefined
                    }))}
                    fill={BRIGHT_RED}
                    stroke={BRIGHT_RED_BORDER}
                    fillOpacity={0.8}
                    strokeOpacity={1}
                  />
                )
              })()}
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--foreground))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
} 