import { createFileRoute } from "@tanstack/react-router";
import { ProjectsView } from "@/components/views/home-view";

export const Route = createFileRoute("/")({ component: ProjectsView });
