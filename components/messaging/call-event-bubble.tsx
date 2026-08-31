"use client"

import { Phone, PhoneMissed, Video } from "lucide-react"
import {
  callEventLabel,
  formatCallDuration,
  type CallEventPayload,
} from "@/lib/call/call-event"

export function CallEventBubble({
  event,
  isSelf,
  time,
  onCallBack,
}: {
  event: CallEventPayload
  isSelf: boolean
  time: string
  onCallBack?: () => void
}) {
  const failed = event.outcome === "missed" || event.outcome === "declined"
  const Icon = event.callType === "video" ? Video : failed ? PhoneMissed : Phone

  return (
    <button
      type="button"
      onClick={onCallBack}
      className={`flex max-w-[85%] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left shadow-sm ${
        isSelf ? "rounded-br-[5px] ml-auto" : "rounded-bl-[5px]"
      } ${
        failed
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : isSelf
            ? "bg-primary text-primary-foreground"
            : "bg-card text-foreground"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          failed ? "bg-red-500/15" : isSelf ? "bg-white/20" : "bg-primary/10"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">
          {callEventLabel(event, isSelf)}
        </span>
        <span className={`block text-[10px] ${failed ? "opacity-80" : isSelf ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {event.outcome === "ended" && event.durationSec != null
            ? formatCallDuration(event.durationSec)
            : time}
        </span>
      </span>
    </button>
  )
}
