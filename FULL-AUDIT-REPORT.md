# SEO audit: Roomtone

**Target:** <https://roomtone-flax.vercel.app/>  
**Audit date:** 31 October 2026 (Africa/Lagos)  
**Scope:** Live homepage plus the supplied local source tree. This is a read-only audit; no production or source code changes were made.

## Audit summary

The live homepage returns HTTP 200 over HTTPS and has no observed `noindex` directive. A headless Chrome render successfully produced the app UI and one H1, so this audit did **not** find a confirmed indexing block. The main SEO weakness is that the HTML sent to a crawler contains only an empty React mount and relies on JavaScript for all page copy. That raises rendering and discoverability risk, especially for non-Google crawlers and for search engines before their render pass.

The local checkout is **React + Vite, not Next.js** (`package.json`, `vite.config.js`, and `src/main.jsx`). The source tree already had uncommitted edits when the audit began. I left those files untouched. In particular, the local mobile CSS hides a status pill at small widths, but the live CSS still displays it; the deployed page clips that text at the right edge on a 390 px viewport.

**Overall status:** Needs improvement. No numeric score is assigned because PageSpeed/CrUX and Search Console data were unavailable; an HTML-only score would overstate certainty.

| Area | Status | Evidence summary |
|---|---|---|
| Crawlability and indexing | Warning | `/robots.txt` and `/sitemap.xml` return 404. No `noindex` was observed. |
| Rendering | Warning | Initial response has an empty `#root`; Chrome later renders the app and its H1. |
| Metadata | Warning | Title is 26 characters; description is 56 characters. No canonical, Open Graph, or Twitter tags. |
| Structured data | Warning | No JSON-LD detected. |
| Internal links | Warning | App navigation changes React state with buttons; tool/support views have no independent crawlable URLs. |
| Content quality | Warning | The homepage is a concise app interface, with little explanatory landing-page content or visible trust information. |
| Mobile | Warning | Responsive layout and viewport are present. Live status text is clipped at 390 px. |
| Performance | Unknown / risk | PSI returned HTTP 429 due to the audit API quota. The main JS response is about 451 KB raw and CSS about 44.5 KB raw; CWV are unmeasured. |
| Images | Pass / limited scope | The homepage has no substantive content images; the loader logo is decorative. |

## Findings

### 1. The public page depends entirely on client-side rendering

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** The live HTML response contains `<div id="root"></div>` and no H1 or body copy. The page's title and description are present in the head, but app copy comes from the JavaScript bundle. A headless Chrome render did execute the app and found one H1, “Make room for the voice.” (`src/main.jsx`, around line 864). The app mounts through `createRoot` (`src/main.jsx`, line 997).

**Impact:** This is not proof that Google cannot index the page; Google rendered it in this check. It does make indexing depend on successful JavaScript rendering and leaves the initial HTML with little topical content. Google documents a separate render phase and notes that other crawlers may ignore JavaScript; it recommends server-side or static rendering as a useful option ([Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)).

**Fix:** Pre-render or statically generate the public landing page so its main heading, explanatory copy, links, and metadata are in the HTML response. Keep audio editing and device-specific projects client-side. The local app is Vite, so implement prerendering for that stack or migrate to Next.js only if Next.js is a deliberate requirement.

### 2. No robots file or XML sitemap is deployed

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** Direct requests to `https://roomtone-flax.vercel.app/robots.txt` and `/sitemap.xml` returned 404. The checked-in `public/` file list contains neither file.

**Impact:** A missing `robots.txt` does not block crawling by itself; crawlers generally use the default allow behavior. The missing sitemap removes a clear discovery and canonical URL list. Google describes sitemap submission as a discovery hint, not a guarantee that URLs will be crawled or indexed ([sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)). This matters more if public landing pages are added.

**Fix:** Add a root `robots.txt` that permits public crawling and points to the sitemap. Add an XML sitemap listing only canonical, indexable public pages on the final preferred domain. Do not include app-only state or user project URLs.

### 3. Metadata is short and incomplete

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** The live title is `Roomtone — Voice workspace` (26 characters). The description is `Clean up voice recordings in your browser with Roomtone.` (56 characters). No canonical link, Open Graph tags, or Twitter card tags are present in the live head or local `index.html` (`index.html`, lines 7 and 12).

