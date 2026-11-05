import { useEffect, type ReactNode, type RefObject } from "react";
import { useDeviceChrome } from "../lib/use-device.ts";
import { ResponsiveDrawerShell } from "@/components/ui/responsive-overlay";
import { cn } from "@/lib/utils";

interface ComposerPopupHostProps {
  open: boolean;
  placement: "top" | "bottom";
  label: string;
  interactive: boolean;
  popupKey: string | null;
  popupRef: RefObject<HTMLDivElement | null>;
  composerRef: RefObject<HTMLFormElement | null>;
  onClose(restoreFocus: boolean): void;
  children: ReactNode;
}

// 컴포저 팝업은 실제 phone의 좁은 화면에서만 하단 서랍으로 연다.
export function ComposerPopupHost(props: ComposerPopupHostProps) {
  const { open, label, interactive, popupRef, composerRef, onClose } = props;
  const chrome = useDeviceChrome();
  const drawer = interactive && chrome.device === "phone" && chrome.viewport === "narrow";

  useEffect(() => {
    if (!open || drawer) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (popupRef.current?.contains(event.target)) return;
      if (composerRef.current?.contains(event.target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () =>
      document.removeEventListener("pointerdown", dismissOutside, true);
  }, [composerRef, drawer, onClose, open, popupRef]);

  const content = <ComposerPopupContent {...props} drawer={drawer} />;

  if (drawer) {
    return (
      <ResponsiveDrawerShell
        open={open}
        srLabel={label}
        onOpenChange={(next) => {
          if (!next) onClose(false);
        }}
        onAfterCloseAutoFocus={() => onClose(true)}
        contentClassName="p-0"
      >
        {content}
      </ResponsiveDrawerShell>
    );
  }
  return open ? content : null;
}

function ComposerPopupContent({
  open,
  drawer,
  placement,
  label,
  interactive,
  popupKey,
  popupRef,
  children,
}: ComposerPopupHostProps & { drawer: boolean }) {
  useEffect(() => {
    if (!open || !interactive) return;
    const frame = window.requestAnimationFrame(() => {
      const firstInput = popupRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]',
      );
      firstInput?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [interactive, open, popupKey, popupRef]);
  return (
    <div
      ref={popupRef}
      data-promptbox-typeahead-menu=""
      role={interactive && !drawer ? "dialog" : undefined}
      aria-label={interactive ? label : undefined}
      className={
        drawer
          ? undefined
          : cn(
              "absolute -left-px -right-px z-20",
              placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
            )
      }
    >
      {children}
    </div>
  );
}
