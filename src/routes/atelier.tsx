import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/atelier")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
