import type mapboxgl from 'mapbox-gl'
import type { CurrentLocation } from '../../shared/types'

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export const MAP_STYLE = import.meta.env.VITE_MAPBOX_STYLE_URL
export const MAPBOX_RTL_TEXT_PLUGIN_URL = import.meta.env.VITE_MAPBOX_RTL_TEXT_PLUGIN_URL
export const MAPBOX_DIRECTIONS_BASE_URL = import.meta.env.VITE_MAPBOX_DIRECTIONS_BASE_URL
export const MAP_CENTER: mapboxgl.LngLatLike = [35.5018, 33.8938]
export const MAP_ZOOM = 15
export const MAP_PITCH = 45
export const MAP_BEARING = 0

export const MAP_CONFIG = {
  basemap: {
    lightPreset: 'night',
    theme: 'faded',
    showPointOfInterestLabels: false,
    showTransitLabels: false,
  },
}

export const DEFAULT_CURRENT_LOCATION: CurrentLocation = [35.482, 33.895]
export const DEFAULT_CURRENT_LOCATION_LABEL = 'My Location'

export const MAP_MAX_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [35.0, 33.0], // SW
  [37.5, 34.8], // NE
]

export const NAVIGATION_CAMERA = {
  zoom: 17,
  pitch: 60,
  duration: 1200,
  padding: {
    top: 90,
    right: 80,
    bottom: 220,
    left: 80,
  },
}
