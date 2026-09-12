# Promptary Development Notes

[English](./DEVELOPMENT.md) | [正體中文](./DEVELOPMENT.zh-TW.md)

Last updated: 12 September 2026

Code version reviewed: `7e7ca57`

These notes describe the current local code and its committed history. Deployment status is separate and should be checked against the latest successful deployment.

## Current Status

Promptary is a local-first tool for collecting AI image generation prompts and tracking experiments. It is built with React 19, TypeScript, Vite 8, Tailwind CSS v4, and IndexedDB, and is hosted through GitHub Pages.

The current version includes collection search, tag and status filtering, favourites, naming for collections and experiments, ratings, cover image selection, categorised prompt reading, side-by-side mobile comparison, Traditional Chinese and English interfaces, ZIP backups, and local storage information. It also includes starter collections, a first-visit introduction and About dialog, and classification inheritance for custom experiment prompts.

Collections and images are stored in the browser under the current site origin. There is no sign-in system, cloud database, or automatic cross-device synchronisation. Supabase has been discussed and evaluated but has not been implemented. For now, moving data between devices relies on manually exporting and importing ZIP backups.

## Implementation Details

### First Visit and Starter Collections

When no current archive or legacy data exists, the app displays bundled starter collections and queues their images for storage in IndexedDB. `StoredImage.tsx` can display the bundled image URL while the local Blob is unavailable. Existing libraries, including saved empty libraries, are retained rather than repopulated with examples.

Starter installation shares the normal write queue and checks for an existing archive again before committing. Failed installation releases the queue so later writes can proceed. Database opening and initial archive reading have timeouts, as do starter image downloads and decoding; a stalled operation should not leave the initial loading screen waiting indefinitely. This fallback does not make unavailable browser storage writable.

The gallery opens a shorter About introduction until it has been dismissed, recording that preference in `localStorage` as `promptary_intro_seen`. The About button opens the full version with usage reminders, the project's background, and creator links. The dialog supports Escape, keyboard focus containment, and focus return to the About button. If the preference cannot be stored, the introduction may appear again.

### Images and Storage

Reference images in collections and generated images in experiments share the same processing pipeline. JPEG, PNG, and WebP are supported, with a maximum file size of 10 MiB per image and a decoded resolution limit of 40 megapixels.

A maximum of 10 images can be selected in a single batch. If this limit is exceeded, the entire batch is rejected before decoding begins. Each form processes no more than 2 images concurrently. Additional batches and retries use the same queue, and pending work that has not yet started will not begin after the form is closed.

Images are stored as canonical images with a maximum long edge of 2048 pixels, while thumbnails have a maximum long edge of 800 pixels. WebP is preferred where supported, with JPEG or PNG used as compatibility fallbacks. The actual output MIME type and decoding result are validated before storage.

React state stores image IDs and metadata, while image Blobs and thumbnails are stored separately in IndexedDB. These images are processed copies and are not guaranteed to match the original files in either byte content or dimensions.

Data updates are queued through `store.ts`. The UI is updated only after the corresponding IndexedDB transaction succeeds. If saving fails, the form remains open with its input preserved. Data version checks also prevent an older browser tab from directly overwriting a newer collection.

### Backups and Local Data

The current backup format is ZIP. It contains the manifest, canonical images, and the custom platform list. Regenerable thumbnails are not included.

Before import, Promptary validates the backup format, version, image data, entry count, file sizes, and unsafe paths. An import preview is shown first, and no data is written until the user confirms. Collections and images are then written transactionally to reduce the risk of partially imported data.

ZIP validation also checks central-directory boundaries and entry counts, rejects split archives and ZIP64 locator records, and verifies size consistency for uncompressed entries. During extraction, the `fflate` filter checks each entry's name, compressed size, declared uncompressed size, and compression method against the preflight result before allocating its output buffer. Missing, repeated, or inconsistent entries cause the import to fail.

When the same collection ID exists both locally and in the backup, the last-updated timestamp determines which version is kept. If the backup is newer, the entire collection is updated. If the local copy is newer or the timestamps are identical, the local version is kept.

Custom platforms are merged and deduplicated rather than replacing the local platform list.

Current limits:

| Limit | Value |
| --- | ---: |
| ZIP file | 100 MiB |
| Declared total uncompressed size | 200 MiB |
| ZIP entries | 10,001 |
| Manifest | 5 MiB |
| Individual canonical image | 20 MiB |

Migration logic for older browser-stored data is still retained in the codebase. This does not mean that legacy JSON backups can be restored through the current import interface.

