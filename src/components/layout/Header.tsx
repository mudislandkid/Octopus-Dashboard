import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3v3m0 12v3M5.636 5.636l2.122 2.122m8.484 8.484l2.122 2.122M3 12h3m12 0h3M5.636 18.364l2.122-2.122m8.484-8.484l2.122-2.122" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-2xl font-bold">Octopus Energy</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm">Help</Button>
          <Button variant="outline" size="sm">Settings</Button>
        </div>
      </div>
    </header>
  )
} 