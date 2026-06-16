"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { User, Bell, Info, LogOut, Globe, Check, ChevronRight } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { LANGS, type Lang } from "@/lib/i18n/translations"
import { getStation } from "@/lib/data/stations"
import { PageHeader } from "@/components/app-shell"
import { createClient } from "@/lib/supabase/client"

export function SettingsClient({
  email,
  fullName,
  station,
}: {
  email: string
  fullName: string
  station: string
}) {
  const { t, lang, setLang } = useI18n()
  const router = useRouter()
  const [langOpen, setLangOpen] = useState(false)
  const [notifs, setNotifs] = useState({ push: true, email: false, events: true })
  const [loggingOut, setLoggingOut] = useState(false)

  const stationInfo = getStation(station as never)
  const initials =
    fullName
      .trim()
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || (email[0]?.toUpperCase() ?? "U")

  async function logout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div>
      <PageHeader title={t("settings.title")} />

      <div className="flex flex-col gap-6 px-4 pt-2">
        {/* Profile card */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <span
            className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ backgroundColor: `hsl(${stationInfo.color})` }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-bold text-foreground">{fullName || email}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: `hsl(${stationInfo.color})` }}
            >
              {stationInfo.name}
            </span>
          </div>
        </div>

        {/* Language */}
        <Section title={t("settings.language")} icon={Globe}>
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3.5"
          >
            <span className="flex items-center gap-2 text-foreground">
              <span className="text-lg">{LANGS.find((l) => l.code === lang)?.flag}</span>
              {LANGS.find((l) => l.code === lang)?.label}
            </span>
            <ChevronRight className={`size-5 text-muted-foreground transition-transform ${langOpen ? "rotate-90" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {langOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-border"
              >
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code as Lang)
                      setLangOpen(false)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary"
                  >
                    <span className="text-lg">{l.flag}</span>
                    <span className="flex-1 text-foreground">{l.label}</span>
                    {lang === l.code && <Check className="size-5 text-primary" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* Account */}
        <Section title={t("settings.account")} icon={User}>
          <Row label={t("auth.fullName")} value={fullName || "—"} />
          <Row label={t("auth.email")} value={email} last />
        </Section>

        {/* Notifications */}
        <Section title={t("settings.notifications")} icon={Bell}>
          <Toggle
            label={t("settings.pushNotif")}
            checked={notifs.push}
            onChange={() => setNotifs((n) => ({ ...n, push: !n.push }))}
          />
          <Toggle
            label={t("settings.emailNotif")}
            checked={notifs.email}
            onChange={() => setNotifs((n) => ({ ...n, email: !n.email }))}
          />
          <Toggle
            label={t("settings.events")}
            checked={notifs.events}
            onChange={() => setNotifs((n) => ({ ...n, events: !n.events }))}
            last
          />
        </Section>

        {/* About */}
        <Section title={t("settings.about")} icon={Info}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-foreground">YouthStation</span>
            <span className="text-sm text-muted-foreground">{t("settings.version")}</span>
          </div>
        </Section>

        {/* Logout */}
        <button
          onClick={logout}
          disabled={loggingOut}
          className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 font-semibold text-destructive transition-colors active:bg-destructive/10 disabled:opacity-60"
        >
          <LogOut className="size-5" />
          {t("settings.logout")}
        </button>
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof User
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </div>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  last,
}: {
  label: string
  checked: boolean
  onChange: () => void
  last?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? "" : "border-b border-border"}`}>
      <span className="text-foreground">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"}`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={`absolute top-1 size-5 rounded-full bg-white shadow ${checked ? "right-1" : "left-1"}`}
        />
      </button>
    </div>
  )
}
