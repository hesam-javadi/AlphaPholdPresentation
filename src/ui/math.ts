import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Typeset a formula to HTML (always left-to-right, even inside Persian text). */
export function tex(src: string, display = false) {
  const html = katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', trust: true, strict: false });
  return `<span class="tex ltr">${html}</span>`;
}

/** Persian copy with inline $…$ math. */
export const rich = (s: string) => s.replace(/\$([^$]+)\$/g, (_, m: string) => tex(m));
