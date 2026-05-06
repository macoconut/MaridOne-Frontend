import type { WheelEvent as ReactWheelEvent } from 'react';

export function routeWheelToScrollableChild(
  event: ReactWheelEvent<HTMLElement>,
  selector: string
) {
  const scrollContainer = event.currentTarget.querySelector<HTMLElement>(selector);
  if (!scrollContainer) return;

  if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
    event.preventDefault();
    return;
  }

  scrollContainer.scrollTop += event.deltaY;
  event.preventDefault();
}
