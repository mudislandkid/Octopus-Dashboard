import { Button } from "@/components/ui/button"
import { DateRange } from "react-day-picker"
import { startOfDay, endOfDay, subDays } from "date-fns"

interface DateRangeButtonsProps {
  onSelect: (range: DateRange | undefined) => void
  disabled?: boolean
}

export function DateRangeButtons({ onSelect, disabled }: DateRangeButtonsProps) {
  const now = new Date()

  const handleSelect = (days: number) => {
    onSelect({
      from: startOfDay(subDays(now, days - 1)),
      to: endOfDay(now)
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(1)}
        disabled={disabled}
        className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(2)}
        disabled={disabled}
        className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
      >
        Yesterday
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(7)}
        disabled={disabled}
        className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
      >
        7 Days
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleSelect(30)}
        disabled={disabled}
        className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
      >
        30 Days
      </Button>
    </>
  )
} 