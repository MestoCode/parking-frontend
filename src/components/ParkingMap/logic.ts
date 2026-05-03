import mapboxgl from 'mapbox-gl'
import {
  CUSTOM_MARKER_CLASSES,
  MAP_BEARING,
  MAP_CENTER,
  MAP_CONFIG,
  MAP_MAX_BOUNDS,
  MAP_PITCH,
  MAP_STYLE,
  MAP_ZOOM,
  MAPBOX_TOKEN,
  NAVIGATION_CAMERA,
  PARKING_MARKER_CLUSTER_COUNT_LAYER_ID,
  PARKING_MARKER_CLUSTER_OPTIONS,
  PARKING_MARKER_CLUSTERS_LAYER_ID,
  PARKING_MARKER_PULSE_LAYER_ID,
  PARKING_MARKER_UNCLUSTERED_LAYER_ID,
  PARKING_MARKERS_GEOJSON,
  PARKING_MARKERS_SOURCE_ID,
  ROUTE_COLOR,
  ROUTE_GLOW_COLOR,
  ROUTE_GLOW_LAYER_ID,
  ROUTE_GLOW_PAINT,
  ROUTE_LAYER_ID,
  ROUTE_LINE_PAINT,
  ROUTE_MARKER_CLASSES,
  ROUTE_NEON_BLUE_COLOR,
  ROUTE_SOURCE_ID,
  ZONES,
} from '../../common/constants'
import {
  MAPBOX_DIRECTIONS_BASE_URL,
  MAPBOX_RTL_TEXT_PLUGIN_URL,
} from '../../common/constants/map'
import type {
  CurrentLocation,
  CustomMapMarker,
  LngLatTuple,
  NavigationRoute,
  ParkingMarkerFeature,
  ParkingMarkerFeatureCollection,
  ParkingMapMarkerRefs,
  RouteCoordinates,
  RouteMarkerType,
  ZoneName,
} from '../../shared/types'

const ROUTE_TRANSPARENT_COLOR = 'rgba(47, 192, 119, 0)'
const HOMEPAGE_CAMERA_DURATION = 2200
const HOMEPAGE_ZONE_MASK_SOURCE_ID = 'homepage-zone-mask'
const HOMEPAGE_ZONE_MASK_LAYER_ID = 'homepage-zone-mask-fill'
const HOMEPAGE_ZONE_HIGHLIGHT_SOURCE_ID = 'homepage-zone-highlight'
const HOMEPAGE_ZONE_HIGHLIGHT_FILL_LAYER_ID = 'homepage-zone-highlight-fill'
let isRtlTextPluginRequested = false
const routeFillAnimationFrameIds = new WeakMap<mapboxgl.Map, number>()
const parkingNodePulseAnimationFrameIds = new WeakMap<mapboxgl.Map, number>()
const navigationRouteCache = new Map<string, NavigationRoute>()

export const normalizeZoneName = (zoneName: string) => zoneName.trim().toLowerCase()

export const getZoneNames = (): ZoneName[] => [
  'beirut',
  ...(Object.keys(ZONES.beirut.children) as Exclude<ZoneName, 'beirut'>[]),
]

export const isAllowedZone = (zoneName: string) =>
  getZoneNames().includes(normalizeZoneName(zoneName) as ZoneName)

export const getAllowedZoneMessage = () =>
  `Choose Beirut, ${Object.keys(ZONES.beirut.children).join(', ')}`

export function getParkingMarkersByZone(zoneName: string): ParkingMarkerFeature[] {
  const normalizedZoneName = normalizeZoneName(zoneName)

  return PARKING_MARKERS_GEOJSON.features.filter(
    (marker) => marker.properties.zone === normalizedZoneName,
  )
}

export function getParkingMarkerCollectionByZone(
  zoneName: string,
): ParkingMarkerFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: getParkingMarkersByZone(zoneName),
  }
}

export const getSupportedZoneNames = (): ZoneName[] =>
  getZoneNames().filter((zoneName) => getParkingMarkersByZone(zoneName).length > 0)

export const isSupportedDestination = (zoneName: string) =>
  getSupportedZoneNames().includes(normalizeZoneName(zoneName) as ZoneName)

