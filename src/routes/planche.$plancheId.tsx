import { createFileRoute } from "@tanstack/react-router";
import { PlancheView } from "@/components/views/planche-view";

export const Route = createFileRoute("/planche/$plancheId")({
  component: PlanchePage,
});

function PlanchePage() {
  const { plancheId } = Route.useParams();
  return <PlancheView plancheId={plancheId} />;
}