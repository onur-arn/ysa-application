"use client"

import { Phone, Mail, Cake, ExternalLink, Home, GraduationCap, X, MessageCircle, Loader2 } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"
import { getStation, type Member } from "@/lib/data/stations"

const TR_MONTHS = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"]

function formatBirthday(dateStr?: string): string {
  if (!dateStr) return "—"
  const [y, m, d] = dateStr.split("-").map(Number)
  if (!y || !m || !d) return dateStr
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return `${d} ${TR_MONTHS[m - 1]} ${y} (${age} yaşında)`
}

export function MemberProfileContent({ member }: { member: Member }) {
  const { t } = useI18n()
  const station = getStation(member.station)

  const rows = [
    { icon: Phone, label: t("directory.phone"), value: member.phone, href: `tel:${member.phone}` },
    { icon: Mail, label: t("directory.email"), value: member.email, href: `mailto:${member.email}` },
    { icon: Cake, label: t("directory.birthday"), value: formatBirthday(member.birthday) },
    ...(member.memleket ? [{ icon: Home, label: t("directory.memleket"), value: member.memleket }] : []),
    ...(member.igemEgitimi
      ? [{
          icon: GraduationCap,
          label: "iGEM Eğitimi",
          value: member.igemEgitimi === "evet" ? "✅ Evet" : "❌ Hayır",
        }]
      : []),
    ...(member.linkedin ? [{ icon: ExternalLink, label: "LinkedIn", value: "Profili gör", href: member.linkedin }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          {member.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.photoUrl} alt={member.name} className="size-24 rounded-full object-cover" />
          ) : (
            <span
              className="flex size-24 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ backgroundColor: `hsl(${station.color})` }}
            >
              {member.initials}
            </span>
          )}
          {member.online && (
            <span className="absolute bottom-1 right-1 size-4 rounded-full border-2 border-card bg-emerald-500" />
          )}
        </div>
        <h3 className="mt-3 font-heading text-xl font-bold">{member.name}</h3>
        {member.role && (
          <span
            className="mt-1 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: `hsl(${station.color})` }}
          >
            {member.role}
          </span>
        )}
        <p className="mt-1 text-sm text-muted-foreground">{station.name}</p>
      </div>

      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const content = (
            <div className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors active:bg-secondary">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <r.icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="truncate font-medium text-foreground">{r.value || "—"}</p>
              </div>
            </div>
          )
          return r.href && r.value ? (
            <a key={r.label} href={r.href} target={r.label === "LinkedIn" ? "_blank" : undefined} rel="noopener noreferrer">
              {content}
            </a>
          ) : (
            <div key={r.label}>{content}</div>
          )
        })}
      </div>
    </div>
  )
}

/** Full-screen BeReal-style profile sheet */
export function MemberProfileSheet({
  member,
  onClose,
  onMessage,
  messaging,
  hideMessage,
}: {
  member: Member
  onClose: () => void
  onMessage?: () => void
  messaging?: boolean
  hideMessage?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-md flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full active:bg-secondary"
          aria-label="Kapat"
        >
          <X className="size-5" />
        </button>
        <span className="text-sm font-semibold text-foreground">Profil</span>
        <span className="size-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <MemberProfileContent member={member} />
        {!hideMessage && onMessage && (
          <button
            type="button"
            onClick={onMessage}
            disabled={messaging}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {messaging ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            Mesaj gönder
          </button>
        )}
      </div>
    </div>
  )
}
