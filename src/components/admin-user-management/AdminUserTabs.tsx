'use client'

type AdminTab = 'users' | 'create' | 'password-reset'

interface AdminUserTabsProps {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}

const TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'users', label: 'User Directory' },
  { key: 'create', label: 'Create Official User' },
  { key: 'password-reset', label: 'Password Reset' },
]

export default function AdminUserTabs({ activeTab, onTabChange }: AdminUserTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex flex-wrap gap-6 px-6" aria-label="User management sections">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === tab.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
