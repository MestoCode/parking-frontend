import React, { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { AnimatePresence, motion } from 'motion/react'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  DEFAULT_CURRENT_LOCATION,
  DEFAULT_CURRENT_LOCATION_LABEL,
  MAP_ZOOM,
  MAPBOX_TOKEN,
} from '../../common/constants'
import type {
  CurrentLocation,
  CustomMapMarker,
  LngLatTuple,
  ParkingMarkerFeature,
} from '../../shared/types'
import {
  clearHomepageZoneHighlight,
  clearRouteLine,
  clearRouteMarkers,
  createParkingMap,
  formatCoordinate,
  formatDistanceKm,
  focusHomepageZone,
  focusNavigationView,
  getLngLatTuple,
  getNavigationRoute,
  getParkingMarkerCollectionByZone,
  getParkingMarkersByZone,
  getSupportedDestinationMessage,
  getSupportedZoneNames,
  isSupportedDestination,
  loadParkingSpots,
  normalizeZoneName,
  renderClusteredParkingMarkers,
  renderCustomMarker,
  renderRouteLine,
  renderRouteMarkers,
  stopParkingNodePulseAnimation,
  stopRouteFillAnimation,
} from './logic'
import { NavbarControl } from './NavbarControl'

type PendingDestination =
  {
    type: 'marker'
    zone: string
    label: string
    coordinates: LngLatTuple
    markerId: string
  }

type ParkingMapProps = {
  onLoginClick?: () => void
}

const HOME_PROMPT_ZONES = [
  { label: 'Hamra', zone: 'hamra' },
  { label: 'Ashrafieh', zone: 'ashrafieh' },
  { label: 'Beirut', zone: 'beirut' },
]
const HOME_PROMPT_HOLD_MS = 2600
const HOME_PROMPT_TYPE_MS = 115

