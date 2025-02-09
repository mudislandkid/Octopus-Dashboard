import React from 'react'
import { Consumption } from '../../lib/types/api'
import { Card } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { format, parseISO, startOfDay, getHours } from 'date-fns'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

// Add color constants
const PEAK_COLOR = 'rgba(255, 71, 71, 0.9)'  // Brighter red
const LOW_COLOR = 'rgba(46, 213, 115, 0.9)'  // Bright green
const DEFAULT_COLOR = 'hsl(var(--primary))'

interface DailyPatternChartProps {
  data: Consumption[] | null
  loading: boolean
  type: 'electricity' | 'gas'
}

interface HourlyData {
  hour: string
  value: number
  readings: number
  isPeak?: boolean
  isLowest?: boolean
}

export function DailyPatternChart({ data, loading, type }: DailyPatternChartProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats Grid Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
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

  // Group data by hour of day and calculate averages
  const hourlyAverages: HourlyData[] = new Array(24).fill(null).map((_, hour) => {
    const readingsForHour = data.filter(reading => {
      if (!reading.interval_start) return false
      try {
        const readingTime = parseISO(reading.interval_start)
        return getHours(readingTime) === hour
      } catch (error) {
        console.error('Error parsing date:', error)
        return false
      }
    })

    // Each hour should have 2 readings (30-minute intervals)
    const validReadings = readingsForHour.filter(reading => 
      reading.consumption !== undefined && !isNaN(reading.consumption)
    )

    if (validReadings.length === 0) {
      return {
        hour: format(new Date().setHours(hour, 0, 0, 0), 'HH:mm'),
        value: 0,
        readings: 0
      }
    }

    // Sum up all readings for this hour
    const hourlyTotal = validReadings.reduce((sum, reading) => 
      sum + reading.consumption, 0
    )

    // Calculate average per interval, accounting for number of readings
    return {
      hour: format(new Date().setHours(hour, 0, 0, 0), 'HH:mm'),
      value: hourlyTotal / validReadings.length,
      readings: validReadings.length
    }
  })

  // Find peak and off-peak hours
  const max = Math.max(...hourlyAverages.map(h => h.value))
  const min = Math.min(...hourlyAverages.filter(h => h.value > 0).map(h => h.value))
  const peakHour = hourlyAverages.findIndex(h => h.value === max)
  const offPeakHour = hourlyAverages.findIndex(h => h.value === min)

  // Mark peak and lowest hours in the data
  const enhancedHourlyAverages = hourlyAverages.map((hour, index) => ({
    ...hour,
    isPeak: index === peakHour,
    isLowest: index === offPeakHour
  }))

  // Calculate total consumption for the day
  const totalConsumption = hourlyAverages.reduce((sum, hour) => sum + hour.value, 0)

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-2 !bg-background/95 backdrop-blur-sm">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-sm text-muted-foreground">
            {payload[0].value.toFixed(2)} kWh/h
          </div>
          <div className="text-xs text-muted-foreground">
            ({payload[0].payload.readings} readings)
          </div>
        </Card>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4" style={{ borderColor: PEAK_COLOR }}>
          <div className="text-center">
            <div className="text-2xl font-bold">{format(new Date().setHours(peakHour, 0, 0, 0), 'HH:mm')}</div>
            <div className="text-sm text-muted-foreground">Peak Usage Time</div>
            <div className="text-sm font-medium">{max.toFixed(2)} kWh/h</div>
          </div>
        </Card>
        <Card className="p-4" style={{ borderColor: LOW_COLOR }}>
          <div className="text-center">
            <div className="text-2xl font-bold">{format(new Date().setHours(offPeakHour, 0, 0, 0), 'HH:mm')}</div>
            <div className="text-sm text-muted-foreground">Lowest Usage Time</div>
            <div className="text-sm font-medium">{min.toFixed(2)} kWh/h</div>
          </div>
        </Card>
      </div>
      
      {/* Chart Area */}
      <Card className="p-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={enhancedHourlyAverages}
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" />
              <XAxis
                dataKey="hour"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `${value.toFixed(1)}`}
                label={{ 
                  value: 'kWh/h',
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'hsl(var(--muted-foreground))'
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.8}
              >
                {
                  enhancedHourlyAverages.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isPeak ? PEAK_COLOR : entry.isLowest ? LOW_COLOR : DEFAULT_COLOR}
                      stroke={entry.isPeak ? PEAK_COLOR : entry.isLowest ? LOW_COLOR : DEFAULT_COLOR}
                    />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
} 