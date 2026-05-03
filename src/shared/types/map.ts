import type mapboxgl from 'mapbox-gl'

export type LngLatTuple = [number, number]
export type CurrentLocation = LngLatTuple
export type RouteCoordinates = LngLatTuple[]
export type RouteMarkerType = 'from' | 'to'

export type NavigationRoute = {
  coordinates: RouteCoordinates
  distanceKm: number
}

export type CustomMapMarker = {
  id: string
  coordinates: LngLatTuple
}

export type ParkingMarkerProperties = {
  id: string
  zone: ZoneName
  title: string
  status?: 'available' | 'selected' | 'unavailable'
}

export type ParkingMarkerFeature = {
  type: 'Feature'
  properties: ParkingMarkerProperties
  geometry: {
    type: 'Point'
    coordinates: LngLatTuple
  }
}

export type ParkingMarkerFeatureCollection = {
  type: 'FeatureCollection'
  features: ParkingMarkerFeature[]
}

export type ZoneName = 'beirut' | 'hamra' | 'ashrafieh' | 'verdun' | 'rawshe'

export type ChildZoneConfig = {
  bounds: [LngLatTuple, LngLatTuple]
  center: LngLatTuple
  zoom: number
}

export type ZonesConfig = {
  beirut: {
    bounds: [LngLatTuple, LngLatTuple]
    children: Record<Exclude<ZoneName, 'beirut'>, ChildZoneConfig>
  }
}

export type ParkingMapMarkerRefs = {
  from: mapboxgl.Marker | null
  to: mapboxgl.Marker | null
}
