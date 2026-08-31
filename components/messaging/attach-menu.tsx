"use client"

import { BarChart2, ImageIcon, Smile } from "lucide-react"

export function AttachMenu({ open, onClose, onImage, onGif, onPoll }: {
  open: boolean
  onClose: () => void
  onImage: () => void
  onGif: () => void
  onPoll: () => void
}) {
  if (!open) return null
  return (
    <div className="absolute bottom-full left-0 z-10 mb-2 w-48 rounded-2xl bg-background/95 p-1 shadow-lg ring-1 ring-border/50 backdrop-blur-xl">
      <button type="button" onClick={() => { onImage(); onClose() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-secondary">
        <ImageIcon className="size-5 text-primary" /> Fotoğraf
      </button>
      <button type="button" onClick={() => { onGif(); onClose() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-secondary">
        <Smile className="size-5 text-amber-500" /> GIF
      </button>
      <button type="button" onClick={() => { onPoll(); onClose() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm active:bg-secondary">
        <BarChart2 className="size-5 text-violet-500" /> Anket
      </button>
    </div>
  )
}
