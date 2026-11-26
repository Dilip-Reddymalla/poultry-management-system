import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChevronDownIcon } from "./icons.js";
import { Button } from "./ui.js";

export interface TourStep {
  /** CSS selector of the element to spotlight. Omit for an intro card. */
  target?: string;
  titleKey: string;
  bodyKey: string;
  /** Show an animated "scroll down" cue for this step. */
  scrollHint?: boolean;
  /**
   * For form controls (selects): wait until the user actually changes the value
   * before advancing, instead of completing on a click.
   */
  waitForChange?: boolean;
}

interface TourOverlayProps {
  steps: TourStep[];
  /** Called when the user reaches the end or skips. Persist "seen" here. */
  onComplete: () => void;
}

const CARD_GAP = 14;
const CARD_WIDTH = 300;

/**
 * A lightweight spotlight tour overlay. It dims everything except the current
 * target, draws a box around it, and shows a short "do this" card over it.
 * The highlighted element stays clickable (the hole does not capture clicks),
 * so the user can literally press the button the tour is describing.
 */
export function TourOverlay({ steps, onComplete }: TourOverlayProps): React.ReactElement {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[idx]!;

  // Keep the latest onComplete in a ref so the effect below can depend only on
  // the step index (and not re-run / re-scroll on every parent re-render).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Scroll-prompt step: as soon as the user scrolls down a little, advance to
    // the next step automatically (no Next click needed).
    if (step.scrollHint && !step.target) {
      const startY = window.scrollY;
      const onScroll = () => {
        if (window.scrollY > startY + 100) {
          console.log("[tour] scrolled — auto advancing");
          setIdx((i) => Math.min(i + 1, steps.length - 1));
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      setRect(null);
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (!step.target) {
      setRect(null);
      return;
    }
    let el = document.querySelector(step.target) as HTMLElement | null;
    console.log("[tour] step", idx, "selector", step.target, "found", Boolean(el));
    if (!el) {
      setRect(null);
      return;
    }

    const update = () => setRect((el?.getBoundingClientRect() ?? null) as DOMRect | null);

    // Make the highlighted element visible so the user sees what to click.
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    update();
    // The smooth scroll animates over a few hundred ms; re-measure after it
    // settles so the spotlight (and hit detection) matches the final position.
    const settleTimer = window.setTimeout(update, 450);

    const detach: Array<() => void> = [];

    if (step.waitForChange) {
      // A form control (e.g. a <select>): wait until the user actually changes
      // its value, then advance automatically.
      const onChange = () => {
        console.log("[tour] control change detected — advancing");
        setIdx((i) => Math.min(i + 1, steps.length - 1));
      };
      el.addEventListener("change", onChange);
      detach.push(() => el.removeEventListener("change", onChange));
    } else {
      // Clicking the highlighted element completes the tour. We test the click
      // POSITION against the element's rectangle (the overlay may intercept the
      // event, so event.target isn't reliable).
      const handleClick = (event: MouseEvent) => {
        const r = el.getBoundingClientRect();
        const inside =
          event.clientX >= r.left &&
          event.clientX <= r.right &&
          event.clientY >= r.top &&
          event.clientY <= r.bottom;
        console.log("[tour] click", {
          inside,
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
          rect: {
            left: Math.round(r.left),
            right: Math.round(r.right),
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
          },
        });
        if (inside) {
          if (idx >= steps.length - 1) {
            console.log("[tour] last step completed — finishing");
            onCompleteRef.current();
          } else {
            console.log("[tour] step completed — advancing");
            setIdx((i) => i + 1);
          }
        }
      };
      document.addEventListener("click", handleClick, true);
      detach.push(() => document.removeEventListener("click", handleClick, true));
    }

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      window.clearTimeout(settleTimer);
      for (const off of detach) off();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [idx, step.target, step.scrollHint, step.waitForChange]);

  function finish(): void {
    console.log("[tour] finish called (Done/Skip)");
    onComplete();
  }

  function cardStyle(): React.CSSProperties {
    if (!rect) {
      return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
    }
    const below = rect.bottom + CARD_GAP + 180 <= window.innerHeight;
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - CARD_WIDTH - 12);
    if (below) {
      return { top: rect.bottom + CARD_GAP, left };
    }
    return { bottom: window.innerHeight - rect.top + CARD_GAP, left };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t("tour.ariaLabel")}>
      {rect ? (
        <>
          <div className="tour__dim tour__dim--top" style={{ height: rect.top }} />
          <div className="tour__dim tour__dim--bottom" style={{ top: rect.bottom, height: window.innerHeight - rect.bottom }} />
          <div className="tour__dim tour__dim--left" style={{ top: rect.top, height: rect.height, width: rect.left }} />
          <div className="tour__dim tour__dim--right" style={{ top: rect.top, height: rect.height, left: rect.right, width: window.innerWidth - rect.right }} />
          <div className="tour__hole" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
        </>
      ) : null}

      <div className="tour__card" style={cardStyle()}>
        <p className="tour__eyebrow">
          {idx + 1} / {steps.length}
        </p>
        <h3 className="tour__title">{t(step.titleKey)}</h3>
        <p className="tour__body">{t(step.bodyKey)}</p>
        <div className="tour__actions">
          {idx > 0 ? (
            <Button variant="ghost" onClick={() => setIdx((i) => i - 1)}>
              {t("tour.back")}
            </Button>
          ) : null}
          <span style={{ flex: 1 }} />
          {idx < steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => {
                console.log("[tour] next pressed from step", idx);
                setIdx((i) => i + 1);
              }}
            >
              {t("tour.next")}
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              {t("tour.done")}
            </Button>
          )}
        </div>
        <button type="button" className="tour__skip" onClick={finish}>
          {t("tour.skip")}
        </button>
      </div>

      {step.scrollHint ? (
        <div className="tour__scrollcue" aria-hidden="true">
          <ChevronDownIcon />
        </div>
      ) : null}
    </div>
  );
}
