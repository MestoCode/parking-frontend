export const ROUTE_SOURCE_ID = 'navigation-route'
export const ROUTE_GLOW_LAYER_ID = 'navigation-route-glow'
export const ROUTE_LAYER_ID = 'navigation-route-line'

export const ROUTE_COLOR = '#2fc077'
export const ROUTE_GLOW_COLOR = '#7dffb2'
export const ROUTE_NEON_BLUE_COLOR = '#67e8f9'

export const ROUTE_MARKER_CLASSES = {
  container: 'relative flex h-14 w-14 items-center justify-center',
  tooltip:
    'absolute -top-9 whitespace-nowrap rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-lg',
  outerPulse:
    'absolute h-12 w-12 animate-ping rounded-full border border-emerald-100/35 bg-emerald-300/18 shadow-[0_0_22px_rgba(47,192,119,0.5)]',
  innerHalo:
    'absolute h-8 w-8 rounded-full border border-emerald-50/65 bg-emerald-300/25 shadow-[0_0_18px_rgba(47,192,119,0.55)]',
  centerDot:
    'relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_18px_rgba(47,192,119,0.75)]',
  icon: 'h-4 w-4 fill-white',
}

export const CUSTOM_MARKER_CLASSES = {
  container: 'relative flex h-12 w-12 items-center justify-center',
  halo:
    'absolute h-10 w-10 rounded-full border border-cyan-100/60 bg-cyan-300/15 shadow-[0_0_22px_rgba(103,232,249,0.65)]',
  dot: 'relative h-4 w-4 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]',
}

export const ROUTE_GLOW_PAINT = {
  'line-width': 20,
  'line-opacity': 0.62,
  'line-blur': 8,
  'line-emissive-strength': 0.9,
}

export const ROUTE_LINE_PAINT = {
  'line-width': 10,
  'line-opacity': 0.92,
  'line-blur': 0,
  'line-emissive-strength': 1.2,
}
