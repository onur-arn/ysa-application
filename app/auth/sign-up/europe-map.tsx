"use client"

import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import { STATIONS, type StationId } from "@/lib/data/stations"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// ISO numeric IDs — Europe complète + Balkans + Turquie
const EUROPE_IDS = new Set([
  // Europe occidentale
  250, 276, 56, 528, 756, 40, 724, 380, 826, 620, 442,
  // Europe centrale & orientale
  203, 703, 348, 616, 208, 246, 578, 752, 440, 428, 233,
  // Balkans
  191, 705, 70, 688, 499, 807, 8, 642, 100, 300,
  // Europe de l'Est élargie
  498, 112, 804, 643,
  // Turquie
  792,
])

const CITY_COORDS: Record<string, [number, number]> = {
  paris:      [2.35, 48.85],
  caen:       [-0.37, 49.18],
  nancy:      [6.18, 48.69],
  strasbourg: [7.75, 48.57],
  lyon:       [4.83, 45.75],
  hamburg:    [10.0, 53.55],
  bucarest:   [26.1, 44.43],
}

// Label offset [dx, dy] to avoid overlapping the dot
const LABEL_OFFSET: Record<string, [number, number]> = {
  paris:      [-8, -14],
  caen:       [-34, -7],
  nancy:      [-8, -14],
  strasbourg: [8, -7],
  lyon:       [8, 5],
  hamburg:    [8, -7],
  bucarest:   [8, -7],
}

export function EuropeMap({
  selected,
  onSelect,
}: {
  selected: StationId
  onSelect: (id: StationId) => void
}) {
  const visibleStations = STATIONS.filter(s => s.id !== "intl" && CITY_COORDS[s.id])

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [16, 47], scale: 560 }}
      width={540}
      height={340}
      style={{ width: "100%", height: "auto" }}
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies
            .filter((geo: any) => EUROPE_IDS.has(+geo.id))
            .map((geo: any) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                stroke="white"
                strokeWidth={0.5}
                style={{
                  default: { fill: "var(--color-secondary)", outline: "none" },
                  hover:   { fill: "var(--color-secondary)", outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
        }
      </Geographies>

      {visibleStations.map(s => {
        const coords = CITY_COORDS[s.id]
        const offset = LABEL_OFFSET[s.id] ?? [8, -7]
        const isSelected = selected === "intl" || selected === s.id
        return (
          <Marker key={s.id} coordinates={coords} onClick={() => onSelect(s.id)}>
            <circle
              r={isSelected ? 9 : 6}
              fill={`hsl(${s.color})`}
              stroke="white"
              strokeWidth={2}
              style={{ cursor: "pointer", transition: "r 0.15s" }}
            />
            <text
              x={offset[0]}
              y={offset[1]}
              fontSize={isSelected ? 9 : 8}
              fontWeight={isSelected ? "700" : "500"}
              fill={isSelected ? `hsl(${s.color})` : "#6b7280"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {s.city}
            </text>
          </Marker>
        )
      })}
    </ComposableMap>
  )
}
