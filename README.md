# Promptary

[English](./README.md) | [正體中文](./README.zh-TW.md)

*Your AI image prompt library —☆ﾟ.*･*

Promptary is a small tool for collecting AI image generation prompts and keeping track of your own experiments with them.

I kept finding great prompts online without having a convenient place to save and organise them, so I burned some tokens before my Codex reset and built Promptary — a place where reference images, original prompts, sources, generated results, and personal notes can all live together.

🔗 [Try Promptary online](https://phcy0614.github.io/promptary/)

No sign-in is required. Collections and images are stored locally in your browser. The interface supports Traditional Chinese and English. Cloud storage and automatic cross-device syncing are not currently available.

## Current Version

Last updated: 11 September 2026.

Promptary currently supports collection management, experiment tracking, categorised prompt reading, side-by-side image comparison, ZIP backups, and local storage information. Recent updates also introduced a limit of 10 images per selection, with up to 2 images processed concurrently, along with size limits for backup imports.

The current code version is `1ff3877` and has been pushed to the GitHub `main` branch. The live site reflects the most recent successful deployment.

## Workflow

1. Create a collection with reference images, prompts, sources, and notes. You can also save images first and add the text later.
2. Find collections using search, tags, status filters, and favourites.
3. Copy a prompt and use it on your preferred image generation platform.
4. Add experiments to a collection to record generated images, the prompt actually used, platform, model, rating, and notes.
5. Select any two images for side-by-side comparison and review the prompt and experiment details associated with each one.

## Features

* **Collection management**: Name collections and experiments, and organise them with tags, search, status filters, sorting, and favourites.
* **Experiment tracking**: Each collection can contain multiple experiments with generated images, platform, model, date, rating, and notes. Custom platforms can also be managed.
* **Prompt reading**: Switch between the original prompt and a categorised view, with categories that can be adjusted manually. Categorisation is based on local Chinese and English keyword matching. It does not modify the original prompt or copied text, and does not call any AI service.
* **Image comparison**: Reference images and generated results can both be used as cover images. Any two images can be compared side by side, including on mobile, with controls for switching the information shown for each side.
* **Form protection**: If a form contains unsaved changes, Promptary asks for confirmation before closing it. If saving fails, your input is preserved so you can retry.
* **Bilingual interface**: Switch between Traditional Chinese and English. Your language preference is stored in the current browser.

## Image Processing

Reference images and generated results follow the same rules:

* JPEG, PNG, and WebP are supported.
* Maximum file size: 10 MiB per image, with a maximum decoded resolution of 40 megapixels.
* Up to 10 images can be selected at once. If the limit is exceeded, the entire selection is rejected and the images can instead be added in smaller batches.
* Each form processes up to 2 images concurrently. Additional images are queued.
* There is no fixed limit on the total number of images in a collection or experiment, but browser storage limits still apply.

Images are resized and re-encoded locally before being stored. The longest side of the saved version is limited to 2048 pixels. WebP is preferred, with JPEG or PNG used as fallbacks when necessary.

**Promptary stores processed copies of images. It is not intended to be an archive for original files. If you need to preserve the original resolution or quality, keep a separate copy of the original image.**

## Data Storage and Backups

Collections and images are stored in the current browser using IndexedDB. Data is stored separately for each device, browser, and site origin. The live website and a local development URL, for example, do not share the same library.

Clearing site data may delete your collections, and private or incognito browsing is not suitable for long-term storage. Regularly download a ZIP backup through **Manage → Export**.

The ZIP backup contains collections, experiment records, processed images, and the custom platform list.

To import a backup:

1. Open **Manage → Import** and select a ZIP file exported by Promptary.
2. Review the number of collections that will be added, updated, or kept unchanged.
3. Confirm the import before anything is written to the local library.

When the same collection ID exists both locally and in the backup, Promptary compares their last-updated timestamps. If the backup is newer, the entire collection is updated. If the local copy is newer or both timestamps are identical, the local version is kept.

This is not a field-by-field merge. Custom platform lists, however, are merged and deduplicated.

The current ZIP import limit is **100 MiB**, with a maximum declared uncompressed size of **200 MiB**. Legacy JSON backups cannot be restored directly through the current import interface.

**Manage → Local Data** shows the storage usage reported by the browser and the current data protection status. Storage protection is still controlled by the browser. It does not replace ZIP backups and does not provide automatic syncing.

## Local Development

Built with React 19, TypeScript, Vite 8, Tailwind CSS v4, and IndexedDB.

The interface is based on a design originally created in Figma Make, with OpenAI Codex used during development and debugging.

The project is configured for Node.js 22 and pnpm 10.34.3.

```bash
pnpm install
pnpm dev
```

Open the local URL shown in the terminal to preview the app.

To run checks and create a production build:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Architecture notes and the dated development log will be added separately.
