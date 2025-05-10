// Main script for the Artifacting plugin
const { Plugin, Notice, normalizePath, SuggestModal, TFile, TFolder } = require('obsidian');

/**
 * @typedef {object} LoomNodeInfo
 * @property {string} id
 * @property {string | null} parentId
 * @property {string} text
 * @property {string} documentPath
 * @property {boolean} [bookmarked]
 */

/**
 * @typedef {{[nodeId: string]: LoomNodeInfo}} LoomIndex
 */

/**
 * @typedef {object} LoomNodeData
 * @property {string} text
 * @property {string | null} parentId
 * @property {boolean} [bookmarked]
 */

/**
 * @typedef {object} LoomDocumentState
 * @property {{[nodeId: string]: LoomNodeData}} nodes
 */

/**
 * @typedef {{[documentPath: string]: LoomDocumentState}} LoomState
 */

/**
 * @typedef {object} ScreenshotInfo
 * @property {string} currentPath Path where the screenshot currently resides (likely attachments folder)
 * @property {string} notePath Path of the Obsidian note created for this screenshot
 * @property {string | null} ocrText Extracted text (null if not processed/failed)
 * @property {Date} processedDate When the screenshot was processed
 * @property {string[]} [tags] Optional tags
 */

/** @typedef {{[currentPath: string]: ScreenshotInfo}} ScreenshotIndex */

/**
 * @typedef {object} ArtifactingSettings
 * @property {string} screenshotInputFolder
 * @property {string} screenshotNoteFolder
 */

const DEFAULT_SETTINGS = {
    screenshotInputFolder: 'Inbox/Screenshots', // Example default
    screenshotNoteFolder: 'Artifacts/Screenshots', // Example default
};

/**
 * @typedef {object} ArtifactingData
 * @property {LoomIndex} loomIndex
 * @property {ScreenshotIndex} screenshotIndex
 * @property {string[]} processedScreenshotPaths List of original paths already processed
 */

const LOOM_DATA_PATH = '.obsidian/plugins/loom/data.json'; // Path relative TO THE VAULT ROOT

class Artifacting extends Plugin {
    /** @type {LoomIndex} */
    index = {}; // In-memory index for now
    /** @type {ArtifactingSettings} */
    settings;
    /** @type {ScreenshotIndex} */
    screenshotIndex = {};
    /** @type {string[]} */
    processedScreenshotPaths = [];

    async onload() {
        console.log('Loading Artifacting plugin');

        await this.loadPluginSettings();
        await this.loadPluginData();

        // --- Command to Trigger Loom Indexing ---
        this.addCommand({
            id: 'index-looms',
            name: 'Index Loom Data',
            callback: async () => {
                await this.buildIndex();
                new Notice('Loom data indexing complete!');
            }
        });

        // --- Command to Open Loom Search Interface ---
        this.addCommand({
            id: 'search-looms',
            name: 'Search Looms',
            callback: () => {
                if (Object.keys(this.index).length === 0) {
                    new Notice('Index is empty. Run "Index Loom Data" first.');
                    return;
                }
                new LoomSearchModal(this.app, this).open();
            }
        });

        // --- Command to Process Screenshots ---
        this.addCommand({
            id: 'process-screenshots',
            name: 'Process New Screenshots',
            callback: async () => {
                await this.processScreenshots();
            }
        });

        // --- Command to Search Screenshots (Placeholder) ---
        this.addCommand({
            id: 'search-screenshots',
            name: 'Search Screenshots',
            callback: () => {
                new Notice('Screenshot search not yet implemented.');
                console.log("Current Screenshot Index:", this.screenshotIndex);
            }
        });

        // --- Command to Create Note from Clipboard Image ---
        this.addCommand({
            id: 'paste-image-from-clipboard',
            name: 'Create Note from Clipboard Image',
            hotkeys: [{ modifiers: ["Mod", "Shift"], key: "V" }], // Suggests Cmd/Ctrl+Shift+V
            callback: async () => {
                await this.handlePasteFromClipboard();
            }
        });

        // Initial loom indexing on load
        await this.buildIndex();

        // Defer screenshot processing until layout is ready
        this.app.workspace.onLayoutReady(async () => {
            console.log('Obsidian layout ready. Processing screenshots...');
            await this.processScreenshots();
        });
    }

