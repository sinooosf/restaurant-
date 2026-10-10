import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Utensils,
} from 'lucide-react'
import { useAdminAuth } from './AdminAuthContext'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    if (!password) return

    setLoading(true)
    setError('')

    try {
      await login(password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Incorrect password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#080808] text-white">

      {/* Restaurant background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=2200&q=85')",
        }}
      />

      {/* Dark cinematic overlay */}
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

      {/* Red ambient light */}
      <div className="absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-red-700/20 blur-[140px]" />
      <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-red-900/20 blur-[150px]" />

      {/* Content */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-10">

        <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_430px]">

          {/* Left side */}
          <section className="hidden lg:block">

            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B0000]">
                <Utensils size={15} />
              </div>

              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Restaurant Management
              </span>
            </div>

            <h1 className="max-w-2xl font-display text-6xl font-semibold leading-[0.95] tracking-tight">
              Your restaurant.
              <br />
              <span className="text-[#E50914]">
                Your control.
              </span>
            </h1>

            <p className="mt-7 max-w-lg text-base leading-7 text-white/55">
              Manage your menu, orders, restaurant content and digital
              experience from one powerful dashboard.
            </p>

            <div className="mt-10 flex items-center gap-8 text-sm text-white/50">
              <div>
                <p className="text-2xl font-semibold text-white">24/7</p>
                <p className="mt-1">Management</p>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div>
                <p className="text-2xl font-semibold text-white">Fast</p>
                <p className="mt-1">Order control</p>
              </div>

              <div className="h-10 w-px bg-white/10" />

              <div>
                <p className="text-2xl font-semibold text-white">Secure</p>
                <p className="mt-1">Admin access</p>
              </div>
            </div>
          </section>

          {/* Login card */}
          <section className="w-full">

            <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-black/45 p-2 shadow-2xl shadow-black/60 backdrop-blur-2xl">

              {/* Red top glow */}
              <div className="absolute left-1/2 top-0 h-1 w-32 -translate-x-1/2 rounded-full bg-[#E50914] shadow-[0_0_35px_rgba(229,9,20,0.8)]" />

              <div className="rounded-[25px] border border-white/[0.06] bg-black/35 p-7 sm:p-9">

                {/* Brand */}
                <div className="mb-8 flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E50914] to-[#650000] shadow-lg shadow-red-950/40">
                      <Utensils size={20} />
                    </div>

                    <div>
                      <p className="font-display text-lg font-semibold">
                        Restaurant
                      </p>

                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                        Admin Portal
                      </p>
                    </div>

                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <ShieldCheck
                      size={16}
                      className="text-[#E50914]"
                    />
                  </div>

                </div>

                {/* Heading */}
                <div>
                  <h2 className="font-display text-3xl font-semibold tracking-tight">
                    Welcome back
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    Sign in to access your restaurant dashboard.
                  </p>
                </div>

                {/* Form */}
                <form
                  onSubmit={handleSubmit}
                  className="mt-8"
                >

                  <label
                    htmlFor="admin-password"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/55"
                  >
                    Admin password
                  </label>

                  <div className="relative">

                    <LockKeyhole
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                    />

                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        if (error) setError('')
                      }}
                      placeholder="Enter your password"
                      autoFocus
                      autoComplete="current-password"
                      className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-[#E50914]/70 focus:bg-white/[0.08] focus:ring-4 focus:ring-[#E50914]/10"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white"
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>

                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />

                      <p className="text-xs leading-5 text-red-300">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Button */}
                  <button
                    type="submit"
                    disabled={loading || !password}
                    className="group mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#E50914] text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition duration-300 hover:bg-[#ff1722] hover:shadow-xl hover:shadow-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Checking access...
                      </>
                    ) : (
                      <>
                        Enter dashboard

                        <ArrowRight
                          size={17}
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </button>

                </form>

                {/* Security */}
                <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-white/25">
                  <ShieldCheck size={13} />
                  Protected administrator access
                </div>

              </div>
            </div>

            {/* Bottom text */}
            <p className="mt-5 text-center text-[11px] text-white/25">
              Authorized restaurant staff only
            </p>

          </section>

        </div>
      </div>
    </main>
  )
}