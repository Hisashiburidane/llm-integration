export const examplesUrl = import.meta.env.VITE_EXAMPLES_URL
  ?? (import.meta.env.DEV ? 'http://127.0.0.1:5174/examples/' : '/examples/');

const portalPath = globalThis.location?.pathname ?? '/';

export const portalHomeUrl = portalPath;
export const apiDocsUrl = `${portalPath}?view=api`;
