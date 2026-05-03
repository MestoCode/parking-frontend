import { motion } from 'motion/react'

type NavbarControlProps = {
  isMapVisible: boolean
  isSidebarCollapsed: boolean
  onHomeClick: () => void
  onLoginClick: () => void
}

const NAVBAR_LINKS = ['Map', 'Zones', 'Pricing', 'Support']

function ParkingLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="h-9 w-9"
      fill="none"
    >
      <rect width="40" height="40" rx="12" fill="#059669" />
      <path
        d="M12 27V13h9.2c3.7 0 6.2 2.25 6.2 5.65 0 3.45-2.5 5.72-6.2 5.72h-4.35V27H12Zm4.85-6.55h3.78c1.3 0 2.08-.68 2.08-1.8 0-1.08-.78-1.75-2.08-1.75h-3.78v3.55Z"
        fill="white"
      />
      <path
        d="M27.5 27.75a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
        fill="#BBF7D0"
      />
    </svg>
  )
}

export function NavbarControl({
  isMapVisible,
  isSidebarCollapsed,
  onHomeClick,
  onLoginClick,
}: NavbarControlProps) {
  const sidebarOffset = isMapVisible ? (isSidebarCollapsed ? 88 : 352) : 0
  const isFloating = isMapVisible

  return (
    <motion.nav
      initial={{ opacity: 0, y: -18, filter: 'blur(10px)' }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        paddingLeft: sidebarOffset ? sidebarOffset + 16 : 0,
        paddingRight: isFloating ? 16 : 0,
        paddingTop: isFloating ? 16 : 0,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-40"
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={`pointer-events-auto mx-auto flex w-full items-center justify-between gap-3 border border-zinc-200 bg-white/90 px-3 py-2 shadow-[0_18px_70px_rgba(39,39,42,0.14)] backdrop-blur-xl ${
          isFloating
            ? 'max-w-6xl rounded-2xl'
            : 'max-w-none rounded-none border-x-0 border-t-0'
        }`}
      >
        <button
          type="button"
          onClick={onHomeClick}
          className="flex min-w-0 items-center gap-3 rounded-xl pr-2 text-left transition hover:bg-zinc-50"
          aria-label="Go back to homepage"
        >
          <ParkingLogo />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-zinc-950">
              Park Mesh
            </p>
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700">
              Smart parking
            </p>
          </div>
        </button>

        <div className="hidden items-center gap-1 rounded-xl bg-zinc-50 p-1 md:flex">
          {NAVBAR_LINKS.map((link, index) => (
            <button
              key={link}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                index === 0
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-zinc-500 hover:bg-white hover:text-zinc-950'
              }`}
            >
              {link}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
            <span className="text-xs font-semibold text-emerald-800">
              Live
            </span>
          </div>
          <button
            type="button"
            onClick={onLoginClick}
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_28px_rgba(24,24,27,0.22)] transition hover:bg-emerald-600"
          >
            Login
          </button>
        </div>
      </motion.div>
    </motion.nav>
  )
}