The Storage API is used to query storage usage and check or request persistent storage. If the browser does not support the relevant API or rejects the request, Promptary continues to function normally.

Persistent storage is not a backup mechanism and cannot prevent data loss when the user explicitly clears site data.

### Prompt Reading and Forms

Categorised prompt reading is generated using local Chinese and English keyword rules. It does not use AI-based semantic analysis.

Manual category assignments are tied to the prompt text they were created for, preventing old classifications from being incorrectly applied after the original prompt changes. Categorised reading also does not alter the text copied from the original prompt.

When a custom experiment is created or its prompt changes, `inheritPromptClassification` matches trimmed text segments to the original prompt and carries their categories into a saved classification snapshot. Existing manual experiment categories take priority for matching segments; new segments use the local keyword rules. Saving an unchanged custom prompt retains its existing classification. This is inheritance at save time, not continuous synchronisation with later original-category changes.

When creating a new experiment, the custom prompt field is empty by default. Users can instead select **Unmodified** to use the original prompt.

The data model explicitly distinguishes between using the original prompt and using a custom prompt, rather than inferring the mode solely from whether two text values happen to be identical.

Collection and experiment forms share the same unsaved-change confirmation behaviour. This protection applies when closing a form; it is not automatic draft saving. Refreshing the page may still discard unsaved changes.

### Site Assets and Deployment

`index.html` includes favicons, an Apple touch icon, a theme colour, and a web manifest. The manifest uses relative start and scope URLs with standalone display settings. These assets provide browser and home-screen presentation; no service worker or offline application cache is implemented.

The GitHub Pages workflow checks out Git LFS assets with `lfs: true`. Keep this enabled so published images contain the actual binary files rather than LFS pointers. Vite uses `PAGES_BASE_PATH` for deployment under a subpath, and HTML icon links use `%BASE_URL%`.

`public/_headers` contains Cloudflare deployment headers, including CSP and caching rules. Their presence in the build does not establish that another hosting provider applies them. `.figma/make/site.json` retains site metadata and permits indexing through `robots.index: true`.

The HTML includes a Cloudflare Web Analytics script for website usage measurement, and the stylesheet loads Google Fonts. Local collection storage does not mean the page makes no external requests. Analytics is separate from the browser archive and does not add cloud backups or synchronisation.

## Main Files

| Area | Files |
| --- | --- |
| Gallery and detail views | `App.tsx`, `Gallery.tsx`, `DetailView.tsx` |
| Collection and experiment forms | `CollectionModal.tsx`, `AttemptModal.tsx`, `ModalCloseGuard.tsx` |
| Image processing and display | `imageBatch.ts`, `imageProcessing.ts`, `StoredImage.tsx` |
| Local data | `store.ts`, `archiveStorage.ts`, `storagePersistence.ts` |
| Backups | `backup.ts`, `ImportBackup.tsx` |
| Prompt reading and comparison | `PromptReader.tsx`, `promptClassification.ts`, `ImageComparison.tsx`, `comparisonImages.ts` |
| Language and platform preferences | `i18n/`, `platformStorage.ts` |
| Introduction and starter data | `AboutDialog.tsx`, `starterData.ts`, `starterInitTimeouts.ts`, `withTimeout.ts` |
| Tests | `tests/` |

The source files above are located under `src/`, while tests are stored in the project-level `tests/` directory.

Site assets and starter images are under `public/`. Deployment configuration is in `.github/workflows/pages.yml`, `vite.config.ts`, `index.html`, `public/_headers`, and `.figma/make/site.json`.

## Development Log

The following log is organised by Git commit date. Related changes from the same day have been grouped together, while older approaches that have since been replaced are kept only as a summary of the project's evolution.

### 2026-09-12 | Introduction, Startup Recovery, and ZIP Validation

Added an About dialog with usage notes, local storage reminders, the project's background, and creator links. First visits show a shorter introduction, with dismissal remembered in the current browser. Refined the bilingual copy, dialog layout, gallery actions on mobile, dropdown chevrons, and detail header controls.

Fixed IndexedDB starter installation failures so they no longer block subsequent writes. Added the Cloudflare Web Analytics script to the HTML.

Hardened ZIP central-directory validation and cross-checked extraction metadata against the preflight result. Added regression cases for malformed boundaries, inconsistent entry sizes, and split archives. These backup changes are recorded in `7e7ca57`.

### 2026-09-11 | Starter Examples, Classification Inheritance, and Site Assets

Replaced the earlier seed data with bundled example collections and images. Added startup timeouts and a display fallback so a new library can show examples while their images are being stored. Existing archives are preserved, and starter installation runs through the write queue.

