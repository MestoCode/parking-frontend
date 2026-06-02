import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import React from 'react'
import { loginInternalUser, storeInternalAuthSession } from '../../services/internalAuth'

type LoginPageProps = {
  onBack: () => void
  onLoginSuccess: () => void
}

type LoginErrors = {
  username?: string
  password?: string
  form?: string
}

function LoginLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-12 w-12" fill="none">
      <rect width="48" height="48" rx="16" fill="#059669" />
      <path
        d="M14 32V16h10.5c4.2 0 7 2.58 7 6.45 0 3.94-2.8 6.55-7 6.55h-5V32H14Zm5.5-7.48h4.32c1.48 0 2.38-.78 2.38-2.07 0-1.24-.9-2-2.38-2H19.5v4.07Z"
        fill="white"
      />
      <path
        d="M33 33a2.65 2.65 0 1 0 0-5.3A2.65 2.65 0 0 0 33 33Z"
        fill="#BBF7D0"
      />
    </svg>
  )
}

export function LoginPage({ onBack, onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: LoginErrors = {}

    if (!username.trim()) {
      nextErrors.username = 'Enter your username.'
    }

    if (!password) {
      nextErrors.password = 'Enter your password.'
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)

    try {
      const authResponse = await loginInternalUser({
        username: username.trim(),
        password,
      })

      storeInternalAuthSession(authResponse)
      onLoginSuccess()
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Login failed. Try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-8 text-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.26),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-white/10 to-transparent" />
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/10 text-white shadow-[0_18px_46px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-white/18"
        aria-label="Back to map"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current">
          <path
            d="M15.5 5.5 9 12l6.5 6.5"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <motion.section
        initial={{ opacity: 0, y: 28, scale: 0.97, filter: 'blur(12px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.38, ease: 'easeOut' }}
        className="relative grid w-full max-w-5xl overflow-hidden rounded-4xl border border-white/12 bg-white shadow-[0_36px_100px_rgba(0,0,0,0.32)] lg:grid-cols-[1fr_26rem]"
      >
        <div className="relative hidden min-h-150 overflow-hidden bg-zinc-950 p-8 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(16,185,129,0.38),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,1))]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <LoginLogo />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.28em] text-emerald-300">
                Park Mesh
              </p>
              <h1 className="mt-3 max-w-md text-4xl font-semibold tracking-tight">
                One secure access point for smart parking.
              </h1>
            </div>

            <div className="grid gap-3">
              {['Parking sessions', 'Saved locations', 'Payment history'].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-55" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />
                  </span>
                  <span className="text-sm font-semibold text-white/88">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div>
            <div className="lg:hidden">
              <LoginLogo />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
              Login
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Welcome back
            </h2>
          </div>

          <form noValidate onSubmit={handleLoginSubmit} className="mt-7 grid gap-3">
            {errors.form && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
                {errors.form}
              </div>
            )}

            <label
              className={`rounded-2xl border bg-zinc-50 px-3 py-2 transition focus-within:border-emerald-300 ${
                errors.username ? 'border-rose-200 bg-rose-50/70' : 'border-zinc-200'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Username
              </span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    username: undefined,
                    form: undefined,
                  }))
                }}
                placeholder="superadmin@gmail.com"
                className="mt-1 w-full bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400"
              />
              {errors.username && (
                <span className="mt-2 block text-xs font-semibold text-rose-500">
                  {errors.username}
                </span>
              )}
            </label>

            <label
              className={`rounded-2xl border bg-zinc-50 px-3 py-2 transition focus-within:border-emerald-300 ${
                errors.password ? 'border-rose-200 bg-rose-50/70' : 'border-zinc-200'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrors((currentErrors) => ({
                    ...currentErrors,
                    password: undefined,
                    form: undefined,
                  }))
                }}
                placeholder="Enter password"
                className="mt-1 w-full bg-transparent text-sm font-semibold text-zinc-950 outline-none placeholder:text-zinc-400"
              />
              {errors.password && (
                <span className="mt-2 block text-xs font-semibold text-rose-500">
                  {errors.password}
                </span>
              )}
            </label>

            <div className="flex items-center justify-between gap-3 py-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-600">
                <input type="checkbox" className="h-4 w-4 accent-emerald-600" />
                Remember me
              </label>
              <button type="button" className="text-sm font-bold text-emerald-700">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(24,24,27,0.2)] transition hover:bg-emerald-600"
            >
              {isSubmitting ? 'Signing in...' : 'Continue'}
            </button>

            <button
              type="button"
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50"
            >
              Continue with SSO
            </button>
          </form>
        </div>
      </motion.section>
    </main>
  )
}
