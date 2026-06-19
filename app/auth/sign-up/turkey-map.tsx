"use client"

import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import { SEHIRLER } from "@/lib/data/stations"

const TURKEY_GEO_URL =
  "https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json"

function sehirName(s: string) {
  return s.replace(/^\d{2}-/, "")
}

function nameToSehir(name: string) {
  return SEHIRLER.find(s => sehirName(s) === name) ?? ""
}

export function TurkeyMap({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (sehir: string) => void
}) {
  const selectedName = selected ? sehirName(selected) : ""

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [35.5, 39], scale: 1700 }}
      width={600}
      height={300}
      style={{ width: "100%", height: "auto" }}
    >
      <Geographies geography={TURKEY_GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo: any) => {
            const name: string = geo.properties?.name ?? ""
            const isSelected = name === selectedName
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => {
                  const s = nameToSehir(name)
                  if (s) onSelect(s)
                }}
                stroke="white"
                strokeWidth={0.4}
                style={{
                  default: {
                    fill: isSelected ? "var(--color-primary)" : "var(--color-secondary)",
                    outline: "none",
                    cursor: "pointer",
                  },
                  hover: {
                    fill: isSelected ? "var(--color-primary)" : "var(--color-muted)",
                    outline: "none",
                    cursor: "pointer",
                  },
                  pressed: { outline: "none" },
                }}
              />
            )
          })
        }
      </Geographies>
    </ComposableMap>
  )
}
