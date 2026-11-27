import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface PhotoViewerPhoto {
  src: string;
  name?: string;
}

interface PhotoViewerContextValue {
  open: (photo: PhotoViewerPhoto) => void;
}

const PhotoViewerContext = createContext<PhotoViewerContextValue | null>(null);

/**
 * Global lightbox: any component can enlarge a photo by calling
 * `usePhotoViewer().open({ src, name })`. Renders a single full-screen overlay.
 */
export function PhotoViewerProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<PhotoViewerPhoto | null>(null);

  const open = useCallback((p: PhotoViewerPhoto) => {
    setPhoto(p);
  }, []);

  const close = useCallback(() => setPhoto(null), []);

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, close]);

  return (
    <PhotoViewerContext.Provider value={{ open }}>
      {children}
      {photo ? (
        <div
          className="photo-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={photo.name ? `${photo.name}'s photo` : "Photo preview"}
          onClick={close}
        >
          <div className="photo-viewer__backdrop" aria-hidden="true" />
          <img
            className="photo-viewer__img"
            src={photo.src}
            alt={photo.name ?? "Photo preview"}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="photo-viewer__close"
            aria-label="Close"
            onClick={close}
          >
            ✕
          </button>
        </div>
      ) : null}
    </PhotoViewerContext.Provider>
  );
}

export function usePhotoViewer(): PhotoViewerContextValue {
  const ctx = useContext(PhotoViewerContext);
  if (!ctx) {
    throw new Error("usePhotoViewer must be used within a PhotoViewerProvider");
  }
  return ctx;
}
