"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { type Lang, translations } from "./translations"

type I18nContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr")

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("ys-lang") as Lang | null) : null
    if (stored && translations[stored]) setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    if (typeof window !== "undefined") localStorage.setItem("ys-lang", l)
  }

  const t = (key: string) => translations[lang][key] ?? translations.fr[key] ?? key

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