    onunload() {
        console.log('Unloading Artifacting plugin');
        // Make sure to save plugin data on unload
        this.savePluginData();
    }

    /**
     * Reads and parses the loom data.json file.
     * @returns {Promise<LoomData | null>}
     */
    async readLoomData() {
        // We need to get the vault's base path to construct the full path
        // Obsidian's API usually works with paths relative *to the vault root*.
        const vaultRelativePath = normalizePath(LOOM_DATA_PATH);
        console.log(`Attempting to read loom data from vault path: ${vaultRelativePath}`);


        try {
            const fileExists = await this.app.vault.adapter.exists(vaultRelativePath);
            if (!fileExists) {
                 new Notice(`Loom data file not found at: ${vaultRelativePath}`);
                 console.error(`Loom data file not found at: ${vaultRelativePath}`);
                 return null;
            }

            const jsonData = await this.app.vault.adapter.read(vaultRelativePath);
            if (!jsonData) {
                 new Notice('Loom data file is empty.');
                 console.error('Loom data file is empty.');
                 return null;
            }
             /** @type {LoomData} */
             const parsedData = JSON.parse(jsonData);
             return parsedData;
        } catch (error) {
            new Notice('Error reading or parsing loom data file. See console for details.');
            console.error('Error reading/parsing loom data file:', error);
            return null;
        }
    }

    async buildIndex() {
        console.log('Building loom index...');
        const loomData = await this.readLoomData();

        if (!loomData || !loomData.state) {
            console.log('No loom data found or data is invalid. Index not built.');
            this.index = {}; // Clear index if data is invalid
            return;
        }

        /** @type {LoomIndex} */
        const newIndex = {};

        try {
            for (const [documentPath, docState] of Object.entries(loomData.state)) {
                if (!docState || !docState.nodes) continue; // Skip if document state or nodes are missing

                for (const [nodeId, nodeData] of Object.entries(docState.nodes)) {
                    if (!nodeData || typeof nodeData.text !== 'string') continue; // Skip if node data or text is missing/invalid

                    newIndex[nodeId] = {
                        id: nodeId,
                        parentId: nodeData.parentId ?? null, // Ensure parentId is null if undefined
                        text: nodeData.text,
                        documentPath: documentPath,
                        bookmarked: nodeData.bookmarked ?? false, // Default bookmarked to false if undefined
                    };
                }
            }
            this.index = newIndex;
            console.log(`Index built successfully with ${Object.keys(this.index).length} nodes.`);
        } catch (error) {
             new Notice('Error building index from loom data. See console for details.');
             console.error('Error building index:', error);
             this.index = {}; // Clear index on error
        }
    }

    /**
     * Placeholder search function.
     * @param {string} query
     * @returns {LoomNodeInfo[]}
     */
    searchIndex(query) {
        // TODO: Implement actual search logic (e.g., simple text match, fuzzy search, regex)
        const lowerCaseQuery = query.toLowerCase();
        return Object.values(this.index).filter(node =>
            node.text.toLowerCase().includes(lowerCaseQuery)
        );
    }

    // --- Settings Handling ---
    async loadPluginSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async savePluginSettings() {
        // Note: saveData combines settings and other plugin data
        await this.savePluginData();
    }

    // --- Combined Data Handling ---
    async loadPluginData() {
        const data = await this.loadData();
        if (data) {
            this.index = data.loomIndex || {};
            this.screenshotIndex = data.screenshotIndex || {};
            this.processedScreenshotPaths = data.processedScreenshotPaths || [];
            // Also load settings if stored within the same object
            this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

        }
         console.log(`Loaded plugin data: ${Object.keys(this.index).length} loom nodes, ${Object.keys(this.screenshotIndex).length} screenshots indexed, ${this.processedScreenshotPaths.length} processed.`);

    }

