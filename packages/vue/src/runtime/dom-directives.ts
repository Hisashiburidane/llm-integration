import type { ObjectDirective } from 'vue';

const markedElements = new WeakMap<HTMLElement, Set<HTMLElement>>();
const markerOwners = new WeakMap<HTMLElement, HTMLElement>();

function setMarker(element: HTMLElement, attribute: string, enabled: boolean) {
  if (enabled) element.setAttribute(attribute, '');
  else element.removeAttribute(attribute);
}

function unregisterMarker(element: HTMLElement) {
  const owner = markerOwners.get(element);
  if (!owner) return;
  markedElements.get(owner)?.delete(element);
  markerOwners.delete(element);
}

function registerMarker(element: HTMLElement) {
  unregisterMarker(element);
  const owner = element.closest<HTMLElement>('[data-enchant]');
  if (!owner) return;
  const elements = markedElements.get(owner) ?? new Set<HTMLElement>();
  elements.add(element);
  markedElements.set(owner, elements);
  markerOwners.set(element, owner);
}

export function getEnchantMarkedElements(owner: HTMLElement) {
  const elements = markedElements.get(owner);
  if (!elements) return [];
  return Array.from(elements).filter((element) => {
    const current = element.closest<HTMLElement>('[data-enchant]');
    if (current === owner) return true;
    unregisterMarker(element);
    return false;
  });
}

export const vEnchant: ObjectDirective<HTMLElement, boolean | undefined> = {
  mounted(element, binding) {
    const enabled = binding.value !== false;
    setMarker(element, 'data-enchant-node', enabled);
    if (enabled) registerMarker(element);
  },
  updated(element, binding) {
    const enabled = binding.value !== false;
    setMarker(element, 'data-enchant-node', enabled);
    if (enabled) registerMarker(element);
    else unregisterMarker(element);
  },
  unmounted(element) {
    unregisterMarker(element);
    element.removeAttribute('data-enchant-node');
  }
};

export const vEnchantIgnore: ObjectDirective<HTMLElement, boolean | undefined> = {
  mounted(element, binding) {
    setMarker(element, 'data-enchant-ignore', binding.value !== false);
  },
  updated(element, binding) {
    setMarker(element, 'data-enchant-ignore', binding.value !== false);
  },
  unmounted(element) {
    element.removeAttribute('data-enchant-ignore');
  }
};
