"use client"

import { createContext, useContext, type ReactNode } from "react"
import { translations } from "./translations"

type I18nContextType = {
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

// The app is Turkish-only. We keep a tiny context so existing `t()` calls keep working.
export function I18nProvider({ children }: { children: ReactNode }) {
  const t = (key: string) => translations.tr[key] ?? key
  return <I18nContext.Provider value={{ t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
