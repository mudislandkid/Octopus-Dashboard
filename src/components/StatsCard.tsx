import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardProps {
  title: string
  value: string | number
  unit?: string
  description: string
  loading?: boolean
}

export function StatsCard({ title, value, unit, description, loading = false }: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">
            {value}
            {unit && <span className="ml-1 text-xl font-normal text-muted-foreground">{unit}</span>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
} 