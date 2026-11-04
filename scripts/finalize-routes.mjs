import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const distDirectory = resolve(root, 'dist');
const homePath = resolve(distDirectory, 'index.html');
const extractionPath = resolve(distDirectory, 'extract-audio-from-video', 'index.html');
const subtitlesPath = resolve(distDirectory, 'generate-subtitles', 'index.html');
const homeHtml = await readFile(homePath, 'utf8');
const extractionMarkup = await readFile(resolve(root, '.seo-generated/extract.html'), 'utf8');
const extractionTitle = 'Extract Audio from Video Online | Roomtone';
const extractionDescription = 'Extract audio from MP4, MOV, or WebM videos up to 200 MB in your browser. Reduce background noise and download WAV or MP3; files stay on your device.';
const extractionUrl = 'https://roomtone-flax.vercel.app/extract-audio-from-video/';

function replaceRootMarkup(html, markup) {
  const rootStart = html.indexOf('<div id="root" data-ssr="true">');
  if (rootStart < 0) throw new Error('The prerendered root element was not found in dist/index.html.');

  const markupStart = html.indexOf('>', rootStart) + 1;
  const bodyEnd = html.indexOf('</body>', markupStart);
  const rootEnd = html.lastIndexOf('</div>', bodyEnd);
  if (bodyEnd < 0 || rootEnd < markupStart) throw new Error('Could not locate the prerendered root boundary.');

  return `${html.slice(0, markupStart)}${markup}${html.slice(rootEnd)}`;
}

function setMetaContent(html, attribute, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(<meta\\s+${attribute}="${escapedName}"\\s+content=")[^"]*("\\s*\\/?>)`, 'i');
  if (!pattern.test(html)) throw new Error(`Could not find ${attribute}=${name} metadata in the built HTML.`);
  return html.replace(pattern, `$1${value}$2`);
}

function setCanonical(html, url) {
  const pattern = /(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i;
  if (!pattern.test(html)) throw new Error('Could not find the canonical link in the built HTML.');
  return html.replace(pattern, `$1${url}$2`);
}

let extractionHtml = replaceRootMarkup(homeHtml, extractionMarkup);
extractionHtml = extractionHtml.replace(/<title>[^<]*<\/title>/i, `<title>${extractionTitle}</title>`);
extractionHtml = setMetaContent(extractionHtml, 'name', 'description', extractionDescription);
extractionHtml = setCanonical(extractionHtml, extractionUrl);
extractionHtml = setMetaContent(extractionHtml, 'property', 'og:title', extractionTitle);
extractionHtml = setMetaContent(extractionHtml, 'property', 'og:description', extractionDescription);
extractionHtml = setMetaContent(extractionHtml, 'property', 'og:url', extractionUrl);
extractionHtml = setMetaContent(extractionHtml, 'name', 'twitter:title', extractionTitle);
extractionHtml = setMetaContent(extractionHtml, 'name', 'twitter:description', extractionDescription);

const schemaPattern = /(<script id="roomtone-webapp-schema" type="application\/ld\+json">)([\s\S]*?)(<\/script>)/i;
const schemaMatch = extractionHtml.match(schemaPattern);
if (!schemaMatch) throw new Error('Could not find the WebApplication JSON-LD script in the built HTML.');
const schema = JSON.parse(schemaMatch[2]);
schema.url = extractionUrl;
schema.description = extractionDescription;
extractionHtml = extractionHtml.replace(schemaPattern, `$1${JSON.stringify(schema)}$3`);

await mkdir(resolve(distDirectory, 'extract-audio-from-video'), { recursive: true });
await writeFile(extractionPath, extractionHtml, 'utf8');
console.log('Wrote prerendered route: /extract-audio-from-video/');

const subtitlesMarkup = await readFile(resolve(root, '.seo-generated/subtitles.html'), 'utf8');
const subtitlesTitle = 'Generate SRT Subtitles from Audio or Video | Roomtone';
const subtitlesDescription = 'Create timed SRT or VTT subtitles from audio and video in your browser. Edit the transcript and keep your media on your device.';
const subtitlesUrl = 'https://roomtone-flax.vercel.app/generate-subtitles/';
let subtitlesHtml = replaceRootMarkup(homeHtml, subtitlesMarkup);
subtitlesHtml = subtitlesHtml.replace(/<title>[^<]*<\/title>/i, `<title>${subtitlesTitle}</title>`);
subtitlesHtml = setMetaContent(subtitlesHtml, 'name', 'description', subtitlesDescription);
subtitlesHtml = setCanonical(subtitlesHtml, subtitlesUrl);
subtitlesHtml = setMetaContent(subtitlesHtml, 'property', 'og:title', subtitlesTitle);
subtitlesHtml = setMetaContent(subtitlesHtml, 'property', 'og:description', subtitlesDescription);
subtitlesHtml = setMetaContent(subtitlesHtml, 'property', 'og:url', subtitlesUrl);
subtitlesHtml = setMetaContent(subtitlesHtml, 'name', 'twitter:title', subtitlesTitle);
subtitlesHtml = setMetaContent(subtitlesHtml, 'name', 'twitter:description', subtitlesDescription);

const subtitlesSchemaMatch = subtitlesHtml.match(schemaPattern);
if (!subtitlesSchemaMatch) throw new Error('Could not find the WebApplication JSON-LD script in the built subtitles HTML.');
const subtitlesSchema = JSON.parse(subtitlesSchemaMatch[2]);
subtitlesSchema.url = subtitlesUrl;
subtitlesSchema.description = subtitlesDescription;
subtitlesHtml = subtitlesHtml.replace(schemaPattern, `$1${JSON.stringify(subtitlesSchema)}$3`);

await mkdir(resolve(distDirectory, 'generate-subtitles'), { recursive: true });
await writeFile(subtitlesPath, subtitlesHtml, 'utf8');
console.log('Wrote prerendered route: /generate-subtitles/');