export const getSupportedDestinationMessage = () =>
  `Choose a predefined parking node in: ${getSupportedZoneNames().join(', ')}`

export function getZoneCenter(zoneName: string): LngLatTuple | null {
  const name = normalizeZoneName(zoneName)
  const children = ZONES.beirut.children

  if (name in children) {
    return children[name as keyof typeof children].center
  }

  if (name === 'beirut') {
    return [35.5018, 33.8938]
  }

  return null
}

export function focusHomepageMap(map: mapboxgl.Map) {
  const markerBounds = PARKING_MARKERS_GEOJSON.features.reduce(
    (bounds, marker) => bounds.extend(marker.geometry.coordinates),
    new mapboxgl.LngLatBounds(),
  )

  if (markerBounds.isEmpty()) {
    map.fitBounds(ZONES.beirut.bounds, {
      padding: 80,
      duration: 900,
      maxZoom: 15.2,
    })
    return
  }

  map.fitBounds(markerBounds, {
    padding: {
      top: 140,
      right: 120,
      bottom: 140,
      left: 120,
    },
    duration: 900,
    maxZoom: 16.2,
  })
}

export function clearHomepageZoneHighlight(map: mapboxgl.Map) {
  removeLayerIfExists(map, HOMEPAGE_ZONE_HIGHLIGHT_FILL_LAYER_ID)
  removeLayerIfExists(map, HOMEPAGE_ZONE_MASK_LAYER_ID)

  if (map.getSource(HOMEPAGE_ZONE_HIGHLIGHT_SOURCE_ID)) {
    map.removeSource(HOMEPAGE_ZONE_HIGHLIGHT_SOURCE_ID)
  }

  if (map.getSource(HOMEPAGE_ZONE_MASK_SOURCE_ID)) {
    map.removeSource(HOMEPAGE_ZONE_MASK_SOURCE_ID)
  }
}

export function focusHomepageZone(map: mapboxgl.Map, zoneName: string) {
  const name = normalizeZoneName(zoneName)
  const children = ZONES.beirut.children

  clearHomepageZoneHighlight(map)

  if (name === 'beirut') {
    map.fitBounds(ZONES.beirut.bounds, {
      padding: {
        top: 110,
        right: 90,
        bottom: 260,
        left: 90,
      },
      duration: HOMEPAGE_CAMERA_DURATION,
      maxZoom: 13.4,
    })
    return
  }

  if (name in children) {
    const zone = children[name as keyof typeof children]

    map.easeTo({
      center: zone.center,
      zoom: 17.05,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      duration: HOMEPAGE_CAMERA_DURATION,
      easing: (time) => time * time * (3 - 2 * time),
      padding: {
        top: 110,
        right: 90,
        bottom: 260,
        left: 90,
      },
    })
    return
  }

  focusHomepageMap(map)
}

export function createParkingMap(container: HTMLDivElement) {
  mapboxgl.accessToken = MAPBOX_TOKEN
  enableRtlTextPlugin()

  return new mapboxgl.Map({
    container,
    style: MAP_STYLE,
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    pitch: MAP_PITCH,
    bearing: MAP_BEARING,
    maxBounds: MAP_MAX_BOUNDS,
    config: MAP_CONFIG,
  })
}

function enableRtlTextPlugin() {
  if (isRtlTextPluginRequested || !MAPBOX_RTL_TEXT_PLUGIN_URL) {
    return
  }

  isRtlTextPluginRequested = true
  mapboxgl.setRTLTextPlugin(
    MAPBOX_RTL_TEXT_PLUGIN_URL,
    (error) => {
      if (error) {
        isRtlTextPluginRequested = false
      }
    },
    true,
  )
}

