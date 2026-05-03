import type { ZonesConfig } from '../../shared/types'

export const ZONES: ZonesConfig = {
  beirut: {
    bounds: [
      [35.45, 33.85], // SW
      [35.55, 33.95], // NE
    ],
    children: {
      hamra: {
        bounds: [
          [35.470, 33.885],
          [35.495, 33.905],
        ],
        center: [35.482, 33.895],
        zoom: 15,
      },
      ashrafieh: {
        bounds: [
          [35.470, 33.890],
          [35.490, 33.910],
        ],
        center: [35.479853, 33.900235],
        zoom: 15,
      },
      verdun: {
        bounds: [
          [35.465, 33.865],
          [35.490, 33.885],
        ],
        center: [35.481376, 33.875435],
        zoom: 15,
      },
      rawshe: {
        bounds: [
          [35.455, 33.880],
          [35.475, 33.895],
        ],
        center: [35.465, 33.888],
        zoom: 15,
      },
    },
  },
}
