"use client"

import { useState } from "react"
import { Calendar, Lightbulb } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Field, StationSelect, inputClass } from "@/components/form-fields"
import { useI18n } from "@/lib/i18n/context"

export function CreateContent({
  open,
  onClose,
  defaultTab,
}: {
  open: boolean
  onClose: () => void
  defaultTab: "events" | "ideas"
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<"events" | "ideas">(defaultTab)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [stationId, setStationId] = useState("paris")

  function reset() {
    setTitle("")
    setText("")
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "events" ? t("feed.newEvent") : t("feed.newIdea")}>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode("events")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${
            mode === "events" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          <Calendar className="h-4 w-4" /> {t("feed.events")}
        </button>
        <button
          onClick={() => setMode("ideas")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${
            mode === "ideas" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
          }`}
        >
          <Lightbulb className="h-4 w-4" /> {t("feed.ideas")}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <Field label={mode === "events" ? t("agenda.eventTitle") : t("feed.newIdea")}>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label={t("tasks.description")}>
          <textarea
            className="min-h-24 w-full rounded-xl border border-input bg-card p-3 text-base text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            placeholder={mode === "ideas" ? t("feed.ideaPlaceholder") : ""}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>

        <Field label={t("agenda.station")}>
          <StationSelect value={stationId} onChange={setStationId} />
        </Field>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={reset} disabled={!title.trim()}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
