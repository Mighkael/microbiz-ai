import {
  ClipboardList, LayoutDashboard, MapPin, SlidersHorizontal,
  Users, Truck, Landmark, Lightbulb, Bot, Activity,
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
    body: "Where supplier industries cluster, how far away they are, and what freight would add.",
    href: "/business/sourcing",
  },
  {
    Icon: Landmark,
    title: "Financing Finder",
    body: "Live federal funding opportunities open to small businesses, from Grants.gov.",
    href: "/business/financing",
  },
  {
    Icon: Lightbulb,
    title: "Opportunity Finder",
    body: "Know your budget and location but not the business? Rank sectors by how they perform in your county.",
    href: "/business/opportunities",
  },
  {
    Icon: Bot,
    title: "AI Readiness & Roadmap",
    body: "Find out where AI can genuinely help your kind of business, how to learn it, and a 90-day plan to start — from the tools and budget you have today.",
    href: "/business/ai-roadmap",
  },
  {
    Icon: Activity,
    title: "MicroBiz Agent",
    body: "Give it your plan and monthly results: it tracks plan against actual, forecasts the year, warns you about deadlines, and builds lender and investor reports.",
    href: "/ask?tab=monitor",
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