export function ParkingMap({ onLoginClick }: ParkingMapProps = {}) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const fromMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const toMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const customMarkerRefs = useRef(new Map<string, mapboxgl.Marker>())
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null)
  const [fromValue, setFromValue] = useState(DEFAULT_CURRENT_LOCATION_LABEL)
  const [destinationValue, setDestinationValue] = useState('')
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>(
    DEFAULT_CURRENT_LOCATION,
  )
  const [customMarkers, setCustomMarkers] = useState<CustomMapMarker[]>([])
  const [isMarkerModeEnabled, setIsMarkerModeEnabled] = useState(false)
  const [isDestinationPickerOpen, setIsDestinationPickerOpen] = useState(false)
  const [isHomeViewVisible, setIsHomeViewVisible] = useState(false)
  const [isDirectionsCollapsed, setIsDirectionsCollapsed] = useState(false)
  const [isRouteSectionCollapsed, setIsRouteSectionCollapsed] = useState(false)
  const [destinationPickerZone, setDestinationPickerZone] = useState('')
  const [pendingDestination, setPendingDestination] =
    useState<PendingDestination | null>(null)
  const [selectedDestination, setSelectedDestination] = useState('')
  const [selectedDestinationLabel, setSelectedDestinationLabel] = useState('')
  const [selectedDestinationCoordinates, setSelectedDestinationCoordinates] =
    useState<LngLatTuple | null>(null)
  const [confirmedParkingMarker, setConfirmedParkingMarker] =
    useState<{ id: string; zone: string } | null>(null)
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null)
  const [routeError, setRouteError] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(MAP_ZOOM)
  const [homePromptIndex, setHomePromptIndex] = useState(0)
  const [homePromptText, setHomePromptText] = useState('')
  const [isHomePromptDeleting, setIsHomePromptDeleting] = useState(false)
  const currentHomePrompt = HOME_PROMPT_ZONES[homePromptIndex]
  const supportedZones = useMemo(() => getSupportedZoneNames(), [])
  const destinationPickerZoneMarkers = useMemo(
    () => (destinationPickerZone ? getParkingMarkersByZone(destinationPickerZone) : []),
    [destinationPickerZone],
  )
  const shouldShowMap = Boolean(selectedDestination && selectedDestinationCoordinates)
  const isHomepageVisible = !shouldShowMap || isHomeViewVisible

  useEffect(() => {
    if (!mapContainer || !MAPBOX_TOKEN || mapRef.current) {
      return
    }

    const map = createParkingMap(mapContainer)

    const updateZoomLevel = () => setCurrentZoom(map.getZoom())
    const markMapReady = () => setIsMapReady(true)

    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.on('zoom', updateZoomLevel)
    map.on('load', markMapReady)
    updateZoomLevel()

    return () => {
      map.off('zoom', updateZoomLevel)
      map.off('load', markMapReady)
      clearHomepageZoneHighlight(map)
      stopParkingNodePulseAnimation(map)
      stopRouteFillAnimation(map)
      map.remove()
      clearRouteMarkers({
        from: fromMarkerRef.current,
        to: toMarkerRef.current,
      })
      customMarkerRefs.current.forEach((marker) => marker.remove())
      customMarkerRefs.current.clear()
      fromMarkerRef.current = null
      toMarkerRef.current = null
      mapRef.current = null
      setIsMapReady(false)
    }
  }, [mapContainer])

  useEffect(() => {
    const currentPrompt = currentHomePrompt.label
    const isFullyTyped = homePromptText === currentPrompt
    const isFullyDeleted = homePromptText.length === 0
    const timeoutMs =
      isFullyTyped && !isHomePromptDeleting ? HOME_PROMPT_HOLD_MS : HOME_PROMPT_TYPE_MS

    const timeoutId = window.setTimeout(() => {
      if (!isHomePromptDeleting && !isFullyTyped) {
        setHomePromptText(currentPrompt.slice(0, homePromptText.length + 1))
        return
      }

      if (!isHomePromptDeleting && isFullyTyped) {
        setIsHomePromptDeleting(true)
        return
      }

      if (isHomePromptDeleting && !isFullyDeleted) {
        setHomePromptText(currentPrompt.slice(0, homePromptText.length - 1))
        return
      }

      setIsHomePromptDeleting(false)
      setHomePromptIndex((index) => (index + 1) % HOME_PROMPT_ZONES.length)
    }, timeoutMs)

    return () => window.clearTimeout(timeoutId)
  }, [currentHomePrompt.label, homePromptIndex, homePromptText, isHomePromptDeleting])

  useEffect(() => {
    if (!selectedDestination || !isMapReady) {
      return
    }

    loadParkingSpots(selectedDestination)
  }, [isMapReady, selectedDestination])

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return
    }

    if (isHomepageVisible) {
      renderClusteredParkingMarkers(
        mapRef.current,
        undefined,
        undefined,
        currentHomePrompt.zone === 'beirut',
      )
      return
    }

    if (selectedDestination) {
      renderClusteredParkingMarkers(
        mapRef.current,
        getParkingMarkerCollectionByZone(selectedDestination),
        confirmedParkingMarker,
      )
    }
  }, [
    confirmedParkingMarker,
    currentHomePrompt.zone,
    isHomepageVisible,
    isMapReady,
    selectedDestination,
  ])

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return
    }

    if (!isHomepageVisible) {
      clearHomepageZoneHighlight(mapRef.current)
      return
    }

    focusHomepageZone(mapRef.current, currentHomePrompt.zone)
  }, [currentHomePrompt.zone, isHomepageVisible, isMapReady])

  useEffect(() => {
    if (
      !currentLocation ||
      !selectedDestination ||
      !mapRef.current ||
      !isMapReady ||
      isHomepageVisible
    ) {
      return
    }

    const destinationCenter = selectedDestinationCoordinates

    if (!destinationCenter) {
      return
    }

    const markers = renderRouteMarkers(
      mapRef.current,
      {
        from: fromMarkerRef.current,
        to: toMarkerRef.current,
      },
      currentLocation,
      destinationCenter,
    )

    fromMarkerRef.current = markers.from
    toMarkerRef.current = markers.to
  }, [
    currentLocation,
    isHomepageVisible,
    isMapReady,
    selectedDestination,
    selectedDestinationCoordinates,
  ])

  useEffect(() => {
    if (!currentLocation || !selectedDestination || !mapRef.current || !isMapReady) {
      return
    }

    const map = mapRef.current
    const destinationCenter = selectedDestinationCoordinates
    let shouldCancel = false

    if (!destinationCenter) {
      return
    }

    const destination = getLngLatTuple(destinationCenter)
    clearRouteLine(map)

    getNavigationRoute(currentLocation, destination)
      .then((route) => {
        if (shouldCancel || !mapRef.current) {
          return
        }

        setRouteDistanceKm(route.distanceKm)
        return focusNavigationView(map, currentLocation, route.coordinates, destination).then(
          () => {
            if (shouldCancel || !mapRef.current) {
              return
            }

            renderRouteLine(map, route.coordinates)
          },
        )
      })
      .catch(() => {
        if (shouldCancel || !mapRef.current) {
          return
        }

        setRouteDistanceKm(null)
        return focusNavigationView(
          map,
          currentLocation,
          [currentLocation, destination],
          destination,
        ).then(() => {
          if (shouldCancel || !mapRef.current) {
            return
          }

          renderRouteLine(map, [currentLocation, destination])
        })
      })

    return () => {
      shouldCancel = true
    }
  }, [currentLocation, isMapReady, selectedDestination, selectedDestinationCoordinates])

  useEffect(() => {
    if (!mapRef.current || !isMapReady) {
      return
    }

    const markerIds = new Set(customMarkers.map((marker) => marker.id))

    customMarkerRefs.current.forEach((marker, markerId) => {
      if (!markerIds.has(markerId)) {
        marker.remove()
        customMarkerRefs.current.delete(markerId)
      }
    })

    customMarkers.forEach((marker) => {
      const renderedMarker = renderCustomMarker(
        mapRef.current as mapboxgl.Map,
        marker,
        customMarkerRefs.current.get(marker.id),
      )

      customMarkerRefs.current.set(marker.id, renderedMarker)
    })
  }, [customMarkers, isMapReady])

  useEffect(() => {
    if (!mapRef.current || !isMapReady || !isMarkerModeEnabled) {
      return
    }

    const map = mapRef.current
    const handleMarkerClick = (event: mapboxgl.MapMouseEvent) => {
      const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat]

      setCustomMarkers((currentMarkers) => [
        ...currentMarkers,
        {
          id: crypto.randomUUID(),
          coordinates,
        },
      ])
    }

    map.getCanvas().style.cursor = 'crosshair'
    map.on('click', handleMarkerClick)

    return () => {
      map.getCanvas().style.cursor = ''
      map.off('click', handleMarkerClick)
    }
  }, [isMapReady, isMarkerModeEnabled])

  const requestCurrentLocation = () => {
    setRouteError('')
    setIsLocating(true)
    setCurrentLocation(DEFAULT_CURRENT_LOCATION)
    setFromValue(DEFAULT_CURRENT_LOCATION_LABEL)
    setIsLocating(false)
  }

  const openDestinationPicker = () => {
    setDestinationPickerZone('')
    setIsDestinationPickerOpen(true)
  }

  const closeDestinationPicker = () => {
    setDestinationPickerZone('')
    setIsDestinationPickerOpen(false)
  }

  const handleHomeClick = () => {
    closeDestinationPicker()
    setIsHomeViewVisible(true)
  }

  const handleDestinationZoneSelect = (zoneName: string) => {
    setDestinationPickerZone(zoneName)
    setPendingDestination(null)
  }

  const handleRouteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const zoneName = normalizeZoneName(selectedDestination || destinationValue)

    if (!selectedDestinationCoordinates || !isSupportedDestination(zoneName)) {
      setRouteError(getSupportedDestinationMessage())
      openDestinationPicker()
      return
    }

    setRouteError('')
    closeDestinationPicker()
    setPendingDestination(null)

    if (shouldShowMap && selectedDestination === zoneName) {
      setIsHomeViewVisible(false)
      return
    }

    setRouteDistanceKm(null)
    setSelectedDestination(zoneName)
    setIsHomeViewVisible(false)
  }

  const handleDestinationMarkerPreview = (marker: ParkingMarkerFeature) => {
    setPendingDestination({
      type: 'marker',
      zone: marker.properties.zone,
      label: marker.properties.title,
      coordinates: marker.geometry.coordinates,
      markerId: marker.properties.id,
    })
  }

  const confirmDestinationSelection = () => {
    if (!pendingDestination) {
      return
    }

    const normalizedZoneName = normalizeZoneName(pendingDestination.zone)

    setDestinationValue(normalizedZoneName)
    setRouteError('')
    setRouteDistanceKm(null)
    closeDestinationPicker()
    setIsHomeViewVisible(false)
    setSelectedDestinationLabel(pendingDestination.label)
    setSelectedDestinationCoordinates(pendingDestination.coordinates)
    setConfirmedParkingMarker({
      id: pendingDestination.markerId,
      zone: normalizedZoneName,
    })
    setSelectedDestination(normalizedZoneName)
  }

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-white text-zinc-950">
      <NavbarControl
        isMapVisible={!isHomepageVisible}
        isSidebarCollapsed={isDirectionsCollapsed}
        onHomeClick={handleHomeClick}
        onLoginClick={onLoginClick ?? (() => undefined)}
      />
      <AnimatePresence mode="wait">
        {isHomepageVisible && (
          <motion.form
            key="route-search"
            onSubmit={handleRouteSubmit}
            initial={{ opacity: 0, y: 42, scale: 0.97, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 32, scale: 0.97, filter: 'blur(12px)' }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute bottom-5 left-3 right-3 z-20 mx-auto max-w-6xl overflow-hidden rounded-3xl border border-zinc-200 bg-white/96 p-3 shadow-[0_26px_80px_rgba(39,39,42,0.16)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,253,244,0.45),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,253,245,0.32),transparent_30%)]" />
            <div className="relative flex flex-col gap-3">
              <div className="flex flex-col gap-2 px-1 lg:flex-row lg:items-center lg:justify-between">
                <motion.p
                  key={homePromptIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="text-base font-semibold text-zinc-950 sm:text-lg"
                >
                  Go to{' '}
                  <span className="inline-flex min-w-32 text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl">
                    {homePromptText}
                    <span className="ml-1 h-7 w-px animate-pulse bg-emerald-500" />
                  </span>
                </motion.p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
                  Live zone preview
                </p>
              </div>

              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)_auto] lg:items-center">
                <label
                  htmlFor="route-from"
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/95 px-3 transition focus-within:border-emerald-300 hover:border-zinc-300"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.22)]">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-white">
                      <path d="M12 2.25a6.75 6.75 0 0 0-6.75 6.75c0 4.77 6.02 12.14 6.28 12.45a.6.6 0 0 0 .94 0c.26-.31 6.28-7.68 6.28-12.45A6.75 6.75 0 0 0 12 2.25Zm0 9.25A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                      From
                    </span>
                    <input
                      id="route-from"
                      value={fromValue}
                      onChange={(event) => setFromValue(event.target.value)}
                      className="mt-0.5 w-full bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400"
                      placeholder="Current location"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={requestCurrentLocation}
                    className="shrink-0 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    {isLocating ? '...' : 'GPS'}
                  </button>
                </label>

                <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-bold text-zinc-400 lg:flex">
                  →
                </div>

                <label
                  htmlFor="route-to"
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/95 px-3 transition focus-within:border-emerald-300 hover:border-zinc-300"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white">
                    <span className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.45)]" />
                  </span>
                  <button
                    type="button"
                    id="route-to"
                    onClick={openDestinationPicker}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left outline-none"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                        To
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-sm font-semibold ${
                          selectedDestinationLabel ? 'capitalize text-zinc-950' : 'text-zinc-400'
                        }`}
                      >
                        {selectedDestinationLabel || 'Choose a supported node'}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 transition group-hover:bg-emerald-100">
                      Select
                    </span>
                  </button>
                </label>

                <button
                  type="submit"
                  className="min-h-16 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(24,24,27,0.22)] transition hover:bg-emerald-600 lg:min-w-38"
                >
                  Launch
                </button>
              </div>

              {routeError && <p className="text-sm text-rose-300">{routeError}</p>}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          key="map-view"
          initial={{ opacity: 0, y: 36, scale: 0.96, filter: 'blur(16px)' }}
          animate={{
            opacity: isHomepageVisible ? 0.72 : 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
          }}
          exit={{ opacity: 0, y: -24, scale: 0.98, filter: 'blur(12px)' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className={`absolute inset-0 h-screen w-screen overflow-hidden bg-slate-900 ${
            isHomepageVisible ? 'pointer-events-none' : ''
          }`}
        >
          <div ref={setMapContainer} className="h-full w-full" />
          {!isHomepageVisible && (
            <>
            <motion.aside
              initial={false}
              animate={{ width: isDirectionsCollapsed ? 72 : 336 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="absolute left-0 top-0 z-10 flex h-full max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-r border-zinc-200 bg-white/96 shadow-[14px_0_54px_rgba(39,39,42,0.14)] backdrop-blur-xl"
            >
              <div
                className={`flex gap-3 border-b border-zinc-200 bg-white p-3 ${
                  isDirectionsCollapsed
                    ? 'items-center justify-center'
                    : 'items-center justify-between'
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!isDirectionsCollapsed ? (
                    <motion.div
                      key="sidebar-title"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.18 }}
                      className="min-w-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                          Route hub
                        </p>
                      </div>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
                        Navigation
                      </h2>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <button
                  type="button"
                  onClick={() => setIsDirectionsCollapsed((isCollapsed) => !isCollapsed)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-lg font-bold leading-none text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                  aria-label={
                    isDirectionsCollapsed ? 'Expand directions sidebar' : 'Collapse directions sidebar'
                  }
                >
                  {isDirectionsCollapsed ? '›' : '‹'}
                </button>
              </div>

              <div className="flex-1 overflow-auto p-3">
                <AnimatePresence mode="wait" initial={false}>
                  {isDirectionsCollapsed ? (
                    <motion.div
                      key="collapsed-sidebar"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.34)]">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4 fill-white"
                        >
                          <path d="M12 2.25a6.75 6.75 0 0 0-6.75 6.75c0 4.77 6.02 12.14 6.28 12.45a.6.6 0 0 0 .94 0c.26-.31 6.28-7.68 6.28-12.45A6.75 6.75 0 0 0 12 2.25Zm0 9.25A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                        </svg>
                      </div>
                      <svg
                        aria-hidden="true"
                        className="h-12 w-2 overflow-visible"
                        viewBox="0 0 8 48"
                      >
                        <line
                          x1="4"
                          x2="4"
                          y1="0"
                          y2="48"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray="1 7"
                        />
                      </svg>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
                        <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="expanded-sidebar"
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -14 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-semibold text-emerald-700">
                            Active
                          </p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Distance
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-950">
                            {routeDistanceKm !== null
                              ? formatDistanceKm(routeDistanceKm)
                              : '--'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-white">
                        <button
                          type="button"
                          onClick={() =>
                            setIsRouteSectionCollapsed((isCollapsed) => !isCollapsed)
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-50"
                        >
                          <span>
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                              Section
                            </span>
                            <span className="mt-0.5 block text-sm font-semibold text-zinc-950">
                              Route details
                            </span>
                          </span>
                          <span className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-bold text-emerald-700">
                            {isRouteSectionCollapsed ? '+' : '-'}
                          </span>
                        </button>

                        <AnimatePresence initial={false}>
                          {!isRouteSectionCollapsed && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="overflow-hidden border-t border-zinc-200"
                            >
                              <div className="relative p-3">
                                <svg
                                  aria-hidden="true"
                                  className="absolute left-6.5 top-11 h-11 w-2 overflow-visible"
                                  viewBox="0 0 8 44"
                                >
                                  <line
                                    x1="4"
                                    x2="4"
                                    y1="0"
                                    y2="44"
                                    stroke="#10b981"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeDasharray="1 7"
                                  />
                                </svg>

                                <div className="relative flex gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.28)]">
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 24 24"
                                      className="h-4 w-4 fill-white"
                                    >
                                      <path d="M12 2.25a6.75 6.75 0 0 0-6.75 6.75c0 4.77 6.02 12.14 6.28 12.45a.6.6 0 0 0 .94 0c.26-.31 6.28-7.68 6.28-12.45A6.75 6.75 0 0 0 12 2.25Zm0 9.25A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                      From
                                    </p>
                                    <p className="truncate text-sm font-semibold text-zinc-950">
                                      My location
                                    </p>
                                    <p className="truncate text-xs text-zinc-500">{fromValue}</p>
                                  </div>
                                </div>

                                <div className="relative mt-4 flex gap-3">
                                  <div className="mt-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50">
                                    <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                      To
                                    </p>
                                    <button
                                      type="button"
                                      onClick={openDestinationPicker}
                                      className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-emerald-50/35 px-3 py-2 text-left text-sm font-semibold capitalize text-zinc-950 transition hover:border-emerald-300 hover:bg-emerald-50"
                                    >
                                      <span className="truncate">
                                        {selectedDestinationLabel || selectedDestination}
                                      </span>
                                      <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
                                        Edit
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {!isDirectionsCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-zinc-200 p-3"
                  >
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            Tools
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-950">
                            Markers
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMarkerModeEnabled((isEnabled) => !isEnabled)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            isMarkerModeEnabled
                              ? 'bg-emerald-600 text-white shadow-[0_0_22px_rgba(16,185,129,0.18)]'
                              : 'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isMarkerModeEnabled ? 'Placing' : 'Add'}
                        </button>
                      </div>
                      {customMarkers.length > 0 && (
                        <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1">
                          {customMarkers.map((marker, index) => (
                            <div
                              key={marker.id}
                              className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600"
                            >
                              <p className="font-semibold text-emerald-700">
                                Marker {index + 1}
                              </p>
                              <p className="mt-1">
                                Longitude: {formatCoordinate(marker.coordinates[0])}
                              </p>
                              <p>Latitude: {formatCoordinate(marker.coordinates[1])}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.aside>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 text-right shadow-xl backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
                Zoom
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-950">
                {currentZoom.toFixed(2)}
              </p>
            </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isDestinationPickerOpen && (
          <motion.div
            key="destination-node-modal"
            className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/10 p-3 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="destination-node-title"
              className="relative flex max-h-[90vh] w-[min(98vw,58rem)] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white/96 shadow-[0_28px_80px_rgba(39,39,42,0.16)]"
              initial={{ opacity: 0, y: 44, scale: 0.97, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(10px)' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,253,244,0.42),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(236,253,245,0.28),transparent_28%)]" />
              <div className="relative flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                      Destination nodes
                    </p>
                    {destinationPickerZone && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                        {destinationPickerZone}
                      </span>
                    )}
                  </div>
                  <h2
                    id="destination-node-title"
                    className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl"
                  >
                    Choose parking node
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                    Select a zone, then choose one exact predefined node.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDestinationPicker}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-500 transition hover:bg-zinc-50"
                  aria-label="Close destination picker"
                >
                  ×
                </button>
              </div>

              <div className="relative flex-1 overflow-auto p-3 sm:p-4">
                {!destinationPickerZone ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {supportedZones.map((zone) => {
                      const zoneMarkers = getParkingMarkersByZone(zone)

                      return (
                        <button
                          key={zone}
                          type="button"
                          onClick={() => handleDestinationZoneSelect(zone)}
                          className="group flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/82 p-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold uppercase text-white transition group-hover:bg-emerald-600">
                              {zone.slice(0, 2)}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-base font-semibold capitalize text-zinc-950">
                                {zone}
                              </span>
                              <span className="mt-0.5 block text-xs text-zinc-500">
                                {zoneMarkers.length} predefined nodes
                              </span>
                            </span>
                          </span>
                          <span className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 transition group-hover:bg-white">
                            Select
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <section className="rounded-3xl border border-zinc-200 bg-white/82 p-2 shadow-sm">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                          Zone
                        </p>
                        <p className="text-sm font-semibold capitalize text-zinc-950">
                          {destinationPickerZone} ·{' '}
                          {destinationPickerZoneMarkers.length} predefined nodes
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDestinationPickerZone('')
                          setPendingDestination(null)
                        }}
                        className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 transition hover:bg-emerald-50"
                      >
                        Change zone
                      </button>
                    </div>

                    <div className="mt-2 grid gap-2">
                      {destinationPickerZoneMarkers.map((marker) => {
                        const isPending =
                          pendingDestination?.markerId === marker.properties.id

                        return (
                          <button
                            key={marker.properties.id}
                            type="button"
                            onClick={() => handleDestinationMarkerPreview(marker)}
                            className={`grid w-full gap-3 rounded-2xl border p-3 text-left transition sm:grid-cols-[1fr_auto] ${
                              isPending
                                ? 'border-emerald-300 bg-emerald-50 text-zinc-950 shadow-[0_14px_34px_rgba(16,185,129,0.1)]'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:bg-emerald-50'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                                  isPending
                                    ? 'border-emerald-300 bg-emerald-600 shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                                    : 'border-emerald-100 bg-emerald-50'
                                }`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    isPending ? 'bg-white' : 'bg-emerald-500'
                                  }`}
                                />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold capitalize text-zinc-950">
                                  {marker.properties.title}
                                </span>
                                <span className="mt-0.5 block text-xs capitalize text-zinc-500">
                                  {destinationPickerZone} node destination
                                </span>
                              </span>
                            </span>
                            <span className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-600 sm:min-w-72">
                              <span>{formatCoordinate(marker.geometry.coordinates[0])}</span>
                              <span className="h-1 w-1 rounded-full bg-zinc-300" />
                              <span>{formatCoordinate(marker.geometry.coordinates[1])}</span>
                              {isPending && (
                                <span className="rounded-full bg-emerald-600 px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                                  Selected
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}
              </div>

              <div className="relative border-t border-zinc-200 bg-white/88 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                      Selected
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold capitalize text-zinc-950">
                      {pendingDestination?.label ?? 'Choose a predefined node'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-72">
                  <button
                    type="button"
                    onClick={closeDestinationPicker}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!pendingDestination}
                    onClick={confirmDestinationSelection}
                    className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-300"
                  >
                    Confirm node
                  </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!MAPBOX_TOKEN && shouldShowMap && (
        <div className="border-t border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600">
          Add <code className="text-emerald-700">VITE_MAPBOX_TOKEN</code> to your
          environment to load the map.
        </div>
      )}
    </div>
  )
}
