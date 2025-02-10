import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="bg-[#0f1729] border-b border-[#1d2839]">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg className="w-8 h-8 text-[#40E0D0]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <h1 className="text-2xl font-bold">Octopus Energy Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">Help</Button>
            <Button variant="outline" size="sm">Settings</Button>
          </div>
        </div>
      </div>
    </header>
  )
} 