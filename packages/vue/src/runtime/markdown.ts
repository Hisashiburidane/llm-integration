import { Marked, Renderer } from 'marked';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeLink(href: string) {
  return /^(https?:|mailto:)/i.test(href)
    || href.startsWith('#')
    || /^(\/(?!\/)|\.{1,2}\/)/.test(href);
}

const renderer = new Renderer();

renderer.html = ({ text }) => escapeHtml(text);
renderer.image = ({ text }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const label = this.parser.parseInline(tokens);
  if (!isSafeLink(href)) return label;
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${label}</a>`;
};

const markdown = new Marked({
  async: false,
  breaks: true,
  gfm: true,
  renderer
});

export function renderAuraMarkdown(content: string) {
  return markdown.parse(content) as string;
}
