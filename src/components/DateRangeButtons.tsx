import { Button } from "@/components/ui/button"
import { DateRange } from "react-day-picker"
import { startOfDay, endOfDay, subDays } from "date-fns"

interface DateRangeButtonsProps {
  onSelect: (range: DateRange) => void
  disabled?: boolean
}

export function DateRangeButtons({ onSelect, disabled }: DateRangeButtonsProps) {
  const handleSelect = (days: number) => {
    const now = new Date()
    
    if (days === 0) {
      // Today
      onSelect({
        from: startOfDay(now),
        to: endOfDay(now)
      })
    } else if (days === 1) {
      // Yesterday
      const yesterday = subDays(now, 1)
      onSelect({
        from: startOfDay(yesterday),
        to: endOfDay(yesterday)
      })
    } else {
      // Last N days
      onSelect({
        from: startOfDay(subDays(now, days - 1)),
        to: endOfDay(now)
      })
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(0)}
        disabled={disabled}
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(1)}
        disabled={disabled}
      >
        Yesterday
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(7)}
        disabled={disabled}
      >
        Last 7 Days
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(30)}
        disabled={disabled}
      >
        Last 30 Days
      </Button>
    </div>
  )
} 