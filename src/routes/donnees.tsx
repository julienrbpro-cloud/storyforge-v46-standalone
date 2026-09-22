import { createFileRoute } from "@tanstack/react-router";
import { DataView } from "@/components/views/data-view";

export const Route = createFileRoute("/donnees")({ component: DataView });