**Impact:** The title does not clearly state the core search intent, and the short description gives search engines little context for the result snippet. Without a canonical hint, Google selects the representative URL from its signals; a canonical tag is not mandatory, but it can state your preference when URL variants exist ([canonicalization guidance](https://developers.google.com/search/docs/crawling-indexing/canonicalization)). Missing social tags can produce weak link previews; these are mainly presentation and sharing concerns rather than direct ranking factors.

**Fix:** Add a descriptive title and a useful, accurate description; set a self-referencing canonical to the preferred public URL; add `og:title`, `og:description`, `og:url`, `og:image`, and matching Twitter card fields. Example copy:

```text
Title: Roomtone: Browser Audio Cleaner & Voice Noise Removal
Description: Clean up voice recordings in your browser with Roomtone. Reduce background noise, shape the sound, and export WAV or MP3. Your files stay on your device.
```

Use the final branded domain in the canonical and social URLs if one is configured.

### 4. No structured data is present

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** No `application/ld+json` block appears in either the live HTML or the rendered DOM.

**Impact:** Search engines receive less explicit information that the page is a web application. Missing schema is not itself a penalty, and valid structured data does not guarantee a rich result ([structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)).

**Fix:** Add truthful JSON-LD for the web application after the public page has stable canonical metadata. A minimal starting point is:

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Roomtone",
  "url": "https://roomtone-flax.vercel.app/",
  "description": "Clean up voice recordings in your browser with Roomtone.",
  "applicationCategory": "MultimediaApplication"
}
```

Update the URL and description to match the final public page. Do not add pricing, ratings, or organization details unless they are accurate and visible to visitors.

### 5. Search navigation is not represented by crawlable links or separate URLs

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** The app's `view` state is local React state (`src/main.jsx`, line 334). The Enhance, Extract, Projects, and Support navigation controls are `<button>` elements that call `setView` (`src/main.jsx`, lines 810–830); they do not change the URL. The only normal links in the main UI are the home hash and license files.

**Impact:** Crawlers see only the homepage URL. The extraction and support content cannot earn separate search visibility or be independently shared/indexed. This is appropriate for private workspace screens, but limits public acquisition pages.

**Fix:** Keep Projects and Editor private/app-only. If the extraction feature or other use cases should attract search traffic, give each a stable URL, a unique server-rendered/static page, a unique title/canonical, and ordinary `<a href>` links from the homepage. Avoid creating near-duplicate pages without distinct value.

### 6. The landing page has little explanatory content for search intent

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** The rendered homepage is primarily a slogan, upload control, three-step workflow, empty recent-project state, and short footer (`src/main.jsx`, around lines 864–896). More detailed support and extraction copy is in other app states, not in the public homepage HTML response.

**Impact:** Visitors and crawlers get limited detail about what the tool does, which formats it supports, the local processing model, output options, and limitations. The UI is useful for returning users but does not fully answer a new searcher's evaluation questions.

**Fix:** Add concise, visible sections explaining supported audio/video formats, outputs, how browser-local processing works, what noise reduction can and cannot do, and privacy/data handling. Add clear About, Support, and Privacy links in the public footer. Keep factual claims aligned with the code and product behavior.

### 7. Mobile status text is clipped in the deployed build

**Severity:** Warning  
**Confidence:** Confirmed  
**Evidence:** A Chrome screenshot at 390 × 844 showed the responsive app layout, but the “Runs in your browser” status pill runs into the right viewport edge. The live minified CSS keeps the pill visible at the 560 px breakpoint. The local working tree already has `.local-pill { display: none; }` at `src/style.css`, line 362, so the current live asset and local CSS differ.

**Impact:** This is mainly a mobile usability issue, with indirect SEO impact through page experience. The core upload and workflow sections fit the narrow layout, and the viewport meta tag and breakpoints are present.

**Fix:** Reconcile the deployed build with the intended local breakpoint rule, then verify the header at 320, 360, 390, and 560 px. Ensure the mobile navigation remains understandable to assistive technology; its buttons currently retain accessible labels while visible text is hidden.

### 8. Core Web Vitals are unmeasured; asset size deserves follow-up

**Severity:** Info / likely opportunity  
**Confidence:** Hypothesis for user impact  
**Evidence:** The PageSpeed Insights mobile endpoint returned HTTP 429 with the response stating the API project quota is zero. Direct retrieval showed a 451,042-character JavaScript response and a 44,490-character CSS response before transfer compression. The code dynamically imports Three.js and media export code, which is useful code splitting, but the initial bundle remains substantial.

**Impact:** No LCP, INP, CLS, or field-data status can be claimed from this run. The raw asset body size alone does not establish a slow page; compression, network, and device behavior matter.

**Fix:** Measure PSI/Lighthouse mobile and CrUX when available, including the deployed page after JavaScript settles. Review the network waterfall and consider splitting editor-only UI and nonessential dependencies if the measured LCP or INP warrants it. Preserve current lazy imports for Three.js and media export where practical.

### Other checks

- **Indexing directives:** No meta robots tag or `X-Robots-Tag` header was observed. No explicit noindex block was found.
- **Heading structure:** The rendered homepage has exactly one H1. Product intent would be clearer if supporting copy included plain-language terms such as browser audio cleanup and voice noise reduction.
- **Mobile baseline:** `index.html` has a viewport tag; the source has responsive breakpoints at 1050, 800, and 560 px. The live screenshot showed a narrow sidebar and a stacked workflow.
- **Images:** No substantive homepage images were found. The loader logo is decorative (`alt=""`), so there is no confirmed missing-alt issue.
- **HTTPS/security:** HTTPS responds successfully and the response includes HSTS (`max-age=63072000; includeSubDomains; preload`). This is a positive security signal, not an SEO score substitute.
- **Cache headers:** Vercel serves the HTML and static assets with `Cache-Control: public, must-revalidate, max-age=0`; this is a deployment/performance configuration to review only if repeat-visit or field measurements show a problem.

## Unknowns and follow-ups

- Search Console and Bing Webmaster Tools were not connected, so indexed URL counts, selected canonical, crawl errors, impressions, clicks, and query positions are unknown.
- PSI/CrUX metrics could not be retrieved because the API returned a quota error. This is an audit environment limitation, not a confirmed site error.
- The bundled SEO Python scripts were not available because the workspace has no usable Python interpreter (`python` resolves to the Microsoft Store alias). Direct HTTP checks and a headless Chrome render were used instead.
- Only the supplied homepage was audited. Other deployed paths, custom domain behavior, robots policy at a final domain, and content outside the app were not in scope.
- The app was checked in headless Chrome at a 390 px viewport; no physical-device or browser accessibility session was available.
- The repository already had modified files before the audit (`README.md`, `index.html`, `src/main.jsx`, `src/style.css`, `vite.config.js`, and several untracked PWA assets). They were not changed during this audit.
