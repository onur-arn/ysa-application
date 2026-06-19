declare module "react-simple-maps" {
  import type { ReactNode, CSSProperties, MouseEvent } from "react"

  interface ProjectionConfig {
    center?: [number, number]
    scale?: number
    rotate?: [number, number, number]
  }

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    style?: CSSProperties
    children?: ReactNode
  }
  export function ComposableMap(props: ComposableMapProps): JSX.Element

  interface GeographiesProps {
    geography: string | object
    children: (ctx: { geographies: any[] }) => ReactNode
  }
  export function Geographies(props: GeographiesProps): JSX.Element

  interface GeographyProps {
    geography: any
    fill?: string
    stroke?: string
    strokeWidth?: number
    onClick?: (e: MouseEvent) => void
    style?: { default?: CSSProperties; hover?: CSSProperties; pressed?: CSSProperties }
    [key: string]: any
  }
  export function Geography(props: GeographyProps): JSX.Element

  interface MarkerProps {
    coordinates: [number, number]
    onClick?: () => void
    children?: ReactNode
  }
  export function Marker(props: MarkerProps): JSX.Element
}
