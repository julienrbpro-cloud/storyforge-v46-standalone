import { createFileRoute } from "@tanstack/react-router";
import { HomeView } from "@/components/views/home-view";

export const Route = createFileRoute("/")({ component: HomeView });
