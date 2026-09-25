import {
  cloneElement,
  type ComponentType,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Building2,
  BusFront,
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
  MessageSquareHeart,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SearchX,
  ShieldCheck,
  Star,
  TriangleAlert,
  Upload,
  UserRound,
  Users,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import {
  IconAnnouncement,
  IconBarangay,
  IconBus,
  IconCalculator,
  IconDiscount,
  IconDistance,
  IconDriver,
  IconEncoder,
  IconEnforcer,
  IconEvidence,
  IconFareCheck,
  IconHabal,
  IconHistory,
  IconIncident,
  IconJeepney,
  IconMulticab,
  IconOrdinance,
  IconPayment,
  IconPermit,
  IconQrScan,
  IconReport,
  IconRoute,
  IconTraffic,
  IconTricycle,
  IconVan,
  IconViolation,
} from '@/components/BrandIcons'

// Brand-kit icons take the same size/strokeWidth/className props as lucide.
type BrandIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
export type DashboardIcon = LucideIcon | BrandIcon | ReactNode
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
  announcements: IconAnnouncement,
  barangay: IconBarangay,
  approval: Clock3,
  audio: AudioLines,
  back: ArrowLeft,
  brand: BusFront,
  building: Building2,
  camera: Camera,
  calculator: IconCalculator,
  check: CheckCircle2,
  checkmark: Check,
  chevronDown: ChevronDown,
  close: X,
  copy: Copy,
  danger: AlertCircle,
  dashboard: LayoutDashboard,
  discount: IconDiscount,
  distance: IconDistance,
  evidence: IconEvidence,
  fare: IconFareCheck,
  feedback: MessageSquareHeart,
  file: File,
  fileText: FileText,
  folder: FolderOpen,
  home: House,
  history: IconHistory,
  image: Image,
  info: Info,
  incidents: IconIncident,
  inspect: Search,
  key: KeyRound,
  loader: LoaderCircle,
  list: ClipboardList,
  logout: LogOut,
  mail: Mail,
  // Ordinance 105 and the issuances that amend it.
  ordinance: IconOrdinance,
  map: MapPinned,
  menu: Menu,
  phone: Phone,
  plus: Plus,
  reports: TriangleAlert,
  refresh: RefreshCw,
  // Filing a report (public side); `incidents` stays for the enforcement queue.
  report: IconReport,
  reset: RotateCcw,
  routes: IconRoute,
  rural: Leaf,
  safe: ShieldCheck,
  star: Star,
  searchX: SearchX,
  // A violation ticket issued on an incident; `payment` is settling one.
  ticket: IconViolation,
  payment: IconPayment,
  permit: IconPermit,
  qrScan: IconQrScan,
  traffic: IconTraffic,
  upload: Upload,
  user: UserRound,
  users: Users,
  driver: IconDriver,
  enforcer: IconEnforcer,
  encoder: IconEncoder,
  vehicle: IconJeepney,
  // The two rides Basey FareCheck is deployed for.
  tricycle: IconTricycle,
  motorbike: IconHabal,
  video: Film,
  view: Eye,
  storage: HardDrive,
  arrowRight: ArrowRight,
} as const

/** One icon per Prisma `VehicleType`; unknown values fall back to `vehicle`. */
export const VEHICLE_TYPE_ICONS: Record<string, DashboardIcon> = {
  JEEPNEY: IconJeepney,
  TRICYCLE: IconTricycle,
  HABAL_HABAL: IconHabal,
  MULTICAB: IconMulticab,
  BUS: IconBus,
  VAN: IconVan,
}

/** Role badge icons. ADMIN and PUBLIC have no kit drawing and show none. */
export const USER_TYPE_ICONS: Record<string, DashboardIcon | undefined> = {
  DRIVER: IconDriver,
  ENFORCER: IconEnforcer,
  DATA_ENCODER: IconEncoder,
}

export function getDashboardIconChipClasses(
  tone: DashboardIconTone = 'slate',
) {
  const toneClasses: Record<DashboardIconTone, string> = {
    slate: 'border-slate-200 bg-slate-100 text-slate-600',
    blue: 'border-blue-200 bg-blue-100 text-blue-700',
    emerald: 'border-primary/20 bg-surface-tint text-primary-dark',
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
