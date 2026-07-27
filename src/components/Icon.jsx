import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Ear,
  ExternalLink,
  FileText,
  List,
  Megaphone,
  MessageCircle,
  Newspaper,
  Paperclip,
  Pencil,
  RefreshCw,
  Siren,
  Sparkles,
  X,
} from 'lucide-react'

/**
 * Renders a Lucide icon by kebab-case name (matches the design system's
 * naming, e.g. "arrow-right"). Single source for icon rendering so no
 * component reaches for an emoji or unicode glyph instead.
 *
 * Deliberate divergence from representdc-main's Icon.jsx, which resolves
 * names against `import * as icons from 'lucide-react'`. That namespace
 * import defeats tree-shaking and pulls the whole library into the bundle
 * (measured here 2026-07-26: +934 kB raw / +173 kB gzip). Icons are
 * registered explicitly below instead — adding one means adding a line here.
 */
const ICONS = {
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'arrow-right': ArrowRight,
  calendar: Calendar,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  circle: Circle,
  download: Download,
  ear: Ear,
  'external-link': ExternalLink,
  'file-text': FileText,
  list: List,
  megaphone: Megaphone,
  'message-circle': MessageCircle,
  newspaper: Newspaper,
  paperclip: Paperclip,
  pencil: Pencil,
  'refresh-cw': RefreshCw,
  siren: Siren,
  sparkles: Sparkles,
  x: X,
}

function Icon({ name, size = 20, className = '' }) {
  const Component = ICONS[name]
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`Icon: unregistered name "${name}" — add it to ICONS in Icon.jsx`)
    }
    return null
  }
  return <Component size={size} className={`icon ${className}`} aria-hidden="true" />
}

export default Icon
