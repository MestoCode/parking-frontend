const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const INTERNAL_ACCESS_TOKEN_KEY = 'parkMeshInternalAccessToken'
const INTERNAL_REFRESH_TOKEN_KEY = 'parkMeshInternalRefreshToken'
const INTERNAL_USER_ID_KEY = 'parkMeshInternalUserId'

type InternalAuthPayload = {
  username: string
  password: string
}

export type InternalAuthResponse = {
  accessToken?: string
  refreshToken?: string
  user?: {
    id?: string
    [key: string]: unknown
  }
}

type InternalRefreshResponse = Pick<InternalAuthResponse, 'accessToken' | 'refreshToken'>

let pendingInternalRefresh: Promise<InternalRefreshResponse> | null = null

function getApiUrl(path: string) {
  if (!API_BASE_URL) {
    throw new Error('API base URL is not configured.')
  }

  return `${API_BASE_URL.replace(/\/$/, '')}${path}`
}

async function readJsonError(response: Response) {
  try {
    const json = await response.json()

    return json?.message || json?.error || 'Request failed.'
  } catch {
    return 'Request failed.'
  }
}

export async function loginInternalUser({
  username,
  password,
}: InternalAuthPayload): Promise<InternalAuthResponse> {
  const response = await fetch(getApiUrl('/auth/internal/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error(await readJsonError(response))
  }

  return response.json()
}

export async function refreshInternalUserToken(refreshToken: string) {
  const response = await fetch(getApiUrl('/auth/internal/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  })

  if (!response.ok) {
    throw new Error(await readJsonError(response))
  }

  return response.json() as Promise<InternalRefreshResponse>
}

export async function logoutInternalUser(accessToken: string) {
  const response = await fetch(getApiUrl('/auth/internal/logout'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok && response.status !== 204) {
    throw new Error(await readJsonError(response))
  }
}

export function storeInternalAuthSession(authResponse: InternalAuthResponse) {
  if (authResponse.accessToken) {
    localStorage.setItem(INTERNAL_ACCESS_TOKEN_KEY, authResponse.accessToken)
  }

  if (authResponse.refreshToken) {
    localStorage.setItem(INTERNAL_REFRESH_TOKEN_KEY, authResponse.refreshToken)
  }

  if (authResponse.user?.id) {
    localStorage.setItem(INTERNAL_USER_ID_KEY, authResponse.user.id)
  }
}

export function storeInternalRefreshSession(authResponse: InternalRefreshResponse) {
  if (authResponse.accessToken) {
    localStorage.setItem(INTERNAL_ACCESS_TOKEN_KEY, authResponse.accessToken)
  }

  if (authResponse.refreshToken) {
    localStorage.setItem(INTERNAL_REFRESH_TOKEN_KEY, authResponse.refreshToken)
  }
}

export async function refreshStoredInternalSession() {
  const refreshToken = getStoredInternalRefreshToken()

  if (!refreshToken) {
    clearInternalAuthSession()
    throw new Error('Internal session expired. Please login again.')
  }

  if (!pendingInternalRefresh) {
    pendingInternalRefresh = refreshInternalUserToken(refreshToken)
      .then((authResponse) => {
        storeInternalRefreshSession(authResponse)

        return authResponse
      })
      .catch((error) => {
        clearInternalAuthSession()
        throw error
      })
      .finally(() => {
        pendingInternalRefresh = null
      })
  }

  return pendingInternalRefresh
}

export function getStoredInternalAccessToken() {
  return localStorage.getItem(INTERNAL_ACCESS_TOKEN_KEY)
}

export function getStoredInternalRefreshToken() {
  return localStorage.getItem(INTERNAL_REFRESH_TOKEN_KEY)
}

export function clearInternalAuthSession() {
  localStorage.removeItem(INTERNAL_ACCESS_TOKEN_KEY)
  localStorage.removeItem(INTERNAL_REFRESH_TOKEN_KEY)
  localStorage.removeItem(INTERNAL_USER_ID_KEY)
}
