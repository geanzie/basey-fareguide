import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BadgePercent,
  Banknote,
  Building2,
  BusFront,
  Calculator,
  Camera,
  Copy,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Info,
  Eye,
  File,
  FileText,
  Film,
  FolderOpen,
  HardDrive,
  History,
  House,
  Image,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  LogOut,
  KeyRound,
  Mail,
  MapPinned,
  Menu,
  Megaphone,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  X,
  CarFront,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

export type DashboardIcon = LucideIcon | ReactNode
export type DashboardIconTone =
  | 'slate'
  | 'blue'
  | 'emerald'
  | 'red'
  | 'violet'
  | 'amber'
  | 'purple'

export const DASHBOARD_ICON_POLICY = {
  sizes: {
    button: 18,
    tab: 18,
    card: 20,
    section: 20,
  alert: 20,
  hero: 24,
  empty: 24,
  brand: 22,
  },
  gaps: {
    inline: 'gap-2',
    block: 'gap-3',
  },
  placements: {
    allowed: [
      'card header',
      'section header',
      'alert prefix',
      'empty state',
      'action button prefix',
      'tab support icon',
    ],
    restricted: [
      'icon-only action controls',
      'decorative icon spam inside dense data rows',
      'multiple unrelated icons inside one card',
    ],
  },
} as const

export const DASHBOARD_ICONS = {
  announcements: Megaphone,
  approval: Clock3,
  audio: AudioLines,
  back: ArrowLeft,
  brand: BusFront,
  building: Building2,
  camera: Camera,
  calculator: Calculator,
  check: CheckCircle2,
  checkmark: Check,
  chevronDown: ChevronDown,
  close: X,
  copy: Copy,
  danger: AlertCircle,
  dashboard: LayoutDashboard,
  discount: BadgePercent,
  evidence: Paperclip,
  fare: Banknote,
  file: File,
  fileText: FileText,
  folder: FolderOpen,
  home: House,
  history: History,
  image: Image,
  info: Info,
  incidents: ShieldAlert,
  inspect: Search,
  key: KeyRound,
  loader: LoaderCircle,
  list: ClipboardList,
  logout: LogOut,
  mail: Mail,
  map: MapPinned,
  menu: Menu,
  phone: Phone,
  plus: Plus,
  reports: TriangleAlert,
  refresh: RefreshCw,
  reset: RotateCcw,
  routes: Route,
  rural: Leaf,
  safe: ShieldCheck,
  searchX: SearchX,
  ticket: Ticket,
  upload: Upload,
  user: UserRound,
  users: Users,
  vehicle: CarFront,
  video: Film,
  view: Eye,
  storage: HardDrive,
  arrowRight: ArrowRight,
} as const

export function getDashboardIconChipClasses(
  tone: DashboardIconTone = 'slate',
) {
  const toneClasses: Record<DashboardIconTone, string> = {
    slate: 'border-slate-200 bg-slate-100 text-slate-600',
    blue: 'border-blue-200 bg-blue-100 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    red: 'border-red-200 bg-red-100 text-red-700',
    violet: 'border-violet-200 bg-violet-100 text-violet-700',
    amber: 'border-amber-200 bg-amber-100 text-amber-700',
    purple: 'border-purple-200 bg-purple-100 text-purple-700',
  }

  return `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClasses[tone]}`
}

export function DashboardIconSlot({
  icon,
  size = DASHBOARD_ICON_POLICY.sizes.card,
  className = '',
  strokeWidth = 2,
}: {
  icon?: DashboardIcon
  size?: number
  className?: string
  strokeWidth?: number
}) {
  if (!icon) {
    return null
  }

  const normalizedClassName = ['shrink-0', className].filter(Boolean).join(' ')

  if (isValidElement(icon)) {
    const iconElement = icon as ReactElement<LucideProps & { className?: string }>

    return cloneElement(iconElement, {
      'aria-hidden': true,
      className: [normalizedClassName, iconElement.props.className]
        .filter(Boolean)
        .join(' '),
      size: iconElement.props.size ?? size,
      strokeWidth: iconElement.props.strokeWidth ?? strokeWidth,
    })
  }

  if (
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && 'render' in icon)
  ) {
    const Icon = icon as LucideIcon
    return (
      <Icon
        aria-hidden="true"
        className={normalizedClassName}
        size={size}
        strokeWidth={strokeWidth}
      />
    )
  }

  return (
    <span aria-hidden="true" className={normalizedClassName}>
      {icon}
    </span>
  )
}
