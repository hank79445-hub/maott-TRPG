/** Two non-modal tools share a bounded stacking level below global notifications. */
export function focusDock(element: HTMLElement | null | undefined) {
  for (const dock of document.querySelectorAll<HTMLElement>('[data-trpg-dock]'))
    dock.style.zIndex = dock === element ? '180' : '170'
}
