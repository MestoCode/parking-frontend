import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  type AdminNode,
  type AdminNodeFilters,
  type AdminZone,
  createAdminNode,
  createAdminZone,
  listAdminNodes,
  listAdminZoneNodes,
  listAdminZones,
  moveAdminNodeToZone,
} from '../../services/adminApi'
import { listLiveDevices, type LiveDevice } from '../../services/devicesApi'

type InternalDashboardProps = {
  onBackToMap: () => void
  onSignOut: () => void | Promise<void>
}

type DashboardSection = 'Overview' | 'Zones' | 'Nodes' | 'Transfer Zone' | 'Payments'

const DASHBOARD_LINKS: DashboardSection[] = ['Overview', 'Zones', 'Nodes', 'Transfer Zone', 'Payments']
const NODE_STATUSES = ['UNKNOWN', 'AVAILABLE', 'OCCUPIED', 'DISABLED', 'MAINTENANCE']

const inputClasses =
  'mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/45 px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-emerald-300/60'

function getRecordLabel(record: AdminNode | AdminZone | undefined, fallback: string) {
  if (!record) {
    return fallback
  }

  return String(record.name || record.title || record.label || record.id || fallback)
}

function getRecordId(record: AdminNode | AdminZone | undefined) {
  if (!record) {
    return ''
  }

  return String(record.id || record._id || '')
}

function getNodeZoneId(node: AdminNode) {
  const zone = node.zone

  if (typeof zone === 'object' && zone && 'id' in zone) {
    return String((zone as { id?: string }).id ?? '')
  }

  if (typeof zone === 'object' && zone && '_id' in zone) {
    return String((zone as { _id?: string })._id ?? '')
  }

  return String(node.zoneId || '')
}

function getNodeStatusTheme(status: unknown, isOnline?: boolean) {
  if (isOnline === false) {
    return {
      dot: 'bg-white',
      ping: 'bg-white',
      badge: 'border-white/15 bg-white/8 text-white/70',
      label: 'Offline',
    }
  }

  switch (String(status ?? '').toUpperCase()) {
    case 'AVAILABLE':
      return {
        dot: 'bg-emerald-300',
        ping: 'bg-emerald-300',
        badge: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
        label: 'Available',
      }
    case 'OCCUPIED':
      return {
        dot: 'bg-rose-400',
        ping: 'bg-rose-400',
        badge: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
        label: 'Occupied',
      }
    case 'MAINTENANCE':
      return {
        dot: 'bg-amber-300',
        ping: 'bg-amber-300',
        badge: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
        label: 'Maintenance',
      }
    case 'DISABLED':
      return {
        dot: 'bg-orange-400',
        ping: 'bg-orange-400',
        badge: 'border-orange-300/25 bg-orange-400/10 text-orange-100',
        label: 'Disabled',
      }
    default:
      return {
        dot: 'bg-cyan-300',
        ping: 'bg-cyan-300',
        badge: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
        label: 'Unknown',
      }
  }
}

function PulsingStatusDot({ status, isOnline }: { status?: unknown; isOnline?: boolean }) {
  const theme = getNodeStatusTheme(status, isOnline)

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-45 ${theme.ping}`} />
      <span className={`relative h-2.5 w-2.5 rounded-full shadow-[0_0_14px_rgba(255,255,255,0.28)] ${theme.dot}`} />
    </span>
  )
}

function getZoneStatusTheme(zone: AdminZone) {
  const isActive = zone.isActive !== false

  return {
    label: isActive ? 'Active' : 'Inactive',
    dot: isActive ? 'bg-emerald-300' : 'bg-white',
    ping: isActive ? 'bg-emerald-300' : 'bg-white',
    badge: isActive
      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
      : 'border-white/15 bg-white/8 text-white/65',
  }
}

function PulsingZoneDot({ zone }: { zone: AdminZone }) {
  const theme = getZoneStatusTheme(zone)

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${theme.ping}`} />
      <span className={`relative h-2.5 w-2.5 rounded-full ${theme.dot}`} />
    </span>
  )
}

function LoadingSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

function DashboardLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className="h-10 w-10" fill="none">
      <rect width="40" height="40" rx="13" fill="#059669" />
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

