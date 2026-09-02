import {
  ClipboardList, LayoutDashboard, MapPin, SlidersHorizontal,
  Users, Truck, Landmark, Lightbulb,
} from "lucide-react";
import WorkspaceIndex, { type Module } from "@/components/WorkspaceIndex";

const MODULES: Module[] = [
  {
    Icon: ClipboardList,
    title: "Business Assessment",
    body: "Tell us about your business and get a structured read on position, strengths, constraints, and outlook.",
    href: "/assessment",
  },
  {
    Icon: LayoutDashboard,
    title: "Dashboard",
    body: "Your financial picture: margins, cash flow, break-even, risk, and funding matches.",
    href: "/dashboard",
  },
  {
    Icon: MapPin,
    title: "Location Intelligence",
    body: "Score and compare markets on spending power, what businesses there earn, room in the market, and growth.",
    href: "/business/locations",
  },
  {
    Icon: Users,
    title: "Benchmarking",
    body: "See where you stand against businesses in your sector — by county, state or nationwide.",
    href: "/dashboard",
  },
  {
    Icon: SlidersHorizontal,
    title: "Scenario Simulator",
    body: "Change pricing, staffing, volume or costs and see the effect side by side against your current position.",
    href: "/business/scenarios",
  },
  {
    Icon: Truck,
    title: "Sourcing & Supply Chain",
    body: "Where supplier industries cluster, how far away they are, and estimated delivered cost.",
    phase: "Phase 9",
  },
  {
    Icon: Landmark,
    title: "Financing Finder",
    body: "Match your profile against federal, state and local funding programs.",
    phase: "Phase 9",
  },
  {
    Icon: Lightbulb,
    title: "Opportunity Finder",
    body: "Know your budget and location but not the business? Rank opportunities by fit.",
    phase: "Phase 9",
  },
];

export default function BusinessPage() {
  return (
    <WorkspaceIndex
      eyebrow="Business"
      title="Your business workspace"
      lede="Assessment, benchmarking, location intelligence and forecasting — built on live public data about every market in the country."
      modules={MODULES}
    />
  );
}
