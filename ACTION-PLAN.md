# SEO implementation plan: Roomtone

This plan is based on the live audit and the supplied **Vite + React** checkout. Local implementation has now begun; no production changes have been made. The working tree already contained uncommitted edits when the audit started, and those edits were preserved.

## Priority 1 — Make the public landing page crawlable and indexable

**Impact:** High  
**Effort:** Medium  
**Dependency:** Decide whether Vite remains the production stack or Next.js is the intended target.

1. Render the public homepage's main content into the initial HTML through static generation/prerendering. Include the H1, supporting explanation, feature summary, canonical, and links in the response. Keep the user workspace and audio processing interactive in React.
2. The checked-out project has Vite scripts and `vite.config.js`; it does not contain a Next.js app. For this checkout, add prerendering to the Vite build. If Next.js is required, treat migration as a separate architecture decision rather than following Next-specific file instructions that are not present.
3. Publish only public, stable pages. Do not index per-user Projects or Editor state.
4. After deployment, use Search Console URL Inspection to confirm Google receives the rendered content and selected canonical.

## Priority 2 — Add crawl controls and a sitemap

**Impact:** Medium to high as public URLs grow  
**Effort:** Low  
**Dependency:** Set the preferred public hostname and finish the public URL list.

1. Add `/robots.txt` with an explicit allow policy for public pages and a sitemap reference.
2. Add `/sitemap.xml` with the canonical homepage and each public, indexable landing page. Exclude app-only or user-specific screens.
3. Use the final branded host if one is configured; keep robots, sitemap, canonical tags, and `og:url` consistent.
4. Verify that both files return 200 after deployment and submit the sitemap in Search Console.

## Priority 3 — Improve metadata and social previews

**Impact:** Medium for relevance and snippet quality; low for direct ranking from social tags  
**Effort:** Low  
**Dependency:** Add the metadata to the same static/prerendered head used for the public homepage.

1. Replace the generic title with a clear product and intent title, for example: `Roomtone: Browser Audio Cleaner & Voice Noise Removal`.
2. Replace the short description with a specific summary, for example: `Clean up voice recordings in your browser with Roomtone. Reduce background noise, shape the sound, and export WAV or MP3. Your files stay on your device.`
3. Add a self-referencing canonical and Open Graph/Twitter tags with an accurate 1200 × 630 social preview image.
4. If public routes are added, give each route a unique title, description, canonical, and social URL. Do not reuse one static title for all routes.

## Priority 4 — Add truthful application structured data

**Impact:** Low to medium  
**Effort:** Low  
**Dependency:** Canonical domain and public description must be settled.

1. Add JSON-LD for `WebApplication` with the name, canonical URL, concise description, and application category.
2. Validate the JSON-LD syntax and ensure every claim is visible and accurate. Do not add offers, ratings, or business details that have not been verified.
3. Treat schema as entity clarification; do not promise a rich result from it.

## Priority 5 — Expand landing content and public trust information

**Impact:** High for search intent and visitor confidence  
**Effort:** Medium  
**Dependency:** Confirm the product's supported formats, limits, data handling, and feature claims.

1. Add visible sections describing audio cleanup, supported file types, exports, browser-local processing, and how results are produced.
2. Explain limitations clearly, including that noise reduction does not recreate or restore a voice beyond the documented behavior.
3. Add real public links to About, Support, and Privacy information. Keep support/contact details reachable without changing app state.
4. Add separate use-case pages only when each can provide distinct, useful content. Candidate topics are browser voice noise reduction and extracting audio from video; avoid thin near-duplicate variants.

## Priority 6 — Reconcile the mobile CSS fix with production

**Impact:** Low to medium, mainly usability  
**Effort:** Low  
**Dependency:** Review the pre-existing local CSS edit, then deploy through the normal release process.

1. The local `src/style.css` hides `.local-pill` below 560 px; the deployed CSS still displays it at a smaller font, and it clips at the 390 px right edge.
2. Confirm whether the local rule is the intended fix and include it in the next approved deployment.
3. Check the top bar and upload flow at 320, 360, 390, and 560 px, then confirm the icons have accessible names and visible keyboard focus.

## Priority 7 — Measure performance before optimizing

**Impact:** Unknown until measured  
**Effort:** Low for measurement; medium for changes  
**Dependency:** PageSpeed Insights quota or another field/lab tool.

1. Re-run PSI mobile and desktop after the crawlable HTML work is deployed. Capture LCP, INP, CLS, TTFB, and the LCP element; distinguish field data from Lighthouse lab data.
2. Review the waterfall and compressed transfer sizes. The current live JS response is about 451 KB raw and CSS about 44.5 KB raw, but this does not establish poor CWV.
3. Keep useful lazy imports. If measurements show main-thread or LCP problems, split editor-only UI and defer nonessential dependencies until a file is selected or a feature is opened.
4. Do not claim a Core Web Vitals pass or fail until actual metrics are available.

## Priority 8 — Monitor indexing and search performance

**Impact:** High for validating outcomes  
**Effort:** Low  
**Dependency:** Search Console and Bing Webmaster Tools access.

1. Verify the homepage and every public route with URL Inspection after deployment.
2. Monitor sitemap processing, indexing, canonical selection, and crawl errors.
3. Review query impressions and clicks to refine titles and content around the search intent that actually appears.

## Release sequencing

1. Confirm preferred domain and whether Vite remains the stack.
2. Implement the static public landing surface, metadata, crawl files, and schema together.
3. Add substantive public content and crawlable links for any intended acquisition pages.
4. Reconcile and deploy the mobile CSS fix.
5. Validate the built HTML, robots file, sitemap, and JSON-LD; then measure PSI/CrUX and review Search Console after indexing.

Production publication remains subject to your approval. No production change has been made.

## Local implementation status

The following items have been implemented in the checkout and verified in a production build:

- The homepage is prerendered into the initial HTML with its H1, supporting content, and crawlable links.
- `/extract-audio-from-video/` is generated as a public static route with its own H1, title, description, canonical, social metadata, and `WebApplication` JSON-LD.
- `robots.txt` and `sitemap.xml` list the homepage and extraction page only.
- The homepage now explains supported inputs and exports, local processing and storage, and noise-reduction limits. It links to extraction and support.
- Browser navigation updates the extraction URL, title, and back/forward state. Private Projects and Editor views remain out of the sitemap.
- The existing small-screen `.local-pill` CSS fix remains in the local source and will ship with the next approved release.

Remaining before and after release:

1. Replace the square PWA icon currently used for social previews with a purpose-built 1200 × 630 image.
2. Confirm the preferred hostname; the current canonical, sitemap, and robots reference use the provided Vercel URL.
3. After approval and deployment, inspect both URLs in Search Console, submit the sitemap, and check mobile layout at 320, 360, 390, and 560 px.
4. Measure PSI/CrUX performance and use actual LCP, INP, CLS, and TTFB data before making performance changes.

The local `npm run build` completed successfully. SEO artifact checks confirmed a unique title, description, canonical, one H1, and matching JSON-LD on both routes, plus the generated crawl files. The build still reports large JavaScript chunks; performance remains unmeasured and is not described as a CWV failure. No production deployment was performed.
