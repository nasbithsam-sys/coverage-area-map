import { useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";

// Simplified US state paths for an SVG map
const US_STATES: Record<string, { path: string; cx: number; cy: number; name: string }> = {
  AL: { path: "M628,390 L628,430 L610,440 L605,435 L605,390Z", cx: 617, cy: 415, name: "Alabama" },
  AK: { path: "M120,460 L170,460 L170,500 L120,500Z", cx: 145, cy: 480, name: "Alaska" },
  AZ: { path: "M200,350 L250,350 L255,410 L195,410Z", cx: 225, cy: 380, name: "Arizona" },
  AR: { path: "M545,370 L595,370 L595,410 L545,410Z", cx: 570, cy: 390, name: "Arkansas" },
  CA: { path: "M100,220 L140,210 L160,340 L120,380 L90,340Z", cx: 125, cy: 300, name: "California" },
  CO: { path: "M280,280 L350,280 L350,330 L280,330Z", cx: 315, cy: 305, name: "Colorado" },
  CT: { path: "M770,200 L790,195 L795,210 L775,215Z", cx: 782, cy: 205, name: "Connecticut" },
  DE: { path: "M745,270 L755,265 L758,285 L748,285Z", cx: 751, cy: 275, name: "Delaware" },
  FL: { path: "M630,440 L690,430 L710,480 L680,510 L650,480 L630,450Z", cx: 670, cy: 470, name: "Florida" },
  GA: { path: "M640,370 L680,370 L685,430 L640,435Z", cx: 660, cy: 400, name: "Georgia" },
  HI: { path: "M250,470 L280,465 L285,485 L255,490Z", cx: 267, cy: 477, name: "Hawaii" },
  ID: { path: "M190,140 L230,130 L235,230 L195,230Z", cx: 213, cy: 185, name: "Idaho" },
  IL: { path: "M570,240 L600,240 L605,330 L570,335Z", cx: 587, cy: 285, name: "Illinois" },
  IN: { path: "M605,240 L635,240 L635,320 L605,325Z", cx: 620, cy: 280, name: "Indiana" },
  IA: { path: "M500,220 L565,220 L565,270 L500,270Z", cx: 532, cy: 245, name: "Iowa" },
  KS: { path: "M400,300 L490,300 L490,350 L400,350Z", cx: 445, cy: 325, name: "Kansas" },
  KY: { path: "M605,320 L685,300 L690,330 L610,345Z", cx: 648, cy: 322, name: "Kentucky" },
  LA: { path: "M545,415 L590,415 L600,460 L555,455Z", cx: 572, cy: 438, name: "Louisiana" },
  ME: { path: "M790,100 L815,90 L820,150 L795,155Z", cx: 805, cy: 125, name: "Maine" },
  MD: { path: "M720,265 L755,255 L758,275 L725,280Z", cx: 738, cy: 268, name: "Maryland" },
  MA: { path: "M770,185 L800,180 L802,195 L772,198Z", cx: 786, cy: 189, name: "Massachusetts" },
  MI: { path: "M580,140 L630,130 L640,220 L585,225Z", cx: 610, cy: 178, name: "Michigan" },
  MN: { path: "M470,110 L530,110 L535,200 L475,200Z", cx: 502, cy: 155, name: "Minnesota" },
  MS: { path: "M580,370 L610,370 L615,440 L580,440Z", cx: 597, cy: 405, name: "Mississippi" },
  MO: { path: "M510,290 L570,280 L575,360 L515,365Z", cx: 542, cy: 325, name: "Missouri" },
  MT: { path: "M230,100 L340,95 L345,170 L235,175Z", cx: 287, cy: 135, name: "Montana" },
  NE: { path: "M370,250 L470,245 L475,290 L375,295Z", cx: 422, cy: 270, name: "Nebraska" },
  NV: { path: "M155,210 L200,200 L210,330 L165,340Z", cx: 182, cy: 270, name: "Nevada" },
  NH: { path: "M780,130 L795,125 L798,175 L783,178Z", cx: 789, cy: 153, name: "New Hampshire" },
  NJ: { path: "M755,230 L770,225 L772,265 L755,268Z", cx: 763, cy: 248, name: "New Jersey" },
  NM: { path: "M240,350 L310,345 L315,420 L245,425Z", cx: 277, cy: 385, name: "New Mexico" },
  NY: { path: "M700,150 L770,140 L775,210 L710,215Z", cx: 738, cy: 180, name: "New York" },
  NC: { path: "M650,320 L740,310 L745,340 L655,350Z", cx: 697, cy: 330, name: "North Carolina" },
  ND: { path: "M370,110 L460,105 L465,165 L375,170Z", cx: 417, cy: 138, name: "North Dakota" },
  OH: { path: "M640,230 L690,225 L692,295 L642,300Z", cx: 666, cy: 262, name: "Ohio" },
  OK: { path: "M380,345 L490,340 L495,395 L385,395Z", cx: 437, cy: 368, name: "Oklahoma" },
  OR: { path: "M110,120 L190,110 L195,190 L115,195Z", cx: 152, cy: 155, name: "Oregon" },
  PA: { path: "M690,210 L755,205 L758,250 L695,255Z", cx: 724, cy: 230, name: "Pennsylvania" },
  RI: { path: "M790,200 L800,198 L802,210 L792,212Z", cx: 796, cy: 205, name: "Rhode Island" },
  SC: { path: "M670,350 L720,340 L725,375 L680,385Z", cx: 697, cy: 362, name: "South Carolina" },
  SD: { path: "M370,170 L465,165 L470,230 L375,235Z", cx: 420, cy: 198, name: "South Dakota" },
  TN: { path: "M580,335 L680,325 L685,355 L585,365Z", cx: 632, cy: 345, name: "Tennessee" },
  TX: { path: "M320,380 L460,370 L470,480 L380,500 L310,450Z", cx: 395, cy: 430, name: "Texas" },
  UT: { path: "M210,230 L280,225 L285,320 L215,325Z", cx: 247, cy: 275, name: "Utah" },
  VT: { path: "M770,130 L782,128 L784,170 L772,172Z", cx: 777, cy: 150, name: "Vermont" },
  VA: { path: "M670,280 L740,270 L748,310 L680,320Z", cx: 710, cy: 295, name: "Virginia" },
  WA: { path: "M120,70 L200,60 L205,130 L125,135Z", cx: 162, cy: 98, name: "Washington" },
  WV: { path: "M680,265 L710,260 L715,310 L685,315Z", cx: 697, cy: 288, name: "West Virginia" },
  WI: { path: "M530,130 L580,125 L585,215 L535,220Z", cx: 557, cy: 172, name: "Wisconsin" },
  WY: { path: "M250,180 L340,175 L345,250 L255,255Z", cx: 297, cy: 215, name: "Wyoming" },
};

interface USMapProps {
  technicians: Tables<"technicians">[];
  showPins?: boolean;
  onTechClick?: (tech: Tables<"technicians">) => void;
}

function getStateTechCount(technicians: Tables<"technicians">[]): Record<string, number> {
  const counts: Record<string, number> = {};
  technicians.forEach((t) => {
    if (t.is_active) {
      counts[t.state] = (counts[t.state] || 0) + 1;
    }
  });
  return counts;
}

function getStateColor(count: number): string {
  if (count === 0) return "hsl(var(--muted))";
  if (count <= 2) return "hsl(var(--coverage-weak))";
  if (count <= 5) return "hsl(var(--coverage-moderate))";
  return "hsl(var(--coverage-strong))";
}

export default function USMap({ technicians, showPins = false, onTechClick }: USMapProps) {
  const stateCounts = useMemo(() => getStateTechCount(technicians), [technicians]);

  return (
    <div className="relative w-full">
      <svg viewBox="60 50 790 470" className="w-full h-auto">
        {/* State shapes */}
        {Object.entries(US_STATES).map(([abbr, state]) => {
          const count = stateCounts[abbr] || 0;
          return (
            <g key={abbr}>
              <path
                d={state.path}
                fill={getStateColor(count)}
                stroke="hsl(var(--border))"
                strokeWidth="1"
                opacity={0.85}
                className="transition-all duration-200 hover:opacity-100 cursor-pointer"
              />
              <text
                x={state.cx}
                y={state.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] font-medium fill-foreground pointer-events-none select-none"
              >
                {abbr}
              </text>
              {count > 0 && (
                <text
                  x={state.cx}
                  y={state.cy + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[7px] fill-foreground/60 pointer-events-none select-none"
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}

        {/* Coverage radius circles */}
        {technicians
          .filter((t) => t.is_active)
          .map((tech) => (
            <circle
              key={`radius-${tech.id}`}
              cx={((tech.longitude + 130) / 65) * 750 + 60}
              cy={(1 - (tech.latitude - 24) / 26) * 420 + 60}
              r={tech.service_radius_miles / 4}
              fill="hsl(var(--primary) / 0.08)"
              stroke="hsl(var(--primary) / 0.2)"
              strokeWidth="0.5"
            />
          ))}

        {/* Tech pins (CSR/Admin only) */}
        {showPins &&
          technicians
            .filter((t) => t.is_active)
            .map((tech) => {
              const cx = ((tech.longitude + 130) / 65) * 750 + 60;
              const cy = (1 - (tech.latitude - 24) / 26) * 420 + 60;
              return (
                <g
                  key={`pin-${tech.id}`}
                  className="cursor-pointer"
                  onClick={() => onTechClick?.(tech)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--primary-foreground))"
                    strokeWidth="1.5"
                    className="hover:r-[6] transition-all"
                  />
                </g>
              );
            })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center mt-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--coverage-strong))" }} />
          <span>Strong (6+)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--coverage-moderate))" }} />
          <span>Moderate (3-5)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(var(--coverage-weak))" }} />
          <span>Weak (1-2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted border" />
          <span>None</span>
        </div>
      </div>
    </div>
  );
}
