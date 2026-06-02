const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export type LiveDeviceType = 'gateway' | 'node'

/**
 * A real mesh device (gateway / node) reported over the network and persisted
 * by the backend. These are the "live" devices, as opposed to the hardcoded
 * demo markers baked into the client map.
 */
export type LiveDevice = {
  deviceId: string
  type: LiveDeviceType
  latitude: number
  longitude: number
  lastSeenAt: string | null
}

function getApiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured.')
  }

  return `${API_BASE_URL.replace(/\/$/, '')}${path}`
}

function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Fetch real mesh devices from the public GET /devices endpoint. Returns an
 * empty list (never throws) so the map/dashboard still render their demo data
 * if the backend is unreachable.
 */
export async function listLiveDevices(): Promise<LiveDevice[]> {
  try {
    const response = await fetch(getApiUrl('/devices'))

    if (!response.ok) {
      return []
    }

    const payload: unknown = await response.json()

    if (!Array.isArray(payload)) {
      return []
    }

    return payload
      .map((item) => {
        const record = item as Record<string, unknown>
        const latitude = Number(record.latitude)
        const longitude = Number(record.longitude)

        if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
          return null
        }

        const type = record.type === 'gateway' ? 'gateway' : 'node'

        return {
          deviceId: String(record.deviceId ?? ''),
          type,
          latitude,
          longitude,
          lastSeenAt:
            typeof record.lastSeenAt === 'string' ? record.lastSeenAt : null,
        } satisfies LiveDevice
      })
      .filter((device): device is LiveDevice => device !== null && device.deviceId !== '')
  } catch {
    return []
  }
}
