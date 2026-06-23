"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

const Ctx = createContext<{
  hideNav: boolean
  setHideNav: (v: boolean) => void
}>({ hideNav: false, setHideNav: () => {} })

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [hideNav, setHideNav] = useState(false)
  return <Ctx.Provider value={{ hideNav, setHideNav }}>{children}</Ctx.Provider>
}

export function useNavVisibility() {
  return useContext(Ctx)
}
