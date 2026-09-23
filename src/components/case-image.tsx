import { useEffect, useState } from "react";
import { resolveImageRef } from "@/lib/media";

export function CaseImage({
  src,
  alt,
  className,
  onClick,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (!src) return;
    void resolveImageRef(src).then((u) => {
      if (live) setUrl(u);
    }).catch(() => { if (live) setUrl(null); });
    return () => {
      live = false;
    };
  }, [src]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}
