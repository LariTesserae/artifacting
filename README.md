# Artifacting Plugin for Obsidian

**Version:** 0.2.0 (TypeScript Conversion - Actively Developed)
**Authors:** Lari & Gemini

## Overview

The Artifacting plugin is designed to help researchers, creatives, and anyone working extensively with AI-generated content (like LLM conversations, screenshots, and other digital artifacts) to better manage, contextualize, and rediscover these materials within Obsidian.

It aims to provide a fluid system for capturing, indexing, and searching through various types of AI-related artifacts, acknowledging that insights often emerge over time and through revisiting diverse pieces of information.

This plugin leverages the **Text Extractor** community plugin (by `scambier`) for OCR capabilities. It is highly recommended to have Text Extractor installed and enabled for full functionality regarding image content search.

## Core Features

1.  **Loom Data Indexing & Search:**
    *   **Functionality:** Indexes data from the `Loomsidian` plugin's `data.json` file, allowing you to search through the text content of all your loom nodes (conversation branches).
    *   **How to Use:**
        *   **Automatic Indexing:** Loom data is automatically indexed when Obsidian starts.
        *   **Manual Indexing:** Run the command "Artifacting: Index Loom Data" from the command palette (Cmd/Ctrl+P) to re-index manually.
        *   **Search:** Run the command "Artifacting: Search Looms". A modal will appear allowing you to type search queries. Selecting a result will attempt to open the relevant document and switch the Loomsidian view to that specific node.

2.  **Screenshot Processing (from Folder):**
    *   **Functionality:** Automatically processes image files (PNG, JPG, JPEG) from a designated input folder (configurable in settings), creates a new Obsidian note for each, embeds the image, moves the original image to your vault's **globally configured attachment folder**. If enabled in settings, a customizable tag (e.g., `#new_artifact`) is automatically added to the body of newly created notes to help identify them for further review.
    *   **Setup:**
        *   Ensure your vault's main attachment folder is configured in Obsidian's settings (`Settings` > `Files & Links` > `Default location for new attachments`). This is where the image files themselves will be moved.
        *   Configure the "Screenshot Input Folder", "Screenshot Notes Output Folder", and the optional "New" Tag settings in the Artifacting plugin settings.
    *   **How to Use:**
        *   **Automatic Processing:** Place new screenshot files into the folder specified in "Screenshot Input Folder" (default: `Inbox/Screenshots`). The plugin will process them automatically when Obsidian starts (after the layout is ready).
        *   **Manual Processing:** Run the command "Artifacting: Process New Screenshots" to process any new images in the input folder.
    *   **Output:** New notes are created in the folder specified in "Screenshot Notes Output Folder" (default: `Artifacts/Screenshots`), with the image embedded and basic frontmatter (`artifactGeneratedDate`). If enabled, the specified "new" tag is added to the note body. The original image is moved to your vault's global attachment folder.

3.  **Image from Clipboard to Note:**
    *   **Functionality:** Quickly creates a new note with an image pasted directly from your clipboard. The image is saved to your vault's globally configured attachment folder and OCR is attempted via `Text Extractor`.
    *   **How to Use:** Copy an image. In Obsidian, use `Cmd+Shift+V` (macOS) / `Ctrl+Shift+V` (Win/Linux), or run the command "Artifacting: Create Note from Clipboard Image". A new note embedding the image is created in the "Screenshot Notes Output Folder" and opened.

4.  **Note Merging:**
    *   **Functionality:** Merges the content of multiple Markdown notes into a single new note.
    *   **How to Use:**
        *   Run the command "Artifacting: Merge Notes...".
        *   In the modal, use the search bar to find and click notes to add them to the merge list. Click selected notes in the list to remove them.
        *   Specify a name for the new merged note.
        *   Optionally, check "Archive original notes after merging?".
        *   Click "Merge Notes".
    *   **Output:** A new note is created in the same folder as the *first file* selected. It contains frontmatter (`mergedDate`, `sourceNotes`), a list of merged files, and their concatenated content (bodies only), separated by `***`. Originals are archived to the "Merged Notes Archive Folder" if selected.

5.  **Create Note for Selected File:**
    *   **Functionality:** Allows you to quickly create an artifact note for any file in your vault. The note embeds the selected file.
    *   **How to Use:**
        *   **Context Menu:** Right-click on a file in Obsidian's file explorer and select "Artifacting: Create note for this file".
        *   **Command Palette:** Open a file in an editor, then run the command "Artifacting: Create Note for Active File".
    *   **Output:** A new note is created in the "Screenshot Notes Output Folder" (configurable, default: `Artifacts/Screenshots`), embedding the selected file. Frontmatter includes `artifactPath` and `artifactGeneratedDate`. If the selected file is an image, it will also be indexed for OCR search (via Text Extractor if available).

