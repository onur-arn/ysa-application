import Image from "next/image"
import { cn } from "@/lib/utils"

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-white", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/youthstation-logo.jpg"
        alt="YouthStation"
        width={size}
        height={size}
        className="object-contain p-1"
        priority
      />
    </span>
  )
}
