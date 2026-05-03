import { useEffect, useState } from 'react'
import { ParkingMap } from './components/ParkingMap/index'
import { LoginPage } from './components/LoginPage/index'

const getCurrentRoute = () => (window.location.pathname === '/login' ? 'login' : 'map')

function App() {
  const [route, setRoute] = useState(getCurrentRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(getCurrentRoute())

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setRoute(getCurrentRoute())
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <section className="h-full w-full">
        {route === 'login' ? (
          <LoginPage onBack={() => navigateTo('/')} />
        ) : (
          <ParkingMap onLoginClick={() => navigateTo('/login')} />
        )}
      </section>
    </main>
  )
}

export default App
