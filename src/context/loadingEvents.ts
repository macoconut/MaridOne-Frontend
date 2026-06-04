export const GLOBAL_LOADING_EVENT = 'maridone:global-loading';

export function setGlobalLoadingActive(active: boolean) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(GLOBAL_LOADING_EVENT, {
      detail: { active },
    })
  );
}
