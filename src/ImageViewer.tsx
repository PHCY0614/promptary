import { useEffect } from "react";
import StoredImage from "./StoredImage";
import type { ImageRef } from "./types";

interface Props {
  images: ImageRef[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
}

export default function ImageViewer({ images, index, onClose, onChange }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onChange(Math.min(images.length - 1, index + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onChange]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-lg transition-colors"
        onClick={onClose}
      >
        ×
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, index - 1)); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors disabled:opacity-20"
            disabled={index === 0}
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onChange(Math.min(images.length - 1, index + 1)); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors disabled:opacity-20"
            disabled={index === images.length - 1}
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); onChange(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </>
      )}

      <StoredImage
        image={images[index]}
        variant="canonical"
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
