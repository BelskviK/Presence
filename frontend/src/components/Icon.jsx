import * as Lucide from 'lucide-react';

// Maps the kebab-case icon names used throughout the design to their
// lucide-react PascalCase component exports.
const NAME_MAP = {
  'layout-dashboard': 'LayoutDashboard',
  'calendar-days': 'CalendarDays',
  plane: 'Plane',
  wallet: 'Wallet',
  'bar-chart-3': 'BarChart3',
  users: 'Users',
  'map-pin': 'MapPin',
  clock: 'Clock',
  search: 'Search',
  bell: 'Bell',
  globe: 'Globe',
  'log-in': 'LogIn',
  'log-out': 'LogOut',
  coffee: 'Coffee',
  square: 'Square',
  play: 'Play',
  repeat: 'Repeat',
  'arrow-right': 'ArrowRight',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  download: 'Download',
  'pencil-line': 'PencilLine',
  'sliders-horizontal': 'SlidersHorizontal',
  'user-plus': 'UserPlus',
  'more-horizontal': 'MoreHorizontal',
  x: 'X',
  plus: 'Plus',
  'file-text': 'FileText',
  sheet: 'Sheet',
  'calendar-days-2': 'CalendarDays',
  trash: 'Trash2',
  check: 'Check',
  'chevron-down': 'ChevronDown',
};

export default function Icon({ name, className = 'w-4 h-4', strokeWidth = 1.5, ...rest }) {
  const Cmp = Lucide[NAME_MAP[name] || name];
  if (!Cmp) return null;
  return <Cmp className={className} strokeWidth={strokeWidth} {...rest} />;
}
