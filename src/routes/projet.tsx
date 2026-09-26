import { createFileRoute } from "@tanstack/react-router";
import { ProjectView } from "@/components/views/project-view";

export const Route = createFileRoute("/projet")({
  component: ProjectView,
});
