import { useEffect, useState } from 'react'
import { ParkingMap } from './components/ParkingMap/index'
import { LoginPage } from './components/LoginPage/index'
import { InternalDashboard } from './components/InternalDashboard/index'
import {
  clearInternalAuthSession,
  getStoredInternalAccessToken,
  getStoredInternalRefreshToken,
  logoutInternalUser,
  refreshInternalUserToken,
  storeInternalRefreshSession,
} from './services/internalAuth'

const getCurrentRoute = () => {
  if (window.location.pathname === '/login') {
    return 'login'
  }

  if (window.location.pathname === '/dashboard') {
    return 'dashboard'
  }

  return 'map'
}

function App() {
  const [route, setRoute] = useState(getCurrentRoute)
  const [isRestoringSession, setIsRestoringSession] = useState(false)

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute())

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setRoute(getCurrentRoute())
  }

  useEffect(() => {
    if (route !== 'dashboard') {
      return
    }

    const accessToken = getStoredInternalAccessToken()

    if (accessToken) {
      return
    }

    const refreshToken = getStoredInternalRefreshToken()

    if (!refreshToken) {
      navigateTo('/login')
      return
    }

    let shouldCancel = false

    setIsRestoringSession(true)
    refreshInternalUserToken(refreshToken)
      .then((authResponse) => {
        if (shouldCancel) {
          return
        }

        storeInternalRefreshSession(authResponse)
      })
      .catch(() => {
        if (shouldCancel) {
          return
        }

        clearInternalAuthSession()
        navigateTo('/login')
      })
      .finally(() => {
        if (!shouldCancel) {
          setIsRestoringSession(false)
        }
      })

    return () => {
      shouldCancel = true
    }
  }, [route])

  const handleSignOut = async () => {
    const accessToken = getStoredInternalAccessToken()

    try {
      if (accessToken) {
        await logoutInternalUser(accessToken)
      }
    } catch {
      // Even if the backend logout fails, clear local auth state.
    } finally {
      clearInternalAuthSession()
      navigateTo('/login')
    }
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <section className="h-full w-full">
        {route === 'login' ? (
          <LoginPage
            onBack={() => navigateTo('/')}
            onLoginSuccess={() => navigateTo('/dashboard')}
          />
        ) : route === 'dashboard' && isRestoringSession ? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-sm font-bold text-white/60">
            Restoring session...
          </div>
        ) : route === 'dashboard' ? (
          <InternalDashboard onBackToMap={() => navigateTo('/')} onSignOut={handleSignOut} />
        ) : (
          <ParkingMap onLoginClick={() => navigateTo('/login')} />
        )}
      </section>
    </main>
  )
}

export default App
