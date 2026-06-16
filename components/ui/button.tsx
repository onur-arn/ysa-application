"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import type { ButtonHTMLAttributes, ReactNode } from "react"

function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "destructive"
  size?: "sm" | "md" | "lg" | "icon"
  children: ReactNode
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-secondary text-foreground",
    outline: "border border-border bg-card hover:bg-secondary text-foreground",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
  }
  const sizes = {
    sm: "h-9 px-3 text-sm rounded-xl",
    md: "h-11 px-4 text-sm rounded-2xl",
    lg: "h-12 px-5 text-base rounded-2xl",
    icon: "h-11 w-11 rounded-2xl",
  }
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const MotionButton = motion.create(Button)

export { Button, MotionButton }
