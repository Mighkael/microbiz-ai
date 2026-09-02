import { Map, Table, LineChart, Layers, Download } from "lucide-react";
import WorkspaceIndex, { type Module } from "@/components/WorkspaceIndex";

const MODULES: Module[] = [
  {
    Icon: Map,
    title: "Geographic Explorer",
    body: "Business counts, employment, payroll and demographics by state, county and ZIP code — drawn from Census County Business Patterns and ACS.",
    phase: "Phase 2",
  },
  {
    Icon: Layers,
    title: "Sector Browser",
    body: "Explore any industry by NAICS code: how many establishments, where they concentrate, how employment is distributed.",
    phase: "Phase 2",
  },
  {
    Icon: Table,
    title: "Map, Table & Chart Views",
    body: "See the same data three ways, and switch between them without losing your filters.",
    phase: "Phase 8",
  },
  {
    Icon: LineChart,
    title: "Time Series",
    body: "How a market or industry has changed — employment, wages and business counts over time, from BLS.",
    phase: "Phase 8",
  },
  {
    Icon: Download,
    title: "Download",
    body: "Export any view with its source attribution, vintage and methodology attached.",
    phase: "Phase 8",
  },
];

export default function DataPage() {
  return (
    <WorkspaceIndex
      eyebrow="Data"
      title="Explore the data"
      lede="Public data on American small business — business counts, employment, demographics and market activity, down to ZIP code level. Every figure carries its source and date."
      modules={MODULES}
    />
  );
}