6.  **Vault-Wide Image OCR Indexing (via Text Extractor):**
    *   **Functionality:** Scans all images in your vault, uses the `Text Extractor` community plugin (if installed and enabled) to perform OCR, and makes the text content of these images searchable via the "Search Screenshots (OCR Text)" command.
    *   **Setup:** Requires the `Text Extractor` plugin by `scambier` to be installed and enabled.
    *   **How to Use:** Run the command "Artifacting: Scan/Update OCR for All Images in Vault". This can take time for large vaults. The command also prunes entries from the index if the source image no longer exists.

7.  **Loomsidian Data Backup:**
    *   **Functionality:** Provides automatic and manual backup for Loomsidian's `data.json` file.
    *   **Setup & How to Use:** Configure options in the "Loomsidian Data Backup" section of Artifacting plugin settings. Backups can be triggered on Obsidian startup (based on data growth since last backup), daily at a set time, or manually via the "Artifacting: Backup Loomsidian Data Now" command.

## Plugin Settings

To configure the Artifacting plugin, go to Obsidian's `Settings` > `Community Plugins` and click the cog icon next to "Artifacting", or find the "Artifacting" tab.

### Screenshot Processing
*   **Screenshot Input Folder Path:**
    *   Description: Folder to scan for new screenshots to process.
    *   Default: `Inbox/Screenshots`
*   **Screenshot Notes Output Folder Path:**
    *   Description: Folder where new notes for processed screenshots (from folder or clipboard) and notes for generic artifacted files will be created.
    *   Default: `Artifacts/Screenshots`
*   **Enable "New" Tag for Folder Screenshots:**
    *   Description: If enabled, automatically adds a customizable tag to notes created from the input folder.
    *   Default: On
*   **Tag for New Folder Screenshots:**
    *   Description: The tag to add (without #) to notes for newly processed folder screenshots. E.g., "new_artifact" or "needs_review". (Only active if the above toggle is on).
    *   Default: `new_artifact`

### Note Merging
*   **Merged Notes Archive Folder Path:**
    *   Description: Folder where original notes will be moved after merging (if 'archive' option is chosen during merge).
    *   Default: `Artifacts/MergedNotesArchive/`

### Loomsidian Data Backup
*   **Enable Loomsidian Backup Feature:**
    *   Description: If enabled, the plugin will manage backups for Loomsidian's `data.json` file.
    *   Default: On
*   **Loom Backup Folder Path:**
    *   Description: Folder (relative to vault root) where Loomsidian data backups will be stored. (Only active if backup feature is enabled).
    *   Default: `ArtifactingData/LoomBackups`
*   **Maximum Loom Backups to Keep:**
    *   Description: The number of recent Loomsidian backups to retain. Older backups will be deleted. (Only active if backup feature is enabled).
    *   Default: `5`
*   **Backup Growth Threshold (KB):**
    *   Description: Create a backup if Loomsidian data grows by this many kilobytes since the last backup (during startup/daily checks). (Only active if backup feature is enabled).
    *   Default: `512`
*   **Enable Daily Backup Check:**
    *   Description: In addition to startup/growth checks, also check daily at the specified time. (Only active if backup feature is enabled).
    *   Default: On
*   **Daily Backup Check Time (HH:MM):**
    *   Description: Time for the daily backup check (24-hour format, e.g., 06:00 for 6 AM). (Only active if backup feature is enabled).
    *   Default: `06:00`

*(The plugin uses your vault's global attachment folder setting for storing the actual image files processed from the input folder or clipboard.)*

## Installation & Development

This plugin is developed using TypeScript and requires a build step.

**Manual Installation (for users):**

1.  Download the latest `main.js`, `manifest.json`, and `styles.css` from the plugin's releases page (or build from source).
2.  In your Obsidian vault, go to `.obsidian/plugins/`.
3.  Create a new folder named `artifacting`.
4.  Copy the downloaded files into this `artifacting` folder.
5.  In Obsidian: `Settings` > `Community plugins`, disable Restricted Mode, find "Artifacting", and enable it.
6.  Reload Obsidian (Cmd/Ctrl+R).
7.  **Recommended:** Install the `Text Extractor` plugin by `scambier` for OCR functionality.

**Development Setup:**

1.  Clone the repository containing the `artifacting` source folder.
2.  Navigate to the `artifacting` folder in your terminal.
3.  Run `npm install` to install dependencies (`typescript`, `obsidian`, `esbuild`, etc.).
4.  The main source code is in `main.ts`.
5.  To build the plugin (compile `main.ts` to `main.js`):
    *   `npm run build` (for production build)
    *   `npm run dev` (for development build with sourcemaps, watches for changes)
6.  Copy the generated `main.js`, plus `manifest.json` and `styles.css`, to your test vault's `.obsidian/plugins/artifacting/` folder.

## Future Development Ideas

*   Improved search capabilities (fuzzy search, advanced filters).
*   More robust file picker in the Merge Notes modal.
*   Option to create artifact note when selecting an image from screenshot search results if no note exists.
*   Configurable automatic full OCR scan on startup (e.g., if index is old or new files detected).
*   More robust tag sanitization.

---

*Happy Artifacting!* 