export function InternalDashboard({ onBackToMap, onSignOut }: InternalDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('Overview')
  const [zones, setZones] = useState<AdminZone[]>([])
  const [nodes, setNodes] = useState<AdminNode[]>([])
  const [liveDevices, setLiveDevices] = useState<LiveDevice[]>([])
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true)
  const [isCreatingZone, setIsCreatingZone] = useState(false)
  const [isCreatingNode, setIsCreatingNode] = useState(false)
  const [isFilteringNodes, setIsFilteringNodes] = useState(false)
  const [isMovingNode, setIsMovingNode] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [zoneForm, setZoneForm] = useState({
    name: '',
    city: '',
    description: '',
    isActive: true,
  })
  const [nodeForm, setNodeForm] = useState({
    nodeUid: '',
    name: '',
    zoneId: '',
    latitude: '',
    longitude: '',
    status: 'UNKNOWN',
    batteryLevel: '100',
    signalStrength: '-55',
    firmwareVersion: '1.0.0',
    isOnline: false,
  })
  const [nodeFilters, setNodeFilters] = useState({
    zoneId: '',
    status: '',
    isOnline: 'all',
  })
  const [moveNodeOptions, setMoveNodeOptions] = useState<AdminNode[]>([])
  const [isLoadingMoveNodes, setIsLoadingMoveNodes] = useState(false)
  const [moveForm, setMoveForm] = useState({
    fromZoneId: '',
    nodeId: '',
    zoneId: '',
  })

  const onlineNodeCount = useMemo(
    () => nodes.filter((node) => node.isOnline === true).length,
    [nodes],
  )
  const availableNodeCount = useMemo(
    () =>
      nodes.filter((node) => String(node.status ?? '').toLowerCase() === 'available').length,
    [nodes],
  )
  const displayedNodes = useMemo(
    () =>
      selectedZoneId
        ? nodes.filter((node) => getNodeZoneId(node) === selectedZoneId)
        : nodes,
    [nodes, selectedZoneId],
  )
  const selectedZone = useMemo(
    () => zones.find((zone) => getRecordId(zone) === selectedZoneId),
    [selectedZoneId, zones],
  )
  const zoneOptions = useMemo(
    () =>
      zones
        .map((zone, index) => ({
          id: getRecordId(zone),
          label: getRecordLabel(zone, `Zone ${index + 1}`),
        }))
        .filter((zone) => zone.id),
    [zones],
  )
  const zoneNameById = useMemo(
    () => new Map(zoneOptions.map((zone) => [zone.id, zone.label])),
    [zoneOptions],
  )
  const getNodeZoneName = useCallback(
    (node: AdminNode) => {
      const zone = node.zone

      if (typeof zone === 'object' && zone) {
        return getRecordLabel(zone as AdminZone, 'Unknown zone')
      }

      const zoneId = getNodeZoneId(node)

      if (!zoneId) {
        return 'Not assigned'
      }

      return zoneNameById.get(zoneId) ?? 'Unknown zone'
    },
    [zoneNameById],
  )
  const selectedMoveSourceZone = useMemo(
    () => zoneOptions.find((zone) => zone.id === moveForm.fromZoneId),
    [moveForm.fromZoneId, zoneOptions],
  )
  const selectedMoveTargetZone = useMemo(
    () => zoneOptions.find((zone) => zone.id === moveForm.zoneId),
    [moveForm.zoneId, zoneOptions],
  )
  const selectedMoveNode = useMemo(
    () => moveNodeOptions.find((node) => getRecordId(node) === moveForm.nodeId),
    [moveForm.nodeId, moveNodeOptions],
  )
  const isWaitingForBackend =
    isLoadingDashboard ||
    isCreatingZone ||
    isCreatingNode ||
    isFilteringNodes ||
    isLoadingMoveNodes ||
    isMovingNode ||
    isSigningOut

  const refreshDashboardData = useCallback(async () => {
    setIsLoadingDashboard(true)
    setDashboardError('')

    try {
      const [zonesResponse, nodesResponse, liveDevicesResponse] = await Promise.all([
        listAdminZones(),
        listAdminNodes(),
        listLiveDevices(),
      ])

      setZones(zonesResponse)
      setNodes(nodesResponse)
      setLiveDevices(liveDevicesResponse)
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : 'Failed to load dashboard data.',
      )
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [])

  useEffect(() => {
    void refreshDashboardData()
  }, [refreshDashboardData])

  useEffect(() => {
    if (!moveForm.fromZoneId) {
      setMoveNodeOptions([])
      setMoveForm((currentForm) => ({ ...currentForm, nodeId: '' }))
      return
    }

    let shouldCancel = false

    setIsLoadingMoveNodes(true)
    listAdminZoneNodes(moveForm.fromZoneId)
      .then((zoneNodes) => {
        if (shouldCancel) {
          return
        }

        setMoveNodeOptions(zoneNodes)
        setMoveForm((currentForm) => ({ ...currentForm, nodeId: '' }))
      })
      .catch((error) => {
        if (shouldCancel) {
          return
        }

        setMoveNodeOptions([])
        setActionError(
          error instanceof Error ? error.message : 'Failed to load nodes for selected zone.',
        )
      })
      .finally(() => {
        if (!shouldCancel) {
          setIsLoadingMoveNodes(false)
        }
      })

    return () => {
      shouldCancel = true
    }
  }, [moveForm.fromZoneId])

  const resetActionState = () => {
    setActionMessage('')
    setActionError('')
  }

  const handleCreateZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetActionState()

    if (!zoneForm.name.trim() || !zoneForm.city.trim()) {
      setActionError('Zone name and city are required.')
      return
    }

    setIsCreatingZone(true)

    try {
      const zone = await createAdminZone({
        name: zoneForm.name.trim(),
        city: zoneForm.city.trim(),
        description: zoneForm.description.trim(),
        isActive: zoneForm.isActive,
      })

      setActionMessage(`Zone created: ${getRecordLabel(zone, 'New zone')}`)
      setZoneForm({ name: '', city: '', description: '', isActive: true })
      await refreshDashboardData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create zone.')
    } finally {
      setIsCreatingZone(false)
    }
  }

  const handleCreateNode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetActionState()

    if (
      !nodeForm.nodeUid.trim() ||
      !nodeForm.name.trim() ||
      !nodeForm.zoneId.trim() ||
      !nodeForm.latitude ||
      !nodeForm.longitude
    ) {
      setActionError('Node UID, name, zone, latitude, and longitude are required.')
      return
    }

    setIsCreatingNode(true)

    try {
      const node = await createAdminNode({
        nodeUid: nodeForm.nodeUid.trim(),
        name: nodeForm.name.trim(),
        zoneId: nodeForm.zoneId.trim(),
        latitude: Number(nodeForm.latitude),
        longitude: Number(nodeForm.longitude),
        status: nodeForm.status,
        batteryLevel: Number(nodeForm.batteryLevel),
        signalStrength: Number(nodeForm.signalStrength),
        firmwareVersion: nodeForm.firmwareVersion.trim(),
        isOnline: nodeForm.isOnline,
      })

      setActionMessage(`Node created: ${getRecordLabel(node, 'New node')}`)
      setNodeForm({
        nodeUid: '',
        name: '',
        zoneId: '',
        latitude: '',
        longitude: '',
        status: 'UNKNOWN',
        batteryLevel: '100',
        signalStrength: '-55',
        firmwareVersion: '1.0.0',
        isOnline: false,
      })
      await refreshDashboardData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create node.')
    } finally {
      setIsCreatingNode(false)
    }
  }

  const handleMoveNode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetActionState()

    if (!moveForm.fromZoneId || !moveForm.nodeId || !moveForm.zoneId) {
      setActionError('Choose a source zone, node, and target zone.')
      return
    }

    if (moveForm.fromZoneId === moveForm.zoneId) {
      setActionError('Choose a different target zone.')
      return
    }

    setIsMovingNode(true)

    try {
      await moveAdminNodeToZone(moveForm.nodeId.trim(), moveForm.zoneId.trim())
      setActionMessage('Node moved to the selected zone.')
      setMoveForm({ fromZoneId: '', nodeId: '', zoneId: '' })
      setMoveNodeOptions([])
      await refreshDashboardData()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to move node.')
    } finally {
      setIsMovingNode(false)
    }
  }

  const handleApplyNodeFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetActionState()

    const filters: AdminNodeFilters = {
      zoneId: nodeFilters.zoneId.trim() || undefined,
      status: nodeFilters.status || undefined,
      isOnline:
        nodeFilters.isOnline === 'all' ? undefined : nodeFilters.isOnline === 'true',
    }

    setIsFilteringNodes(true)

    try {
      const filteredNodes = await listAdminNodes(filters)

      setNodes(filteredNodes)
      setActionMessage('Node filters applied.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to filter nodes.')
    } finally {
      setIsFilteringNodes(false)
    }
  }

  const handleZoneSelection = (zoneId: string) => {
    setSelectedZoneId((currentZoneId) => (currentZoneId === zoneId ? '' : zoneId))
    setActiveSection('Overview')
  }

  const handleSignOutClick = async () => {
    setIsSigningOut(true)

    try {
      await onSignOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  const renderOverview = () => (
    <div className="grid gap-4">
      <div className="rounded-4xl border border-white/10 bg-zinc-950/35 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Zones</h3>
            <p className="mt-1 text-sm text-white/45">
              Select a zone to focus the node list. Click it again to clear.
            </p>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/55">
            {selectedZone
              ? `Selected: ${getRecordLabel(selectedZone, 'Zone')}`
              : isLoadingDashboard
                ? 'Loading'
                : `${zones.length} total`}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(isLoadingDashboard ? Array.from({ length: 3 }) : zones).map((zone, index) => {
            const zoneRecord = zone as AdminZone
            const zoneId = getRecordId(zoneRecord)
            const zoneTheme = isLoadingDashboard ? null : getZoneStatusTheme(zoneRecord)
            const isSelected = Boolean(zoneId && selectedZoneId === zoneId)
            const zoneNodesCount = zoneId
              ? nodes.filter((node) => getNodeZoneId(node) === zoneId).length
              : 0

            return (
              <button
                key={isLoadingDashboard ? index : zoneId || index}
                type="button"
                onClick={() => {
                  if (zoneId) {
                    handleZoneSelection(zoneId)
                  }
                }}
                className={`rounded-3xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-emerald-300/45 bg-emerald-300/12 shadow-[0_22px_60px_rgba(16,185,129,0.12)]'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/7'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    {!isLoadingDashboard && <PulsingZoneDot zone={zoneRecord} />}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">
                        {isLoadingDashboard
                          ? 'Loading zone...'
                          : getRecordLabel(zoneRecord, `Zone ${index + 1}`)}
                      </span>
                      <span className="mt-1 block text-xs text-white/40">
                        {isLoadingDashboard ? 'Fetching zones' : `${zoneNodesCount} nodes`}
                      </span>
                    </span>
                  </span>
                  {!isLoadingDashboard && zoneTheme && (
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${zoneTheme.badge}`}
                    >
                      {isSelected ? 'Selected' : zoneTheme.label}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-4xl border border-white/10 bg-zinc-950/35 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Nodes</h3>
            <p className="mt-1 text-sm text-white/45">
              {selectedZone
                ? `Showing nodes attached to ${getRecordLabel(selectedZone, 'selected zone')}.`
                : 'Showing all loaded nodes.'}
            </p>
          </div>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/55">
            {isLoadingDashboard ? 'Loading' : `${displayedNodes.length} visible`}
          </span>
        </div>
        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          {(isLoadingDashboard ? Array.from({ length: 4 }) : displayedNodes).map(
            (node, index) => {
              const nodeRecord = node as AdminNode
              const statusTheme = isLoadingDashboard
                ? null
                : getNodeStatusTheme(nodeRecord.status, nodeRecord.isOnline)

              return (
              <div
                key={isLoadingDashboard ? index : getRecordId(nodeRecord) || index}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 transition hover:border-white/18 hover:bg-white/7"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {!isLoadingDashboard && (
                    <PulsingStatusDot status={nodeRecord.status} isOnline={nodeRecord.isOnline} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {isLoadingDashboard
                        ? 'Loading node...'
                        : getRecordLabel(nodeRecord, `Node ${index + 1}`)}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {isLoadingDashboard
                        ? 'Fetching nodes'
                        : `Zone: ${getNodeZoneName(nodeRecord)}`}
                    </p>
                  </div>
                </div>
                {!isLoadingDashboard && statusTheme && (
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTheme.badge}`}
                  >
                    {statusTheme.label}
                  </span>
                )}
              </div>
              )
            },
          )}
          {!isLoadingDashboard && displayedNodes.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm font-semibold text-white/45 xl:col-span-2">
              No nodes found for this zone.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-4xl border border-sky-400/20 bg-sky-500/6 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Live mesh devices</h3>
            <p className="mt-1 text-sm text-white/45">
              Real gateways and nodes reporting over the mesh network — distinct
              from the manually-created parking nodes above.
            </p>
          </div>
          <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-bold text-sky-200">
            {isLoadingDashboard ? 'Loading' : `${liveDevices.length} live`}
          </span>
        </div>
        <div className="mt-4 grid gap-2 xl:grid-cols-2">
          {liveDevices.map((device) => {
            const isGateway = device.type === 'gateway'

            return (
              <div
                key={device.deviceId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 transition hover:border-white/18 hover:bg-white/7"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      isGateway ? 'bg-violet-400' : 'bg-sky-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{device.deviceId}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {device.latitude.toFixed(5)}, {device.longitude.toFixed(5)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                    isGateway
                      ? 'border-violet-400/30 bg-violet-400/10 text-violet-200'
                      : 'border-sky-400/30 bg-sky-400/10 text-sky-200'
                  }`}
                >
                  {device.type}
                </span>
              </div>
            )
          })}
          {!isLoadingDashboard && liveDevices.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm font-semibold text-white/45 xl:col-span-2">
              No live devices yet. Power on a gateway or node to see it appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderZones = () => (
    <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
      <form
        noValidate
        onSubmit={handleCreateZone}
        className="rounded-3xl border border-white/10 bg-zinc-950/35 p-4"
      >
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
          Create zone
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
          Name
          <input
            value={zoneForm.name}
            onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })}
            placeholder="Downtown Zone"
            className={inputClasses}
          />
        </label>
        <label className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
          City
          <input
            value={zoneForm.city}
            onChange={(event) => setZoneForm({ ...zoneForm, city: event.target.value })}
            placeholder="Amman"
            className={inputClasses}
          />
        </label>
        <label className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
          Description
          <textarea
            value={zoneForm.description}
            onChange={(event) =>
              setZoneForm({ ...zoneForm, description: event.target.value })
            }
            placeholder="Main smart parking zone"
            className={`${inputClasses} min-h-24 resize-none`}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-bold text-white/70">
          <input
            type="checkbox"
            checked={zoneForm.isActive}
            onChange={(event) => setZoneForm({ ...zoneForm, isActive: event.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
          Active zone
        </label>
        <button
          type="submit"
          disabled={isCreatingZone}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-500/45"
        >
          {isCreatingZone && <LoadingSpinner />}
          {isCreatingZone ? 'Creating zone...' : 'Create zone'}
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">All zones</h3>
          <button
            type="button"
            onClick={() => void refreshDashboardData()}
            disabled={isLoadingDashboard}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/12 disabled:cursor-wait disabled:opacity-55"
          >
            {isLoadingDashboard && <LoadingSpinner className="h-3.5 w-3.5" />}
            {isLoadingDashboard ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {zones.map((zone, index) => {
            const zoneTheme = getZoneStatusTheme(zone)

            return (
              <div
                key={getRecordId(zone) || index}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <PulsingZoneDot zone={zone} />
                    <span className="truncate font-semibold">
                      {getRecordLabel(zone, `Zone ${index + 1}`)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${zoneTheme.badge}`}
                  >
                    {zoneTheme.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/40">ID: {getRecordId(zone) || '--'}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderNodes = () => (
    <div className="overflow-hidden rounded-4xl border border-white/10 bg-zinc-950/35">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
          Node workspace
        </p>
        <p className="mt-1 text-sm text-white/45">
          Create, filter, and move parking nodes from one connected admin surface.
        </p>
      </div>

      <div className="grid gap-0 xl:grid-cols-[24rem_1fr]">
          <div className="border-b border-white/10 bg-white/2 p-4 xl:border-b-0 xl:border-r">
        <form
          noValidate
          onSubmit={handleCreateNode}
          className="rounded-3xl border border-white/10 bg-zinc-950/42 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)]"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            Create node
          </p>
          {[
            ['nodeUid', 'Node UID', 'esp32-node-001'],
            ['name', 'Name', 'Parking Node 1'],
            ['latitude', 'Latitude', '31.9539'],
            ['longitude', 'Longitude', '35.9106'],
          ].map(([key, label, placeholder]) => (
            <label
              key={key}
              className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-white/40"
            >
              {label}
              <input
                value={String(nodeForm[key as keyof typeof nodeForm])}
                onChange={(event) =>
                  setNodeForm({ ...nodeForm, [key]: event.target.value })
                }
                placeholder={placeholder}
                className={inputClasses}
              />
            </label>
          ))}
          <label className="mt-3 block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            Zone
            <select
              value={nodeForm.zoneId}
              onChange={(event) => setNodeForm({ ...nodeForm, zoneId: event.target.value })}
              className={inputClasses}
            >
              <option value="">Select zone</option>
              {zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Status
              <select
                value={nodeForm.status}
                onChange={(event) => setNodeForm({ ...nodeForm, status: event.target.value })}
                className={inputClasses}
              >
                {NODE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Firmware
              <input
                value={nodeForm.firmwareVersion}
                onChange={(event) =>
                  setNodeForm({ ...nodeForm, firmwareVersion: event.target.value })
                }
                className={inputClasses}
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Battery
              <input
                value={nodeForm.batteryLevel}
                onChange={(event) =>
                  setNodeForm({ ...nodeForm, batteryLevel: event.target.value })
                }
                className={inputClasses}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Signal
              <input
                value={nodeForm.signalStrength}
                onChange={(event) =>
                  setNodeForm({ ...nodeForm, signalStrength: event.target.value })
                }
                className={inputClasses}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-white/70">
            <input
              type="checkbox"
              checked={nodeForm.isOnline}
              onChange={(event) =>
                setNodeForm({ ...nodeForm, isOnline: event.target.checked })
              }
              className="h-4 w-4 accent-emerald-500"
            />
            Node is online
          </label>
          <button
            type="submit"
            disabled={isCreatingNode}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-wait disabled:bg-emerald-500/45"
          >
            {isCreatingNode && <LoadingSpinner />}
            {isCreatingNode ? 'Creating node...' : 'Create node'}
          </button>
        </form>

      </div>

      <div className="grid content-start gap-4 bg-zinc-950/15 p-4">
        <form
          noValidate
          onSubmit={handleApplyNodeFilters}
          className="rounded-3xl border border-white/10 bg-zinc-950/42 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              List nodes
            </p>
            <button
              type="submit"
              disabled={isFilteringNodes}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-zinc-950 disabled:cursor-wait disabled:bg-white/25 disabled:text-white/45"
            >
              {isFilteringNodes && <LoadingSpinner className="h-3.5 w-3.5" />}
              {isFilteringNodes ? 'Applying' : 'Apply filters'}
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <select
              value={nodeFilters.zoneId}
              onChange={(event) => setNodeFilters({ ...nodeFilters, zoneId: event.target.value })}
              className={inputClasses}
            >
              <option value="">Any zone</option>
              {zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
            <select
              value={nodeFilters.status}
              onChange={(event) => setNodeFilters({ ...nodeFilters, status: event.target.value })}
              className={inputClasses}
            >
              <option value="">Any status</option>
              {NODE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select
              value={nodeFilters.isOnline}
              onChange={(event) =>
                setNodeFilters({ ...nodeFilters, isOnline: event.target.value })
              }
              className={inputClasses}
            >
              <option value="all">Any online state</option>
              <option value="true">Online</option>
              <option value="false">Offline</option>
            </select>
          </div>
        </form>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/42 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Nodes</h3>
              <p className="mt-1 text-sm text-white/45">
                {selectedZone
                  ? `Filtered by ${getRecordLabel(selectedZone, 'selected zone')}`
                  : 'All loaded nodes'}
              </p>
            </div>
            {selectedZone && (
              <button
                type="button"
                onClick={() => setSelectedZoneId('')}
                className="rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/12"
              >
                Clear zone
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-2">
            {displayedNodes.map((node, index) => {
              const statusTheme = getNodeStatusTheme(node.status, node.isOnline)

              return (
                <div
                  key={getRecordId(node) || index}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 transition hover:border-white/18 hover:bg-white/7"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PulsingStatusDot status={node.status} isOnline={node.isOnline} />
                      <p className="truncate font-semibold">
                        {getRecordLabel(node, `Node ${index + 1}`)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusTheme.badge}`}
                    >
                      {statusTheme.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    ID: {getRecordId(node) || '--'} · Zone:{' '}
                    {getNodeZoneName(node)}
                  </p>
                </div>
              )
            })}
            {displayedNodes.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-8 text-center text-sm font-semibold text-white/45">
                No nodes found for this zone.
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )

  const renderTransfers = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(24rem,30rem)_1fr]">
      <form
        noValidate
        onSubmit={handleMoveNode}
        className="overflow-hidden rounded-4xl border border-emerald-300/15 bg-emerald-300/6 shadow-[0_24px_70px_rgba(0,0,0,0.16)]"
      >
        <div className="border-b border-emerald-300/12 bg-zinc-950/35 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            Node transfer
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Move node to zone
          </h3>
          <p className="mt-2 text-sm text-white/45">
            Transfer one parking node between zones in a controlled three-step flow.
          </p>
        </div>

        <div className="grid gap-3 p-5">
          <label className="block rounded-2xl border border-white/10 bg-zinc-950/35 p-3">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[11px] text-zinc-950">
                  1
                </span>
                From zone
              </span>
              <span className="truncate text-xs font-bold text-emerald-100">
                {selectedMoveSourceZone?.label ?? 'Choose source'}
              </span>
            </span>
            <select
              value={moveForm.fromZoneId}
              onChange={(event) =>
                setMoveForm({
                  fromZoneId: event.target.value,
                  nodeId: '',
                  zoneId: moveForm.zoneId === event.target.value ? '' : moveForm.zoneId,
                })
              }
              className={inputClasses}
            >
              <option value="">Select source zone</option>
              {zoneOptions.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>

          <div
            aria-hidden="true"
            className="mx-5 h-5 border-l border-dashed border-emerald-300/30"
          />

          <label
            className={`block rounded-2xl border p-3 transition ${
              moveForm.fromZoneId
                ? 'border-white/10 bg-zinc-950/35'
                : 'border-white/8 bg-zinc-950/20 opacity-65'
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-[11px] text-white">
                  2
                </span>
                Node
              </span>
              <span className="truncate text-xs font-bold text-white/70">
                {isLoadingMoveNodes ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner className="h-3.5 w-3.5" />
                    Loading
                  </span>
                ) : selectedMoveNode ? (
                  getRecordLabel(selectedMoveNode, 'Selected node')
                ) : (
                  'Choose node'
                )}
              </span>
            </span>
            <select
              value={moveForm.nodeId}
              onChange={(event) => setMoveForm({ ...moveForm, nodeId: event.target.value })}
              disabled={!moveForm.fromZoneId || isLoadingMoveNodes}
              className={inputClasses}
            >
              <option value="">
                {!moveForm.fromZoneId
                  ? 'Choose a source zone first'
                  : isLoadingMoveNodes
                    ? 'Loading nodes...'
                    : moveNodeOptions.length
                      ? 'Select node'
                      : 'No nodes in this zone'}
              </option>
              {moveNodeOptions.map((node, index) => {
                const nodeId = getRecordId(node)

                return (
                  <option key={nodeId || index} value={nodeId}>
                    {getRecordLabel(node, `Node ${index + 1}`)}
                  </option>
                )
              })}
            </select>
          </label>

          <div
            aria-hidden="true"
            className="mx-5 h-5 border-l border-dashed border-emerald-300/30"
          />

          <label
            className={`block rounded-2xl border p-3 transition ${
              moveForm.nodeId
                ? 'border-white/10 bg-zinc-950/35'
                : 'border-white/8 bg-zinc-950/20 opacity-65'
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-[11px] text-white">
                  3
                </span>
                To zone
              </span>
              <span className="truncate text-xs font-bold text-emerald-100">
                {selectedMoveTargetZone?.label ?? 'Choose target'}
              </span>
            </span>
            <select
              value={moveForm.zoneId}
              onChange={(event) => setMoveForm({ ...moveForm, zoneId: event.target.value })}
              disabled={!moveForm.nodeId}
              className={inputClasses}
            >
              <option value="">Select target zone</option>
              {zoneOptions
                .filter((zone) => zone.id !== moveForm.fromZoneId)
                .map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.label}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="border-t border-white/10 bg-zinc-950/25 p-5">
          <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/50">
            {selectedMoveNode && selectedMoveSourceZone && selectedMoveTargetZone
              ? `${getRecordLabel(selectedMoveNode, 'Node')} will move from ${selectedMoveSourceZone.label} to ${selectedMoveTargetZone.label}.`
              : 'Complete all steps to enable the transfer.'}
          </div>
          <button
            type="submit"
            disabled={!moveForm.fromZoneId || !moveForm.nodeId || !moveForm.zoneId || isMovingNode}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/35"
          >
            {isMovingNode && <LoadingSpinner />}
            {isMovingNode ? 'Transferring node...' : 'Confirm transfer'}
          </button>
        </div>
      </form>

      <div className="rounded-4xl border border-white/10 bg-zinc-950/35 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
          Transfer preview
        </p>
        <div className="mt-5 grid gap-3">
          {[
            ['Source', selectedMoveSourceZone?.label ?? 'No source selected'],
            ['Node', selectedMoveNode ? getRecordLabel(selectedMoveNode, 'Selected node') : 'No node selected'],
            ['Target', selectedMoveTargetZone?.label ?? 'No target selected'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">
                {label}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderActivePanel = () => {
    if (activeSection === 'Zones') {
      return renderZones()
    }

    if (activeSection === 'Nodes') {
      return renderNodes()
    }

    if (activeSection === 'Transfer Zone') {
      return renderTransfers()
    }

    if (activeSection === 'Payments') {
      return (
        <div className="rounded-3xl border border-white/10 bg-zinc-950/35 p-6 text-white/55">
          Payment endpoints are not available yet. Admin zone and node tools are ready.
        </div>
      )
    }

    return renderOverview()
  }

  const statusNotice = actionError || actionMessage

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-zinc-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_32%)]" />
      <div className="relative flex h-screen flex-col">
        <header className="z-10 w-full border-b border-white/10 bg-zinc-950/82 px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <nav className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToMap}
                className="flex min-w-0 items-center gap-3 rounded-2xl pr-3 text-left transition hover:bg-white/6"
              >
                <DashboardLogo />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">Park Mesh</span>
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Internal
                  </span>
                </span>
              </button>

              <div className="hidden h-8 w-px bg-white/10 lg:block" />

              <p className="hidden text-sm font-semibold text-white/55 lg:block">
                Internal operations dashboard
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isWaitingForBackend && (
                <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 sm:flex">
                  <LoadingSpinner className="h-3.5 w-3.5 text-emerald-200" />
                  <span className="text-xs font-bold text-white/70">Waiting backend</span>
                </div>
              )}
              <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 sm:flex">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                  <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </span>
                <span className="text-xs font-bold text-emerald-100">Online</span>
              </div>
              <button
                type="button"
                onClick={() => void handleSignOutClick()}
                disabled={isSigningOut}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:border-rose-300/40 hover:bg-rose-400/12 hover:text-rose-100 disabled:cursor-wait disabled:opacity-60"
              >
                {isSigningOut && <LoadingSpinner className="h-3.5 w-3.5" />}
                {isSigningOut ? 'Signing out' : 'Sign out'}
              </button>
            </div>
          </nav>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_1fr]">
          <aside className="hidden border-r border-white/10 bg-zinc-950/62 p-3 backdrop-blur-xl lg:flex lg:flex-col">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
              <p className="px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Modules
              </p>
              <div className="mt-3 grid gap-2">
                {DASHBOARD_LINKS.map((link) => (
                  <motion.button
                    key={link}
                    type="button"
                    onClick={() => setActiveSection(link)}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className={`relative overflow-hidden rounded-2xl px-3 py-3 text-left text-sm font-bold transition ${
                      activeSection === link
                        ? 'text-white shadow-[0_18px_34px_rgba(16,185,129,0.22)]'
                        : 'bg-white/5 text-white/55 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {activeSection === link && (
                      <motion.span
                        layoutId="dashboard-active-section"
                        className="absolute inset-0 rounded-2xl bg-emerald-500"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{link}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                Workspace
              </p>
              <p className="mt-2 text-sm font-semibold text-white">Production</p>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Create zones, create nodes, move nodes, and inspect endpoint responses.
              </p>
            </div>
          </aside>

          <section className="min-w-0 overflow-auto">
            <div className="grid gap-4 border-b border-white/10 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-300">
                  Dashboard
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {activeSection === 'Overview'
                    ? 'Internal operations'
                    : activeSection}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                  Admin tools for zones and parking nodes are connected to the backend.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/6 p-2">
                {[
                  ['Zones', isLoadingDashboard ? '--' : String(zones.length)],
                  ['Nodes', isLoadingDashboard ? '--' : String(nodes.length)],
                  ['Online', isLoadingDashboard ? '--' : String(onlineNodeCount)],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-24 rounded-2xl bg-zinc-950/45 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4">
              {dashboardError && (
                <div className="mb-4 rounded-3xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm font-semibold text-rose-100">
                  {dashboardError}
                </div>
              )}
              {statusNotice && (
                <div
                  className={`mb-4 rounded-3xl border p-4 text-sm font-semibold ${
                    actionError
                      ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
                      : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
                  }`}
                >
                  {statusNotice}
                </div>
              )}
              <div className="relative min-h-[calc(100vh-16rem)] w-full overflow-hidden rounded-4xl border border-white/12 bg-white/4 p-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1),transparent_34%)]" />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="relative"
                  >
                    {renderActivePanel()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