    async savePluginData() {
        const dataToSave = {
            // Include settings
            ...this.settings,
            // Include other data
            loomIndex: this.index,
            screenshotIndex: this.screenshotIndex,
            processedScreenshotPaths: this.processedScreenshotPaths,
        };
        await this.saveData(dataToSave);
        console.log('Saved plugin data.');
    }

    // --- Screenshot Processing Logic ---
    /**
     * Creates a note for a screenshot, embeds the image, runs OCR, and updates the index.
     * @param {TFile} imageFile The screenshot file object.
     * @param {string} outputFolderRelPath The relative path to the output folder.
     */
    async createNoteAndIndexScreenshot(imageFile, outputFolderRelPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Simple timestamp for filename
        const noteName = `${imageFile.basename}_${timestamp}.md`;

        const initialOriginalPath = imageFile.path; // Still needed to track processed files from input folder

        // --- 0. Determine Attachment Path and Move Image ---
        let currentImagePath = imageFile.path; // Default to original path if move fails
        let movedFile = null; // Will hold the TFile object if move is successful

        const attachmentLocationSetting = this.app.vault.getConfig('attachmentFolderPath');
        let targetAttachmentFolder = '';

        if (attachmentLocationSetting === '/') { // In vault root
            targetAttachmentFolder = '/';
        } else if (attachmentLocationSetting.startsWith('./')) { // In subfolder under current folder - less ideal for this plugin
            // For simplicity, we'll default to a root-level folder if this complex case is set.
            // A more robust solution would respect this setting relative to the *note* being created.
            // Or, we could add a plugin setting for a dedicated screenshot attachment folder.
            console.warn('Attachment folder is set to be relative to current note. Defaulting to vault root for screenshot attachments for now.');
            targetAttachmentFolder = attachmentLocationSetting.substring(2); // Use it as a root folder
        } else { // Specific folder name
            targetAttachmentFolder = attachmentLocationSetting;
        }
        targetAttachmentFolder = normalizePath(targetAttachmentFolder);

        // Ensure the target attachment folder exists
        if (targetAttachmentFolder !== '/' && !(await this.app.vault.adapter.exists(targetAttachmentFolder))) {
            try {
                await this.app.vault.createFolder(targetAttachmentFolder);
            } catch (folderErr) {
                new Notice(`Failed to create attachment folder: ${targetAttachmentFolder}. Screenshot will not be moved.`);
                console.error(`Failed to create attachment folder ${targetAttachmentFolder}:`, folderErr);
                // Keep currentImagePath as the original, file won't be moved
            }
        }

        if (targetAttachmentFolder === '/' || await this.app.vault.adapter.exists(targetAttachmentFolder)) {
            try {
                let desiredAttachmentPath = normalizePath(`${targetAttachmentFolder}/${imageFile.name}`);
                let counter = 0;
                // Loop to find a unique name
                while (await this.app.vault.adapter.exists(desiredAttachmentPath)) {
                    counter++;
                    desiredAttachmentPath = normalizePath(`${targetAttachmentFolder}/${imageFile.basename}-${counter}.${imageFile.extension}`);
                }

                console.log(`Moving ${imageFile.path} to ${desiredAttachmentPath}`);
                await this.app.vault.rename(imageFile, desiredAttachmentPath);
                currentImagePath = desiredAttachmentPath;
                movedFile = this.app.vault.getAbstractFileByPath(currentImagePath); // Get the handle to the moved file

            } catch (err) {
                new Notice(`Failed to move screenshot ${imageFile.name} to attachments folder. Note will link to original.`);
                console.error(`Failed to move screenshot ${imageFile.path} to attachments folder:`, err);
                // currentImagePath remains imageFile.path
            }
        }

        const notePath = normalizePath(`${outputFolderRelPath}/${noteName}`);

        // --- 1 & 2: Create Note with Embed ---
        const frontmatter = `---
processedDate: ${new Date().toISOString()}
---`; // Correct YAML delimiter, no trailing characters on this line
        // Use Obsidian's internal linking syntax for embeds - use the potentially updated path
        const embedLink = `![[${currentImagePath}]]`;
        const noteContent = `${frontmatter}

${embedLink}

`; // Ensure a blank line after frontmatter, then embed

        try {
            await this.app.vault.create(notePath, noteContent);
            console.log(`Created note for screenshot: ${notePath}`);
        } catch (err) {
            new Notice(`Failed to create note: ${notePath}`);
            console.error(`Failed to create note: ${notePath}`, err);
            return; // Don't proceed if note creation fails
        }

        // --- 3. Run OCR (Conceptual) ---
        let ocrText = null;
        try {
            console.log(`Starting OCR for ${imageFile.path}...`);
            // In a real implementation with Tesseract.js:
            // const fileToRead = movedFile instanceof TFile ? movedFile : imageFile; // Use moved file if available
            // const imageBuffer = await this.app.vault.adapter.readBinary(fileToRead.path);
            // const result = await Tesseract.recognize(imageBuffer, 'eng', {
            //     logger: m => console.log(`OCR progress (${fileToRead.name}):`, m.status, Math.round(m.progress * 100) + '%')
            // });
            // ocrText = result.data.text;

            // For now, just simulate OCR success/failure and text
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
            ocrText = `(Simulated OCR Text for ${imageFile.name} from ${currentImagePath} - Content would be here)`; // Placeholder text
            console.log(`OCR successful for ${imageFile.path}`);

        } catch (err) {
            console.error(`OCR failed for ${imageFile.path}:`, err);
            new Notice(`OCR failed for ${imageFile.name}. Note created without OCR text.`);
            // Continue without OCR text, index entry will reflect this
        }

        // --- 4. Update Screenshot Index ---
        this.screenshotIndex[currentImagePath] = {
            currentPath: currentImagePath,
            notePath: notePath,
            ocrText: ocrText,
            processedDate: new Date(),
            tags: [] // Initialize empty tags; maybe parse from body later if needed for index?
        };

        // --- 5. Add to processed list (handled outside this function) ---
        // --- 6. Save data (handled outside this function) ---
    }

