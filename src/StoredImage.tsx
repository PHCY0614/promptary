import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import type { ImageRef } from "./types";
import { getCanonicalBlob, getThumbnailBlob } from "./archiveStorage";
import { isStarterImageRef, starterImageUrl } from "./starterData";
import { THUMBNAIL_MAX_EDGE } from "./imageProcessing";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  image: ImageRef;
  variant: "canonical" | "thumbnail";
  adaptiveThumbnail?: boolean;
};

export default function StoredImage({ image, variant, adaptiveThumbnail = false, onError, ...props }: Props) {
  const element = useRef<HTMLImageElement>(null);
  const [useCanonical, setUseCanonical] = useState(variant === "canonical");
  const [src, setSrc] = useState("");

  useEffect(() => setUseCanonical(variant === "canonical"), [variant, image.id]);
  useEffect(() => {
    if (!adaptiveThumbnail || variant === "canonical" || !element.current) return;
    const target = element.current;
    const observer = new ResizeObserver(([entry]) => {
      const required = Math.max(entry.contentRect.width, entry.contentRect.height) * Math.max(1, window.devicePixelRatio || 1);
      const intrinsicLongEdge = Math.min(THUMBNAIL_MAX_EDGE, Math.max(image.width, image.height));
      setUseCanonical(required > intrinsicLongEdge * 1.05);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [adaptiveThumbnail, image.height, image.id, image.width, variant]);

  useEffect(() => {
    let active = true;
    let url = "";
    const loader = useCanonical ? getCanonicalBlob : () => getThumbnailBlob(image);
    void loader(image.id).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
    }).catch(() => {
      if (!active) return;
      if (isStarterImageRef(image)) setSrc(starterImageUrl(image, import.meta.env.BASE_URL));
      else setSrc("");
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [image, useCanonical]);

  return <img ref={element} src={src || undefined} {...props} onError={onError} />;
}
