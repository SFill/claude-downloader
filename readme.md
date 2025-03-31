# Claude Artifact Downloader - Installation Guide

This extension allows you to easily download code artifacts and file structures from Claude AI chats. The updated version now supports downloading files as a ZIP archive.

## How to Install

1. Download JSZip library:
   - Go to https://stuk.github.io/jszip/
   - Download the latest version of JSZip (jszip.min.js)
   - Save this file to your extension directory

2. Replace existing files with updated versions:
   - Replace `manifest.json` with the updated version
   - Replace `popup.html` with the updated version
   - Replace `popup.js` with the updated version
   - Replace `content.js` with the updated version

3. Load the extension:
   
   **For Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top-right corner)
   - Click "Load unpacked" and select your extension directory

   **For Firefox:**
   - Open Firefox and go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file in your extension directory (e.g., manifest.json)

## How to Use

1. Navigate to Claude AI (claude.ai)
2. Ask Claude to generate code with file structure (using "# FILE:" markers)
3. Click the extension icon to open the popup
4. Click "Scan for Artifacts" to detect files
5. Use "Download Files" to download each file individually
6. Use "Download as ZIP" to download all files as a single ZIP archive with the correct file structure

## Features

- Detects multi-file code blocks with "# FILE:" markers
- Preserves directory structure in the ZIP file
- Automatically detects file types and assigns appropriate extensions
- Shows file structure in the UI before downloading
- Works with both collapsed and expanded artifacts

## Troubleshooting

If you encounter any issues:
1. Check the browser console for error messages
2. Make sure all files are properly updated
3. Ensure JSZip is correctly loaded