    async processScreenshots() {
        new Notice('Starting screenshot processing...');
        console.log('Processing screenshots...');

        const inputFolderRelPath = normalizePath(this.settings.screenshotInputFolder);
        const inputFolder = this.app.vault.getAbstractFileByPath(inputFolderRelPath);

        if (!(inputFolder instanceof TFolder)) {
            new Notice(`Screenshot input folder not found: ${inputFolderRelPath}`);
            console.error(`Screenshot input folder not found: ${inputFolderRelPath}`);
            return;
        }

        const outputFolderRelPath = normalizePath(this.settings.screenshotNoteFolder);
        const outputFolder = this.app.vault.getAbstractFileByPath(outputFolderRelPath);
         if (!(outputFolder instanceof TFolder)) {
             try {
                await this.app.vault.createFolder(outputFolderRelPath);
                console.log(`Created screenshot note folder: ${outputFolderRelPath}`);
            } catch (err) {
                 new Notice(`Failed to create screenshot note folder: ${outputFolderRelPath}`);
                 console.error(`Failed to create screenshot note folder: ${outputFolderRelPath}`, err);
                 return;
            }
         }

        let processedCount = 0;
        const filesToProcess = [...inputFolder.children]; // Iterate over a copy

        console.log(`Found ${filesToProcess.length} items in input folder ${inputFolderRelPath}`);

        for (const file of filesToProcess) {
            console.log(`Checking file: ${file.path} (instance of TFile: ${file instanceof TFile})`);
            if (file instanceof TFile && (file.extension === 'png' || file.extension === 'jpg' || file.extension === 'jpeg')) {
                console.log(`  - Is an image. Processed already? ${this.processedScreenshotPaths.includes(file.path)}`);
                if (!this.processedScreenshotPaths.includes(file.path)) {
                    console.log(`Processing new screenshot: ${file.path}`);

                    // Call the new function to handle note creation, OCR, indexing
                    await this.createNoteAndIndexScreenshot(file, outputFolderRelPath);

                    // Add to processed list after successful processing attempt (even if OCR failed)
                    this.processedScreenshotPaths.push(file.path);
                    processedCount++;
                } else {
                    // console.log(`Skipping already processed screenshot: ${file.path}`);
                }
            }
        }

        if (processedCount > 0) {
            await this.savePluginData(); // Save the updated processed list
            new Notice(`Processed ${processedCount} new screenshot(s).`);
            console.log(`Processed ${processedCount} new screenshot(s).`);
        } else {
            new Notice('No new screenshots found to process.');
            console.log('No new screenshots found.');
        }
    }

