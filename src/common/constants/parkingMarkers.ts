import type { ParkingMarkerFeatureCollection } from '../../shared/types'

export const PARKING_MARKERS_SOURCE_ID = 'parking-markers'
export const PARKING_MARKER_CLUSTERS_LAYER_ID = 'parking-marker-clusters'
export const PARKING_MARKER_CLUSTER_COUNT_LAYER_ID = 'parking-marker-cluster-count'
export const PARKING_MARKER_PULSE_LAYER_ID = 'parking-marker-pulse'
export const PARKING_MARKER_UNCLUSTERED_LAYER_ID = 'parking-marker-unclustered'

export const PARKING_MARKER_CLUSTER_OPTIONS = {
  cluster: true,
  clusterMaxZoom: 15,
  clusterRadius: 48,
}

export const PARKING_MARKERS_GEOJSON: ParkingMarkerFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-1',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 1',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.478873, 33.899738],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-2',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 2',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.478981, 33.899786],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-3',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 3',
        status: 'unavailable',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.479080, 33.899851],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-4',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 4',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.479068, 33.899869],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-5',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 5',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.478978, 33.899806],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'ashrafieh-marker-6',
        zone: 'ashrafieh',
        title: 'Ashrafieh marker 6',
        status: 'unavailable',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.478871, 33.899760],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-1',
        zone: 'hamra',
        title: 'Hamra marker 1',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482180, 33.895146],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-2',
        zone: 'hamra',
        title: 'Hamra marker 2',
        status: 'unavailable',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482232, 33.895141],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-3',
        zone: 'hamra',
        title: 'Hamra marker 3',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482175, 33.894829],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-4',
        zone: 'hamra',
        title: 'Hamra marker 4',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482119, 33.894827],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-5',
        zone: 'hamra',
        title: 'Hamra marker 5',
        status: 'unavailable',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482548, 33.894647],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-6',
        zone: 'hamra',
        title: 'Hamra marker 6',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482624, 33.894755],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'hamra-marker-7',
        zone: 'hamra',
        title: 'Hamra marker 7',
      },
      geometry: {
        type: 'Point',
        coordinates: [35.482916, 33.894623],
      },
    },
  ],
}