Custom experiment prompts now inherit classifications for matching original segments while retaining their own manual adjustments. Refined experiment result cards, loading copy, and alignment between the detail header and content.

Added favicons, an Apple touch icon, and a web manifest. Enabled Git LFS checkout in the Pages workflow, added Cloudflare deployment headers, and updated the indexing setting.

### 2026-09-11 | Bilingual UI, Backup Management, and Stability

Added Traditional Chinese and English interface switching, with the selected language stored locally. English subtitle text and mobile filter labels were also refined.

Backup conflict handling was changed to compare timestamps when matching collection IDs are found. The import preview now reports how many collections will be added, updated, or kept unchanged. Custom platforms were added to ZIP backups and are merged with deduplication during import. Local storage usage and data protection status were added to the Manage menu.

Dropdown spacing, icons, and expand animations were refined. The category menu was migrated to React state management with outside-click handling, Escape-to-close support, and focus restoration. Collection and experiment forms gained unsaved-change confirmation, and the iOS search-field auto-zoom issue was fixed.

Image selection now allows up to 10 images per batch, with a maximum of 2 processed concurrently. The ZIP import limit was reduced to 100 MiB and the declared uncompressed size limit to 200 MiB.

Also fixed a development-mode issue where React StrictMode re-ran an effect without restoring a lifecycle flag, causing some images to remain stuck at 0% progress.

The image batching and backup limit fixes were committed as `1ff3877` and pushed to GitHub `main`.

### 2026-09-10 | Prompt Terminology and Typography

Standardised the Chinese interface around the term 「咒語」 for prompts. The custom prompt field for new experiments now starts empty while retaining the option to use the original prompt unchanged.

Refined font handling across the Chinese interface, English content, and technical text to improve consistency across headings, forms, and reading views.

### 2026-09-09 | Image Storage, ZIP Backups, and iOS Compatibility

Moved images into separate Blob storage, with React state retaining only image references and metadata. Added canonical images, on-demand thumbnails, and migration logic for older stored data.

Backups were migrated from JSON to ZIP, bundling collection data together with the actual stored images.

Collection and experiment forms gained explicit original/custom prompt modes and resizable text areas, alongside improvements to prompt, note, and thumbnail presentation.

Handled cases where iOS Canvas could not produce WebP as requested by preserving the actual MIME type and supporting JPEG/PNG fallback output. Also fixed form focus zoom behaviour, placeholder text, and touch interaction issues affecting Manage and sorting menus on mobile.

### 2026-09-08 | Naming, Category Editing, and Mobile Comparison

Added names to collections and experiments. Category keyword ordering and editing controls were consolidated, and restoring default categories now requires confirmation while temporarily preventing other category operations.

Side-by-side comparison retained both original and categorised prompt reading, while category editing was centralised in the detail reading view.

On mobile, comparison was changed to keep two images visible side by side. Arrow controls switch the information panel between the two sides while preserving each side's reading mode and scroll position.

### 2026-09-07 | Local Library and Core Organisation Flow

Established the initial collection workflow, experiment tracking, search, tags, statuses, favourites, custom platforms, image comparison, and GitHub Pages deployment.

Storage was migrated from the early localStorage approach to IndexedDB, with migration support, retry handling for failed saves, and data-version conflict protection.

The prompt reading interface initially experimented with text-difference highlighting before being replaced by the current original and categorised reading modes.

The JSON backup format, 2 MB image limit, and earlier comparison layout from this stage have since been replaced by later implementations.

## Validation and Maintenance

Basic checks:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Run these checks against the revision being changed; an earlier successful run does not establish the state of a later revision.

Tests cover image processing, batch limits and concurrency control, storage and migration, ZIP backups and malformed archive rejection, collection flows, custom platforms, classification inheritance and comparison image selection, form-closing behaviour, and starter data loading and fallback.

Some interface checks validate code structure rather than full browser interaction, so they do not replace manual browser testing.

Changes involving images or mobile interaction should still be manually verified for image selection, successful saving, reloading persisted data, adding a second batch, closing forms, and restoring backups.

Also check first-visit introduction dismissal, reopening About, starter loading on a fresh library, and keeping an existing or deliberately emptied library unchanged. For deployment changes, verify the published image bytes and asset paths as well as the build result.

Passing the test suite does not mean that memory usage or processing time has been measured across every device.

Future changes should remain narrowly scoped where possible. If sign-in or automatic cross-device synchronisation is introduced later, data synchronisation and conflict-resolution behaviour should be designed separately.

These ideas are not considered implemented features in the current version.