    // --- Screenshot Indexing/Search Logic (Stubs) ---
    async buildScreenshotIndex() {
        // TODO: Implement logic to potentially re-index OCR from existing notes if needed
        // For now, index is built as screenshots are processed or pasted.
        console.log('Screenshot index build/rebuild (placeholder)...');
    }

    /**
     * Placeholder search function for screenshots.
     * @param {string} query
     * @returns {ScreenshotInfo[]}
     */
    searchScreenshotIndex(query) {
        console.log('Searching screenshot index (placeholder)... Query:', query);
        // TODO: Implement actual search on screenshotIndex based on OCR text etc.
        const lowerCaseQuery = query.toLowerCase();
        return Object.values(this.screenshotIndex).filter(info =>
             info.ocrText && info.ocrText.toLowerCase().includes(lowerCaseQuery)
        );
    }

    // --- Clipboard Image Handling ---
    async handlePasteFromClipboard() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            let imageBlob = null;
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    imageBlob = await item.getType(imageType);
                    break;
                }
            }

            if (!imageBlob) {
                new Notice('No image found on clipboard.');
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            // Determine file extension, default to png
            const extension = imageBlob.type.split('/')[1] || 'png';
            const imageName = `Clipboard Image ${timestamp}.${extension}`;

            // Save the blob to the configured attachment folder
            const attachmentLocationSetting = this.app.vault.getConfig('attachmentFolderPath');
            let targetAttachmentFolder = '';
            if (attachmentLocationSetting === '/') { 
                targetAttachmentFolder = '/';
            } else if (attachmentLocationSetting.startsWith('./')) {
                console.warn('Attachment folder for clipboard images is set to be relative to current note. Defaulting to vault root.');
                targetAttachmentFolder = attachmentLocationSetting.substring(2);
            } else { 
                targetAttachmentFolder = attachmentLocationSetting;
            }
            targetAttachmentFolder = normalizePath(targetAttachmentFolder);

            if (targetAttachmentFolder !== '/' && !(await this.app.vault.adapter.exists(targetAttachmentFolder))) {
                try {
                    await this.app.vault.createFolder(targetAttachmentFolder);
                } catch (folderErr) {
                    new Notice(`Failed to create attachment folder: ${targetAttachmentFolder} for clipboard image.`);
                    return;
                }
            }

            let desiredAttachmentPath = normalizePath(`${targetAttachmentFolder}/${imageName}`);
            let counter = 0;
            while (await this.app.vault.adapter.exists(desiredAttachmentPath)) {
                counter++;
                desiredAttachmentPath = normalizePath(`${targetAttachmentFolder}/Clipboard Image ${timestamp}-${counter}.${extension}`);
            }

            const arrayBuffer = await imageBlob.arrayBuffer();
            const savedImageFile = await this.app.vault.createBinary(desiredAttachmentPath, arrayBuffer);
            new Notice(`Image pasted and saved to: ${savedImageFile.path}`);

            // Create a note for the clipboard image
            const outputFolderRelPath = normalizePath(this.settings.screenshotNoteFolder); // Or a new setting for clipboard notes
            const noteName = `Clipboard Capture ${timestamp}.md`;
            const notePath = normalizePath(`${outputFolderRelPath}/${noteName}`);
            const frontmatter = `---
capturedDate: ${new Date().toISOString()}
---`; // Removed imagePath
            const embedLink = `![[${savedImageFile.path}]]`;
            const noteContent = `${frontmatter}

${embedLink}

`; // Ensure a blank line after frontmatter, then embed

            const createdNote = await this.app.vault.create(notePath, noteContent);
            console.log(`Created note for clipboard image: ${notePath}`);

            // (Conceptual) OCR & Indexing for the new clipboard image
            let ocrText = `(Simulated OCR for clipboard image: ${savedImageFile.name})`;
            this.screenshotIndex[savedImageFile.path] = { // Use image path as key
                currentPath: savedImageFile.path,
                notePath: notePath,
                ocrText: ocrText,
                processedDate: new Date(),
                tags: ['clipboard-capture']
            };
            await this.savePluginData();

            // Optionally open the new note
            this.app.workspace.getLeaf(true).openFile(createdNote);

        } catch (err) {
            console.error('Failed to paste image from clipboard:', err);
            if (err.name === 'NotAllowedError') {
                new Notice('Clipboard permission denied. You might need to grant permission or click in Obsidian first.');
            } else if (err.message && err.message.includes("document is not focused")) {
                new Notice('Cannot read clipboard: Obsidian window or an input field needs to be focused.');
            } else {
                new Notice('Failed to paste image. See console.');
            }
        }
    }
}

