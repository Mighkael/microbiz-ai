import { Factory, Wheat, Store, Truck, Ship, Briefcase } from "lucide-react";
import { C } from "@/lib/theme";

/**
 * Homepage backdrop (V2 §2): a US map with subtle references to the sectors
 * MicroBiz AI covers.
 *
 * The map is served as a static asset from /public and tinted with a CSS
 * mask rather than inlined, so ~126KB of path data stays out of the page
 * payload and gets cached — while the page still controls its color.
 */

// Positions are percentages over the map's Albers USA projection, placed
// loosely where each sector concentrates: manufacturing in the Midwest,
// agriculture in the Plains, ports on the coasts.
const SECTORS = [
  { Icon: Factory, label: "Manufacturing", top: "31%", left: "63%" },
  { Icon: Wheat, label: "Agriculture", top: "40%", left: "46%" },
  { Icon: Truck, label: "Transportation", top: "62%", left: "44%" },
  { Icon: Store, label: "Retail", top: "27%", left: "78%" },
  { Icon: Ship, label: "Trade", top: "70%", left: "72%" },
  { Icon: Briefcase, label: "Services", top: "52%", left: "20%" },
];

export default function UsMapBackdrop() {
  return (
    <div aria-hidden="true" style={{
      position: "absolute", inset: 0, overflow: "hidden",
      pointerEvents: "none", userSelect: "none",
    }}>
      <div style={{
        position: "absolute",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(1180px, 130%)", aspectRatio: "975 / 610",
        background: C.ledger,
        opacity: 0.12,
        WebkitMaskImage: "url(/us-map.svg)",
        maskImage: "url(/us-map.svg)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }} />

      <div style={{
        position: "absolute",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(1180px, 130%)", aspectRatio: "975 / 610",
      }}>
        {SECTORS.map(({ Icon, label, top, left }) => (
          <div key={label} title={label} style={{
            position: "absolute", top, left, transform: "translate(-50%, -50%)",
            color: C.ink, opacity: 0.13,
          }}>
            <Icon size={26} strokeWidth={1.5} />
          </div>
        ))}
      </div>
    </div>
  );
}
