import type { Area } from "react-easy-crop"

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
): Promise<{ dataUrl: string; file: File }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })
  const canvas = document.createElement("canvas")
  const MAX = 300
  const size = Math.min(pixelCrop.width, pixelCrop.height, MAX)
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), "image/jpeg", 0.8))
  const file = new File([blob], "photo.jpg", { type: "image/jpeg" })
  return { dataUrl, file }
}