// --- Search Modal Implementation ---
/**
 * @extends {SuggestModal<LoomNodeInfo>}
 */
class LoomSearchModal extends SuggestModal {
    /** @type {Artifacting} */
    plugin;

    /**
     * @param {import('obsidian').App} app
     * @param {Artifacting} plugin
     */
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder('Search loom node text...');
    }

    /**
     * @param {string} query
     * @returns {LoomNodeInfo[]}
     */
    getSuggestions(query) {
        if (!query) {
            return Object.values(this.plugin.index).slice(0, 20); // Show some recent/all nodes if query is empty? Limit for performance.
        }
        return this.plugin.searchIndex(query);
    }

    /**
     * @param {LoomNodeInfo} node
     * @param {HTMLElement} el
     */
    renderSuggestion(node, el) {
        el.createEl('div', { text: node.text.substring(0, 100) + (node.text.length > 100 ? '...' : '') }); // Show first 100 chars
        el.createEl('small', { text: node.documentPath, cls: 'loom-search-result-path' }); // Show document path
    }

    /**
     * @param {LoomNodeInfo} node
     * @param {MouseEvent | KeyboardEvent} evt
     */
    onChooseSuggestion(node, evt) {
        console.log('Chosen suggestion:', node);

        const activeFile = this.app.workspace.getActiveFile();

        // Function to trigger the switch after potential file open
        const triggerSwitch = () => {
            console.log(`Triggering loom:switch-to for node ${node.id}`);
            // Ensure Loomsidian is likely ready for the event in the new file context
            // We trigger the event on the workspace, Loomsidian should be listening
            this.app.workspace.trigger('loom:switch-to', node.id);
            new Notice(`Attempting to switch loom to node: ${node.id.substring(0, 8)}...`);
        };

        if (activeFile && activeFile.path === node.documentPath) {
            // Already in the correct file, just trigger the switch
            triggerSwitch();
        } else {
            // Need to open the correct file first
            const targetFile = this.app.vault.getAbstractFileByPath(node.documentPath);
            if (targetFile instanceof TFile) {
                console.log(`Opening file: ${node.documentPath}`);
                this.app.workspace.getLeaf(false).openFile(targetFile).then(() => {
                    // Add a small delay to allow the file to open and Loomsidian to potentially load its state for the file
                    // This is a bit of a heuristic, might need refinement.
                    // Using requestAnimationFrame might be slightly better than setTimeout
                    requestAnimationFrame(() => {
                        requestAnimationFrame(triggerSwitch); // Double frame delay
                    });
                }).catch(err => {
                    console.error(`Error opening file ${node.documentPath}:`, err);
                    new Notice('Error opening loom document.');
                });
            } else {
                 console.error(`Target file not found or is not a TFile: ${node.documentPath}`);
                 new Notice(`Target file not found: ${node.documentPath}`);
            }
        }
    }
}

module.exports = Artifacting; 