export function createRouteMarker(type: RouteMarkerType) {
  const marker = document.createElement('div')
  const label = type === 'from' ? 'My Location' : 'Destination'

  marker.setAttribute('aria-label', label)
  marker.className = ROUTE_MARKER_CLASSES.container
  marker.innerHTML = `
    <span class="${ROUTE_MARKER_CLASSES.tooltip}">${label}</span>
    <span class="${ROUTE_MARKER_CLASSES.outerPulse}"></span>
    <span class="${ROUTE_MARKER_CLASSES.innerHalo}"></span>
    <span class="${ROUTE_MARKER_CLASSES.centerDot}">
      ${
        type === 'from'
          ? `<svg aria-hidden="true" viewBox="0 0 24 24" class="${ROUTE_MARKER_CLASSES.icon}">
              <path d="M12 2.25a6.75 6.75 0 0 0-6.75 6.75c0 4.77 6.02 12.14 6.28 12.45a.6.6 0 0 0 .94 0c.26-.31 6.28-7.68 6.28-12.45A6.75 6.75 0 0 0 12 2.25Zm0 9.25A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>`
          : '<span class="h-3.5 w-3.5 rounded-full bg-white"></span>'
      }
    </span>
  `

  return marker
}

export function createCustomMarker() {
  const marker = document.createElement('div')

  marker.setAttribute('aria-label', 'Custom marker')
  marker.className = CUSTOM_MARKER_CLASSES.container
  marker.innerHTML = `
    <span class="${CUSTOM_MARKER_CLASSES.halo}"></span>
    <span class="${CUSTOM_MARKER_CLASSES.dot}"></span>
  `

  return marker
}

export function getLngLatTuple(coordinates: mapboxgl.LngLatLike): LngLatTuple {
  if (Array.isArray(coordinates)) {
    return [coordinates[0], coordinates[1]]
  }

  if ('lng' in coordinates) {
    return [coordinates.lng, coordinates.lat]
  }

  return [coordinates.lon, coordinates.lat]
}

export function clearRouteMarkers(markerRefs: ParkingMapMarkerRefs) {
  markerRefs.from?.remove()
  markerRefs.to?.remove()
}

export function renderCustomMarker(
  map: mapboxgl.Map,
  marker: CustomMapMarker,
  existingMarker?: mapboxgl.Marker,
) {
  existingMarker?.remove()

  return new mapboxgl.Marker({
    element: createCustomMarker(),
    anchor: 'center',
  })
    .setLngLat(marker.coordinates)
    .addTo(map)
}

export const formatCoordinate = (coordinate: number) => coordinate.toFixed(6)

export function renderRouteMarkers(
  map: mapboxgl.Map,
  markerRefs: ParkingMapMarkerRefs,
  currentLocation: CurrentLocation,
  destinationCenter: mapboxgl.LngLatLike,
) {
  clearRouteMarkers(markerRefs)

  const from = new mapboxgl.Marker({
    element: createRouteMarker('from'),
    anchor: 'center',
  })
    .setLngLat(currentLocation)
    .addTo(map)

  const to = new mapboxgl.Marker({
    element: createRouteMarker('to'),
    anchor: 'center',
  })
    .setLngLat(getLngLatTuple(destinationCenter))
    .addTo(map)

  return { from, to }
}

export function renderRouteLine(map: mapboxgl.Map, coordinates: RouteCoordinates) {
  clearRouteLine(map)

  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    lineMetrics: true,
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    },
  })

  map.addLayer({
    id: ROUTE_GLOW_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': ROUTE_GLOW_COLOR,
      ...ROUTE_GLOW_PAINT,
    },
  }, PARKING_MARKER_CLUSTERS_LAYER_ID)

  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-gradient': [
        'interpolate',
        ['linear'],
        ['line-progress'],
        0,
        ROUTE_COLOR,
        1,
        ROUTE_NEON_BLUE_COLOR,
      ],
      ...ROUTE_LINE_PAINT,
    },
  }, PARKING_MARKER_CLUSTERS_LAYER_ID)

  startRouteFillAnimation(map)
}

export function clearRouteLine(map: mapboxgl.Map) {
  stopRouteFillAnimation(map)

  if (map.getLayer(ROUTE_GLOW_LAYER_ID)) {
    map.removeLayer(ROUTE_GLOW_LAYER_ID)
  }

  if (map.getLayer(ROUTE_LAYER_ID)) {
    map.removeLayer(ROUTE_LAYER_ID)
  }

  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID)
  }
}

export function stopRouteFillAnimation(map: mapboxgl.Map) {
  const animationFrameId = routeFillAnimationFrameIds.get(map)

  if (animationFrameId !== undefined) {
    cancelAnimationFrame(animationFrameId)
    routeFillAnimationFrameIds.delete(map)
  }
}

export function stopParkingNodePulseAnimation(map: mapboxgl.Map) {
  const animationFrameId = parkingNodePulseAnimationFrameIds.get(map)

  if (animationFrameId !== undefined) {
    cancelAnimationFrame(animationFrameId)
    parkingNodePulseAnimationFrameIds.delete(map)
  }
}

function startRouteFillAnimation(map: mapboxgl.Map) {
  let progress = 0.02

  const animateRouteFill = () => {
    if (!map.getLayer(ROUTE_LAYER_ID)) {
      routeFillAnimationFrameIds.delete(map)
      return
    }

    if (progress >= 1) {
      map.setPaintProperty(ROUTE_LAYER_ID, 'line-gradient', [
        'interpolate',
        ['linear'],
        ['line-progress'],
        0,
        ROUTE_COLOR,
        1,
        ROUTE_NEON_BLUE_COLOR,
      ])
      routeFillAnimationFrameIds.delete(map)
      return
    }

    const edgeProgress = Math.min(progress + 0.001, 1)

    map.setPaintProperty(ROUTE_LAYER_ID, 'line-gradient', [
      'interpolate',
      ['linear'],
      ['line-progress'],
      0,
      ROUTE_COLOR,
      progress,
      ROUTE_NEON_BLUE_COLOR,
      edgeProgress,
      ROUTE_TRANSPARENT_COLOR,
      1,
      ROUTE_TRANSPARENT_COLOR,
    ])

    progress += 0.008
    routeFillAnimationFrameIds.set(map, requestAnimationFrame(animateRouteFill))
  }

  animateRouteFill()
}

export function renderClusteredParkingMarkers(
  map: mapboxgl.Map,
  markerData: ParkingMarkerFeatureCollection = PARKING_MARKERS_GEOJSON,
  confirmedMarker?: { id: string; zone: string } | null,
  shouldCluster = true,
) {
  stopParkingNodePulseAnimation(map)
  removeLayerIfExists(map, PARKING_MARKER_CLUSTER_COUNT_LAYER_ID)
  removeLayerIfExists(map, PARKING_MARKER_UNCLUSTERED_LAYER_ID)
  removeLayerIfExists(map, PARKING_MARKER_PULSE_LAYER_ID)
  removeLayerIfExists(map, PARKING_MARKER_CLUSTERS_LAYER_ID)

  if (map.getSource(PARKING_MARKERS_SOURCE_ID)) {
    map.removeSource(PARKING_MARKERS_SOURCE_ID)
  }

  map.addSource(PARKING_MARKERS_SOURCE_ID, {
    type: 'geojson',
    data: getClusterMarkerData(markerData, confirmedMarker),
    ...(shouldCluster ? PARKING_MARKER_CLUSTER_OPTIONS : {}),
  })

  if (shouldCluster) {
    map.addLayer({
      id: PARKING_MARKER_CLUSTERS_LAYER_ID,
      type: 'circle',
      source: PARKING_MARKERS_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#67e8f9',
          10,
          '#7dffb2',
          30,
          '#2fc077',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18,
          10,
          24,
          30,
          32,
        ],
        'circle-opacity': 0.88,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-emissive-strength': 1.2,
      },
    })

    map.addLayer({
      id: PARKING_MARKER_CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: PARKING_MARKERS_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 14,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#061014',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
        'text-emissive-strength': 1,
      },
    })
  }

  map.addLayer({
    id: PARKING_MARKER_PULSE_LAYER_ID,
    type: 'circle',
    source: PARKING_MARKERS_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match',
        ['get', 'status'],
        'unavailable',
        '#ef4444',
        'selected',
        '#7dffb2',
        '#2fc077',
      ],
      'circle-radius': [
        'match',
        ['get', 'status'],
        'unavailable',
        16,
        18,
      ],
      'circle-opacity': [
        'match',
        ['get', 'status'],
        'unavailable',
        0.18,
        0.24,
      ],
      'circle-blur': 0.55,
      'circle-emissive-strength': 1,
    },
  })

  map.addLayer({
    id: PARKING_MARKER_UNCLUSTERED_LAYER_ID,
    type: 'circle',
    source: PARKING_MARKERS_SOURCE_ID,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match',
        ['get', 'status'],
        'selected',
        '#7dffb2',
        'unavailable',
        '#ef4444',
        '#67e8f9',
      ],
      'circle-radius': [
        'match',
        ['get', 'status'],
        'selected',
        shouldCluster ? 9 : 11,
        'unavailable',
        shouldCluster ? 7 : 9,
        shouldCluster ? 7 : 9,
      ],
      'circle-opacity': 0.95,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': shouldCluster ? 2 : 2.5,
      'circle-emissive-strength': 1.4,
    },
  })

  if (shouldCluster) {
    map.moveLayer(PARKING_MARKER_CLUSTER_COUNT_LAYER_ID)
  }

  startParkingNodePulseAnimation(map)
}

function startParkingNodePulseAnimation(map: mapboxgl.Map) {
  const startedAt = performance.now()

  function animatePulse(now: number) {
    if (!map.getLayer(PARKING_MARKER_PULSE_LAYER_ID)) {
      stopParkingNodePulseAnimation(map)
      return
    }

    const pulse = (Math.sin((now - startedAt) / 520) + 1) / 2

    map.setPaintProperty(PARKING_MARKER_PULSE_LAYER_ID, 'circle-radius', [
      'match',
      ['get', 'status'],
      'unavailable',
      13 + pulse * 5,
      15 + pulse * 6,
    ])
    map.setPaintProperty(PARKING_MARKER_PULSE_LAYER_ID, 'circle-opacity', [
      'match',
      ['get', 'status'],
      'unavailable',
      0.12 + pulse * 0.1,
      0.16 + pulse * 0.12,
    ])

    parkingNodePulseAnimationFrameIds.set(map, requestAnimationFrame(animatePulse))
  }

  parkingNodePulseAnimationFrameIds.set(map, requestAnimationFrame(animatePulse))
}

function getClusterMarkerData(
  markerData: ParkingMarkerFeatureCollection,
  confirmedMarker?: { id: string; zone: string } | null,
): ParkingMarkerFeatureCollection {
  if (!confirmedMarker) {
    return markerData
  }

  return {
    ...markerData,
    features: markerData.features.map((marker) => {
      const isSameZone = marker.properties.zone === confirmedMarker.zone
      const isSelectedMarker = marker.properties.id === confirmedMarker.id

      return {
        ...marker,
        properties: {
          ...marker.properties,
          status: isSelectedMarker
            ? 'selected'
            : isSameZone
              ? 'unavailable'
              : 'available',
        },
      }
    }),
  }
}

function removeLayerIfExists(map: mapboxgl.Map, layerId: string) {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId)
  }
}

export async function getNavigationRoute(
  from: CurrentLocation,
  to: LngLatTuple,
): Promise<NavigationRoute> {
  const cacheKey = getNavigationRouteCacheKey(from, to)
  const cachedRoute = navigationRouteCache.get(cacheKey)

  if (cachedRoute) {
    return cloneNavigationRoute(cachedRoute)
  }

  if (!MAPBOX_TOKEN) {
    const fallbackRoute = createFallbackNavigationRoute(from, to)

    navigationRouteCache.set(cacheKey, fallbackRoute)
    return cloneNavigationRoute(fallbackRoute)
  }

  if (!MAPBOX_DIRECTIONS_BASE_URL) {
    const fallbackRoute = createFallbackNavigationRoute(from, to)

    navigationRouteCache.set(cacheKey, fallbackRoute)
    return cloneNavigationRoute(fallbackRoute)
  }

  const routeUrl = new URL(
    `${MAPBOX_DIRECTIONS_BASE_URL}/${from[0]},${from[1]};${to[0]},${to[1]}`,
  )
  routeUrl.searchParams.set('geometries', 'geojson')
  routeUrl.searchParams.set('overview', 'full')
  routeUrl.searchParams.set('access_token', MAPBOX_TOKEN)

  const response = await fetch(routeUrl)

  if (!response.ok) {
    const fallbackRoute = createFallbackNavigationRoute(from, to)

    navigationRouteCache.set(cacheKey, fallbackRoute)
    return cloneNavigationRoute(fallbackRoute)
  }

  const data = await response.json()
  const route = data.routes?.[0]
  const coordinates = route?.geometry?.coordinates
  const distanceKm =
    typeof route?.distance === 'number'
      ? route.distance / 1000
      : calculateDistanceKm(from, to)

  const navigationRoute = {
    coordinates: Array.isArray(coordinates) && coordinates.length > 0 ? coordinates : [from, to],
    distanceKm,
  }

  navigationRouteCache.set(cacheKey, navigationRoute)
  return cloneNavigationRoute(navigationRoute)
}

function getNavigationRouteCacheKey(from: LngLatTuple, to: LngLatTuple) {
  return `${formatRouteCacheCoordinate(from)}:${formatRouteCacheCoordinate(to)}`
}

function formatRouteCacheCoordinate([longitude, latitude]: LngLatTuple) {
  return `${longitude.toFixed(6)},${latitude.toFixed(6)}`
}

function createFallbackNavigationRoute(from: CurrentLocation, to: LngLatTuple): NavigationRoute {
  return {
    coordinates: [from, to],
    distanceKm: calculateDistanceKm(from, to),
  }
}

function cloneNavigationRoute(route: NavigationRoute): NavigationRoute {
  return {
    distanceKm: route.distanceKm,
    coordinates: route.coordinates.map((coordinate) => [...coordinate] as LngLatTuple),
  }
}

export function calculateDistanceKm(from: LngLatTuple, to: LngLatTuple) {
  const earthRadiusKm = 6371
  const latitudeDelta = ((to[1] - from[1]) * Math.PI) / 180
  const longitudeDelta = ((to[0] - from[0]) * Math.PI) / 180
  const fromLatitude = (from[1] * Math.PI) / 180
  const toLatitude = (to[1] * Math.PI) / 180
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export const formatDistanceKm = (distanceKm: number) => `${distanceKm.toFixed(2)} km`

export function calculateBearing(from: LngLatTuple, to: LngLatTuple) {
  const fromLatitude = (from[1] * Math.PI) / 180
  const toLatitude = (to[1] * Math.PI) / 180
  const longitudeDelta = ((to[0] - from[0]) * Math.PI) / 180
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude)
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta)

  return (Math.atan2(y, x) * 180) / Math.PI
}

export function focusNavigationView(
  map: mapboxgl.Map,
  from: CurrentLocation,
  routeCoordinates: RouteCoordinates,
  destination: LngLatTuple,
): Promise<void> {
  const nextRoutePoint = routeCoordinates.find(
    ([longitude, latitude]) => longitude !== from[0] || latitude !== from[1],
  )
  const bearingTarget = nextRoutePoint ?? destination

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>

    const handleMoveEnd = () => {
      clearTimeout(timeoutId)
      resolve()
    }

    map.once('moveend', handleMoveEnd)
    timeoutId = setTimeout(() => {
      map.off('moveend', handleMoveEnd)
      resolve()
    }, NAVIGATION_CAMERA.duration + 150)

    map.easeTo({
      center: from,
      bearing: calculateBearing(from, bearingTarget),
      ...NAVIGATION_CAMERA,
    })
  })
}

export function goToZone(map: mapboxgl.Map, zoneName: string) {
  const name = normalizeZoneName(zoneName)
  const children = ZONES.beirut.children

  if (name in children) {
    const zone = children[name as keyof typeof children]

    map.flyTo({
      center: zone.center,
      zoom: zone.zoom,
      speed: 1.2,
    })

    return
  }

  if (name === 'beirut') {
    map.fitBounds(ZONES.beirut.bounds, { padding: 40 })
  }
}

export function loadParkingSpots(zoneName: string) {
  // TODO: connect this to the parking spots API when it is available.
  return zoneName
}
