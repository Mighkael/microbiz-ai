import { FileSearch, GitCompare, FlaskConical, FileText } from "lucide-react";
import WorkspaceIndex, { type Module } from "@/components/WorkspaceIndex";

const MODULES: Module[] = [
  {
    Icon: FileSearch,
    title: "Feasibility & Viability Study",
    body: "Thinking of starting a business? Market size, competition, startup costs and a viability outlook for your chosen location.",
    phase: "Phase 5",
  },
  {
    Icon: GitCompare,
    title: "Market Comparison",
    body: "Put two or three markets side by side — trade activity, demographics, competition and cost — and see which is stronger for your plan.",
    phase: "Phase 5",
  },
  {
    Icon: FlaskConical,
    title: "Data Lab",
    body: "For researchers, consultants and institutions: indicator-level exploration across geography, sector and time.",
    phase: "Phase 8",
  },
  {
    Icon: FileText,
    title: "Report Builder",
    body: "Turn selected data and charts into a structured report with sources, methodology and limitations, exportable to PDF and Word.",
    phase: "Phase 8",
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
