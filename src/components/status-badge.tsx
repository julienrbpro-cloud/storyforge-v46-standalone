import { Badge } from "@/components/ui/badge";
import { CASE_STATUSES, PAGE_STATUSES } from "@/lib/constants";
import { pageStatusOf, useStudio } from "@/lib/store";

export function PageStatusBadge({ id, stop = true }: { id: string; stop?: boolean }) {
  const meta = useStudio((s) => s.meta);
  const cycle = useStudio((s) => s.cyclePageStatus);
  const revision = useStudio((s) => s.revision);
  void revision;
  const status = pageStatusOf(meta, id);
  const info = PAGE_STATUSES.find((x) => x[0] === status) || PAGE_STATUSES[0];
  return (
    <Badge
      className={info[2]}
      onClick={(e) => {
        if (stop) e.stopPropagation();
        cycle(id);
      }}
    >
      {info[1]}
    </Badge>
  );
}

export function CaseStatusBadge({ pid, cid, statut }: { pid: string; cid: string; statut: string }) {
  const cycle = useStudio((s) => s.cycleCaseStatus);
  const info = CASE_STATUSES.find((x) => x[0] === statut) || CASE_STATUSES[0];
  return (
    <Badge
      className={info[2]}
      onClick={(e) => {
        e.stopPropagation();
        cycle(pid, cid);
      }}
    >
      {info[1]}
    </Badge>
  );
}