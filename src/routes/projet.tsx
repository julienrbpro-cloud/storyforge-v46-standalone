import { createFileRoute } from "@tanstack/react-router";
import { ProjectView } from "@/components/views/project-view";
import { z } from "zod";

const searchSchema = z.object({
  tab: z.enum(["planches", "fichiers"]).catch("planches").optional(),
  chapitre: z.string().optional(),
});

export const Route = createFileRoute("/projet")({
  validateSearch: searchSchema,
  component: ProjetPage,
});

function ProjetPage() {
  const { tab, chapitre } = Route.useSearch();
  return <ProjectView tab={tab || "planches"} chapitre={chapitre} />;
}
