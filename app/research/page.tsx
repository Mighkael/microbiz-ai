import { FileSearch, GitCompare, FlaskConical, FileText, HeartPulse } from "lucide-react";
import WorkspaceIndex, { type Module } from "@/components/WorkspaceIndex";

const MODULES: Module[] = [
  {
    Icon: FileSearch,
    title: "Feasibility & Viability Study",
    body: "Thinking of starting a business? Test your revenue, staffing and capital assumptions against what the market actually supports.",
    href: "/research/feasibility",
  },
  {
    Icon: GitCompare,
    title: "Market Comparison",
    body: "Put two or three markets side by side and see which is stronger for your plan.",
    href: "/business/locations",
  },
  {
    Icon: FlaskConical,
    title: "Data Lab",
    body: "Year-by-year figures on businesses, employment, payroll, population and income — by sector and geography.",
    href: "/research/data-lab",
  },
  {
    Icon: FileText,
    title: "Report Builder",
    body: "Export any Data Lab extract to Word or CSV with its sources, methodology and limitations attached.",
    href: "/research/data-lab",
  },
  {
    Icon: HeartPulse,
    title: "Community & Conditions",
    body: "Population structure, community health, hazard history and climate for any county — the context a feasibility study sits inside.",
    href: "/data/community",
  },
];

export default function ResearchPage() {
  return (
    <WorkspaceIndex
      eyebrow="Research"
      title="Research & studies"
      lede="Feasibility studies, market comparison and institutional analysis — for people deciding whether a business works before committing money to it."
      modules={MODULES}
    />
  );
}
