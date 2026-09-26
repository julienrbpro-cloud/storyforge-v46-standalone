import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { storyCases } from "@/lib/sequence";
import { useStudio } from "@/lib/store";
import { visualPageIndexOf } from "@/lib/visual-layout";

export const Route = createFileRoute("/planche/$plancheId")({
  component: PlanchePage,
});

function PlanchePage() {
  const { plancheId } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    const seed = useStudio.getState().seed;
    const first = storyCases(seed).find((panel) => panel.planche_id === plancheId);
    if (first) useStudio.getState().setVisualPageIndex(visualPageIndexOf(storyCases(seed), first.id));
    void navigate({ to: "/projet", replace: true });
  }, [navigate, plancheId]);
  return null;
}