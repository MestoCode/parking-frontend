import { getStoredInternalAccessToken, refreshStoredInternalSession } from './internalAuth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export type AdminZone = {
  id?: string
  name?: string
  [key: string]: unknown
}

export type AdminNode = {
  id?: string
  name?: string
  status?: string
  isOnline?: boolean
  zoneId?: string
  [key: string]: unknown
}

export type AdminNodeFilters = {
  zoneId?: string
  status?: string
  isOnline?: boolean
}

function getApiUrl(path: string, searchParams?: URLSearchParams) {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured.')
  }

  const url = `${API_BASE_URL.replace(/\/$/, '')}${path}`
  const queryString = searchParams?.toString()

  return queryString ? `${url}?${queryString}` : url
}

function getAuthHeaders() {
  const accessToken = getStoredInternalAccessToken()

  if (!accessToken) {
    throw new Error('Internal session is missing.')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

async function readJsonError(response: Response) {
  try {
    const json = await response.json()

    return json?.message || json?.error || 'Request failed.'
  } catch {
    return 'Request failed.'
  }
}

async function fetchAdmin(path: string, init?: RequestInit, searchParams?: URLSearchParams) {
  return fetch(getApiUrl(path, searchParams), {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...init?.headers,
    },
  })
}

async function requestAdmin<T>(
  path: string,
  init?: RequestInit,
  searchParams?: URLSearchParams,
): Promise<T> {
  let response = await fetchAdmin(path, init, searchParams)

  if (response.status === 401) {
    await refreshStoredInternalSession()
    response = await fetchAdmin(path, init, searchParams)
  }

  if (!response.ok) {
    throw new Error(await readJsonError(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

function extractList<T>(response: unknown, keys: string[]): T[] {
  if (Array.isArray(response)) {
    return response as T[]
  }

  if (!response || typeof response !== 'object') {
    return []
  }

  const record = response as Record<string, unknown>

  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as T[]
    }
  }

  if (Array.isArray(record.data)) {
    return record.data as T[]
  }

  return []
}

export async function createAdminZone(payload: Record<string, unknown>) {
  return requestAdmin<AdminZone>('/admin/zones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function listAdminZones() {
  const response = await requestAdmin<unknown>('/admin/zones')

  return extractList<AdminZone>(response, ['zones', 'items'])
}

export async function getAdminZone(zoneId: string) {
  return requestAdmin<AdminZone>(`/admin/zones/${zoneId}`)
}

export async function listAdminZoneNodes(zoneId: string) {
  const response = await requestAdmin<unknown>(`/admin/zones/${zoneId}/nodes`)

  return extractList<AdminNode>(response, ['nodes', 'items'])
}

export async function createAdminNode(payload: Record<string, unknown>) {
  return requestAdmin<AdminNode>('/admin/nodes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function listAdminNodes(filters: AdminNodeFilters = {}) {
  const searchParams = new URLSearchParams()

  if (filters.zoneId) {
    searchParams.set('zoneId', filters.zoneId)
  }

  if (filters.status) {
    searchParams.set('status', filters.status)
  }

  if (typeof filters.isOnline === 'boolean') {
    searchParams.set('isOnline', String(filters.isOnline))
  }

  const response = await requestAdmin<unknown>('/admin/nodes', undefined, searchParams)

  return extractList<AdminNode>(response, ['nodes', 'items'])
}

export async function getAdminNode(nodeId: string) {
  return requestAdmin<AdminNode>(`/admin/nodes/${nodeId}`)
}

export async function moveAdminNodeToZone(nodeId: string, zoneId: string) {
  return requestAdmin<AdminNode>(`/admin/nodes/${nodeId}/zone`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ zoneId }),
  })
}
