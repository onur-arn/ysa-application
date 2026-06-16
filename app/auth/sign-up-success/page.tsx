"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { MailCheck } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n/context"

export default function SignUpSuccessPage() {
  const router = useRouter()
  const { t } = useI18n()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex w-full max-w-sm flex-col items-center text-center"
      >
        <Logo className="h-14 w-14" />
        <div className="mt-8 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="size-8 text-primary" />
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold tracking-tight text-foreground">
          {t("auth.signup")}
        </h1>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">{t("auth.checkEmail")}</p>
        <Button size="lg" className="mt-8 w-full" onClick={() => router.push("/auth/login")}>
          {t("auth.login")}
        </Button>
      </motion.div>
    </main>
  )
}
