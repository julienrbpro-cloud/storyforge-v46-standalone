import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/views/library-view";

export const Route = createFileRoute("/bibliotheque")({ component: LibraryView });