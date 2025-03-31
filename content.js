// content.js
(function() {
  console.log("Claude Artifact Downloader content script loaded!");
  
  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Content script received message:", request.action);
    
    if (request.action === "scanArtifacts") {
      const artifacts = scanPageForArtifacts();
      console.log("Found artifacts:", artifacts.length);
      sendResponse({artifacts: artifacts});
    }
    else if (request.action === "downloadArtifact") {
      downloadArtifact(request.artifact);
      sendResponse({success: true});
    }
    else if (request.action === "downloadAllArtifacts") {
      const count = downloadAllArtifacts(request.artifacts);
      sendResponse({count: count});
    }
    else if (request.action === "downloadAsZip") {
      downloadAsZip(request.artifacts)
        .then(() => {
          sendResponse({success: true});
        })
        .catch(error => {
          console.error("Error creating ZIP:", error);
          sendResponse({success: false, error: error.message});
        });
      return true; // Keep the message channel open for async response
    }
    
    return true; // Keep the message channel open for async response
  });
  
  function scanPageForArtifacts() {
    const foundArtifacts = [];
    console.log("Scanning for artifacts...");
    
    // PRIORITY 1: Look for Claude's multi-file code blocks first
    // These are often in <pre><div><div class="prismjs"><code>
    // const codeBlocks = [document.querySelectorAll('pre:last-of-type code')];
	// All code elements in pre tags
	const codeElements = document.querySelectorAll('pre code');
	// Get the last one
	const codeBlocks = [codeElements[codeElements.length - 1]];
	
    console.log(`Found ${codeBlocks.length} pre>code elements`);
    
    let foundMultiFileBlocks = false;
    
    // Process each pre>code block first looking for # FILE: markers
    codeBlocks.forEach((codeElement, index) => {
      if (!codeElement) return;
      
      const content = codeElement.textContent;
      if (!content || content.trim().length === 0) return;
      
      // Check if content contains multiple files with "# FILE:" markers
      const multipleFiles = extractMultipleFiles(content);
      
      if (multipleFiles.length > 0) {
        foundMultiFileBlocks = true;
        console.log(`Found code block with ${multipleFiles.length} files`);
        
        // Add each file as a separate artifact
        multipleFiles.forEach((fileInfo) => {
          foundArtifacts.push({
            id: `code-file-${index}-${foundArtifacts.length}`,
            title: fileInfo.path,
            type: 'application/vnd.ant.code',
            content: fileInfo.content,
            language: determineLanguageFromPath(fileInfo.path),
            filepath: fileInfo.path
          });
        });
      }
    });
    
    // If we found multi-file blocks, return them directly (priority handling)
    if (foundMultiFileBlocks) {
      return foundArtifacts;
    }
    
    // PRIORITY 2: Look for artifact-block-cell elements (collapsed artifacts)
    const artifactBlockCells = document.querySelectorAll('.artifact-block-cell');
    console.log(`Found ${artifactBlockCells.length} artifact-block-cell elements`);
    
    // Process artifact block cells
    artifactBlockCells.forEach((cell, index) => {
      // Get the title/filename
      const titleElement = cell.querySelector('.leading-tight');
      const typeElement = cell.querySelector('.text-text-300');
      const contentElement = cell.querySelector('.absolute.inset-0');
      
      if (!contentElement) return;
      
      let title = titleElement ? titleElement.textContent.trim() : `Artifact ${index + 1}`;
      let typeLabel = typeElement ? typeElement.textContent.trim() : '';
      let content = contentElement.textContent;
      
      // Determine type and language
      let type = 'text/plain';
      let language = 'text';
      
      if (typeLabel.includes('Code') || 
          cell.querySelector('.font-mono') || 
          title.includes('.py') || 
          title.includes('.js') || 
          title.includes('.html') || 
          title.includes('.css')) {
        type = 'application/vnd.ant.code';
        
        // Try to determine language from filename
        if (title.endsWith('.py')) {
          language = 'python';
        } else if (title.endsWith('.js')) {
          language = 'javascript';
        } else if (title.endsWith('.html')) {
          language = 'html';
        } else if (title.endsWith('.css')) {
          language = 'css';
        } else if (title.endsWith('.ts')) {
          language = 'typescript';
        } else if (title.endsWith('.java')) {
          language = 'java';
        } else if (title.endsWith('.c') || title.endsWith('.cpp') || title.endsWith('.h')) {
          language = 'cpp';
        } else if (title.endsWith('.sh')) {
          language = 'bash';
        } else if (title.endsWith('.json')) {
          language = 'json';
        } else if (title.endsWith('.md')) {
          language = 'markdown';
        } else if (title.endsWith('.sql')) {
          language = 'sql';
        }
      } else if (typeLabel.includes('SVG') || title.endsWith('.svg')) {
        type = 'image/svg+xml';
      } else if (typeLabel.includes('Mermaid') || title.endsWith('.mmd')) {
        type = 'application/vnd.ant.mermaid';
      } else if (typeLabel.includes('Markdown') || title.endsWith('.md')) {
        type = 'text/markdown';
      }
      
      if (content && content.trim().length > 0) {
        console.log(`Found artifact block cell: ${title} (${content.length} bytes)`);
        
        // Check if content contains multiple files with "# FILE:" markers
        const multipleFiles = extractMultipleFiles(content);
        
        if (multipleFiles.length > 1) {
          // Add each file as a separate artifact
          multipleFiles.forEach((fileInfo) => {
            foundArtifacts.push({
              id: `artifact-block-file-${index}-${foundArtifacts.length}`,
              title: fileInfo.path,
              type: 'application/vnd.ant.code',
              content: fileInfo.content,
              language: determineLanguageFromPath(fileInfo.path),
              filepath: fileInfo.path
            });
          });
        } else {
          // Add as a single artifact
          foundArtifacts.push({
            id: `artifact-block-${index}`,
            title: title,
            type: type,
            content: content,
            language: language
          });
        }
      }
    });
    
    // If we already found artifacts, return them
    if (foundArtifacts.length > 0) {
      return foundArtifacts;
    }
    
    // PRIORITY 3: Look for other code blocks and spans
    
    // Based on the provided HTML structure, target code blocks precisely
    const codeElementSelectors = [
      '.code-block__code', 
      '[class*="code-block"]',
      '.prismjs code',
      'div.prismjs code'
    ];
    
    // Join all selectors with commas
    const combinedSelector = codeElementSelectors.join(', ');
    const specificCodeBlocks = document.querySelectorAll(combinedSelector);
    console.log(`Found ${specificCodeBlocks.length} specific code blocks`);
    
    // Process each code block
    specificCodeBlocks.forEach((codeBlock, index) => {
      // Find the actual code element
      const codeElement = codeBlock.tagName === 'CODE' ? codeBlock : codeBlock.querySelector('code');
      if (!codeElement) return;
      
      // Get language from class
      let language = 'text';
      const langClass = Array.from(codeElement.classList || []).find(cls => cls.startsWith('language-'));
      if (langClass) {
        language = langClass.replace('language-', '');
      }
      
      // Generate a title based on language
      let title = `${language.charAt(0).toUpperCase() + language.slice(1)} Code`;
      
      // Get the full content
      const content = codeElement.textContent;
      
      if (content && content.trim().length > 0) {
        console.log(`Found code artifact: ${title} (${content.length} bytes)`);
        
        // Check if content contains multiple files with "# FILE:" markers
        const multipleFiles = extractMultipleFiles(content);
        
        if (multipleFiles.length > 1) {
          // Add each file as a separate artifact
          multipleFiles.forEach((fileInfo) => {
            foundArtifacts.push({
              id: `code-file-${index}-${foundArtifacts.length}`,
              title: fileInfo.path,
              type: 'application/vnd.ant.code',
              content: fileInfo.content,
              language: determineLanguageFromPath(fileInfo.path),
              filepath: fileInfo.path
            });
          });
        } else {
          // Add as a single artifact
          foundArtifacts.push({
            id: `code-${index}`,
            title: title,
            type: 'application/vnd.ant.code',
            content: content,
            language: language
          });
        }
      }
    });
    
    // Look for SVG artifacts
    const svgElements = document.querySelectorAll('svg');
    svgElements.forEach((svg, index) => {
      const title = `SVG Image ${index + 1}`;
      const content = svg.outerHTML;
      
      if (content) {
        console.log(`Found SVG artifact: ${title}`);
        foundArtifacts.push({
          id: `svg-${index}`,
          title: title,
          type: 'image/svg+xml',
          content: content
        });
      }
    });
    
    // Look for expanded/open artifact cells
    const expandedArtifacts = document.querySelectorAll('.artifact-container, [data-testid="artifact-wrapper"]');
    console.log(`Found ${expandedArtifacts.length} expanded artifact containers`);
    
    expandedArtifacts.forEach((artifact, index) => {
      // Try to find the title and content elements
      const titleElement = artifact.querySelector('[class*="title"], [data-testid="artifact-title"]');
      const contentElement = artifact.querySelector('[class*="content"], [data-testid="artifact-content"], pre, code');
      
      if (!contentElement) return;
      
      let title = titleElement ? titleElement.textContent.trim() : `Expanded Artifact ${index + 1}`;
      let content = contentElement.textContent;
      
      // For code blocks, try to get the language
      let type = 'text/plain';
      let language = 'text';
      
      const codeElement = contentElement.tagName === 'CODE' ? contentElement : contentElement.querySelector('code');
      if (codeElement) {
        type = 'application/vnd.ant.code';
        
        // Try to get language from class
        const langClass = Array.from(codeElement.classList || []).find(cls => cls.startsWith('language-'));
        if (langClass) {
          language = langClass.replace('language-', '');
        }
      } else if (artifact.querySelector('svg')) {
        type = 'image/svg+xml';
        // For SVGs, we need the outerHTML
        content = artifact.querySelector('svg').outerHTML;
      }
      
      if (content && content.trim().length > 0) {
        console.log(`Found expanded artifact: ${title} (${content.length} bytes)`);
        
        // Check if content contains multiple files with "# FILE:" markers
        const multipleFiles = extractMultipleFiles(content);
        
        if (multipleFiles.length > 1) {
          // Add each file as a separate artifact
          multipleFiles.forEach((fileInfo) => {
            foundArtifacts.push({
              id: `expanded-file-${index}-${foundArtifacts.length}`,
              title: fileInfo.path,
              type: 'application/vnd.ant.code',
              content: fileInfo.content,
              language: determineLanguageFromPath(fileInfo.path),
              filepath: fileInfo.path
            });
          });
        } else {
          // Add as a single artifact
          foundArtifacts.push({
            id: `expanded-artifact-${index}`,
            title: title,
            type: type,
            content: content,
            language: language
          });
        }
      }
    });
    
    // If no artifacts found with direct methods, use a more generic approach
    if (foundArtifacts.length === 0) {
      console.log("No artifacts found with direct selectors, trying broader approach");
      
      // Target all pre and code elements
      const preElements = document.querySelectorAll('pre');
      const codeElements = document.querySelectorAll('code');
      
      console.log(`Found ${preElements.length} pre elements and ${codeElements.length} code elements`);
      
      // Process pre elements first to prioritize potential multi-file blocks
      preElements.forEach((element, index) => {
        const codeChild = element.querySelector('code');
        let language = 'text';
        let title = 'Code Snippet';
        let content = '';
        
        if (codeChild) {
          const langClass = Array.from(codeChild.classList || []).find(cls => cls.startsWith('language-'));
          if (langClass) {
            language = langClass.replace('language-', '');
            title = `${language.charAt(0).toUpperCase() + language.slice(1)} Code`;
          }
          content = codeChild.textContent;
        } else {
          content = element.textContent;
        }
        
        if (content && content.trim().length > 5) {
          console.log(`Found pre element: ${title} (${content.length} bytes)`);
          
          // Check if content contains multiple files with "# FILE:" markers
          const multipleFiles = extractMultipleFiles(content);
          
          if (multipleFiles.length > 1) {
            // Add each file as a separate artifact
            multipleFiles.forEach((fileInfo) => {
              foundArtifacts.push({
                id: `pre-file-${index}-${foundArtifacts.length}`,
                title: fileInfo.path,
                type: 'application/vnd.ant.code',
                content: fileInfo.content,
                language: determineLanguageFromPath(fileInfo.path),
                filepath: fileInfo.path
              });
            });
          } else {
            // Add as a single artifact
            foundArtifacts.push({
              id: `pre-${index}`,
              title: title,
              type: 'application/vnd.ant.code',
              content: content,
              language: language
            });
          }
        }
      });
      
      // Process code elements that aren't already in pre elements
      if (foundArtifacts.length === 0) {
        codeElements.forEach((element, index) => {
          // Skip if this element is already inside a pre (avoid duplication)
          if (element.closest('pre')) return;
          
          let language = 'text';
          const langClass = Array.from(element.classList || []).find(cls => cls.startsWith('language-'));
          if (langClass) {
            language = langClass.replace('language-', '');
          }
          
          const title = `${language.charAt(0).toUpperCase() + language.slice(1)} Code`;
          const content = element.textContent;
          
          if (content && content.trim().length > 5) {
            console.log(`Found code element: ${title} (${content.length} bytes)`);
            
            // Check if content contains multiple files with "# FILE:" markers
            const multipleFiles = extractMultipleFiles(content);
            
            if (multipleFiles.length > 1) {
              // Add each file as a separate artifact
              multipleFiles.forEach((fileInfo) => {
                foundArtifacts.push({
                  id: `code-elem-file-${index}-${foundArtifacts.length}`,
                  title: fileInfo.path,
                  type: 'application/vnd.ant.code',
                  content: fileInfo.content,
                  language: determineLanguageFromPath(fileInfo.path),
                  filepath: fileInfo.path
                });
              });
            } else {
              // Add as a single artifact
              foundArtifacts.push({
                id: `code-elem-${index}`,
                title: title,
                type: 'application/vnd.ant.code',
                content: content,
                language: language
              });
            }
          }
        });
      }
    }
    
    return foundArtifacts;
  }
  
  // Extract multiple files from content with "# FILE:" markers
  function extractMultipleFiles(content) {
    const fileMarkerRegex = /^(?:\/\/|#)\s*FILE:\s*([^\n]+)/gm;
    const matches = Array.from(content.matchAll(fileMarkerRegex));
    
    if (matches.length <= 0) {
      return [];
    }
    
    const files = [];
    
    // Collect the indices of all file markers
    const fileIndices = matches.map(match => ({
      index: match.index,
      path: match[1].trim()
    }));
    
    // Extract content for each file
    for (let i = 0; i < fileIndices.length; i++) {
      const startIndex = fileIndices[i].index;
      const endIndex = (i < fileIndices.length - 1) ? fileIndices[i + 1].index : content.length;
      
      // Get the content for this file
      let fileContent = content.substring(startIndex, endIndex).trim();
      
      // Remove the FILE: marker line from the content
      const markerLineEndIndex = fileContent.indexOf('\n');
      if (markerLineEndIndex !== -1) {
        fileContent = fileContent.substring(markerLineEndIndex + 1);
      }
      
      files.push({
        path: fileIndices[i].path,
        content: fileContent
      });
    }
    
    return files;
  }
  
  // Determine language from file path
  function determineLanguageFromPath(path) {
    const extension = path.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'py':
        return 'python';
      case 'js':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'java':
        return 'java';
      case 'c':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'h':
      case 'hpp':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'sh':
        return 'bash';
      case 'sql':
        return 'sql';
      case 'rb':
        return 'ruby';
      case 'go':
        return 'go';
      case 'php':
        return 'php';
      case 'rs':
        return 'rust';
      case 'xml':
        return 'xml';
      default:
        return 'text';
    }
  }
  
  function downloadArtifact(artifact) {
    // Check if artifact has a filepath property (from FILE: markers)
    let filename;
    let filepath = artifact.filepath || null;
    
    if (filepath) {
      // Use the filepath as is
      filename = filepath;
    } else {
      // Generate a better filename based on title and type
      if (artifact.type === 'application/vnd.ant.code' && artifact.language) {
        filename = `${artifact.language}_code`;
      } else if (artifact.title.match(/^Artifact \d+$/)) {
        // Generate name based on type
        if (artifact.type === 'application/vnd.ant.code') {
          filename = 'code_snippet';
        } else if (artifact.type === 'image/svg+xml') {
          filename = 'svg_image';
        } else if (artifact.type === 'application/vnd.ant.mermaid') {
          filename = 'mermaid_diagram';
        } else if (artifact.type === 'text/markdown') {
          filename = 'markdown_document';
        } else {
          filename = 'claude_artifact';
        }
      } else {
        // Use the title but sanitize it
        filename = sanitizeFilename(artifact.title);
      }
      
      // Add timestamp to make the filename unique
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `${filename}_${timestamp}`;
      
      // Add appropriate extension if needed
      if (!filename.includes('.')) {
        let extension = getExtensionForType(artifact.type);
        // Use language-specific extension if available
        if (artifact.type === 'application/vnd.ant.code' && artifact.language) {
          extension = getExtensionForLanguage(artifact.language);
        }
        filename = `${filename}.${extension}`;
      }
    }
    
    let content = artifact.content;
    
    console.log(`Downloading artifact: ${filename} (${content.length} bytes)`);
    
    // Create a blob with the content and appropriate type
    let mimeType = 'text/plain';
    if (artifact.type === 'image/svg+xml') {
      mimeType = 'image/svg+xml';
    } else if (artifact.type === 'text/markdown') {
      mimeType = 'text/markdown';
    } else if (artifact.type === 'text/html') {
      mimeType = 'text/html';
    }
    
    const blob = new Blob([content], {type: mimeType});
    const url = URL.createObjectURL(blob);
    
    // Use the appropriate download method
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      // Chrome/Firefox extension API
      chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: false
      });
    } else {
      // Fallback method using a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the object URL
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    }
  }
  
  function downloadAllArtifacts(artifactsToDownload) {
    let count = 0;
    
    artifactsToDownload.forEach(artifact => {
      downloadArtifact(artifact);
      count++;
    });
    
    return count;
  }
  
  async function downloadAsZip(artifactsToDownload) {
    if (!artifactsToDownload || artifactsToDownload.length === 0) {
      throw new Error("No artifacts to download");
    }
    
    // Create a new JSZip instance
    const zip = new JSZip();
    
    // Add artifacts to zip
    artifactsToDownload.forEach(artifact => {
      let filepath;
      let content = artifact.content;
      
      // Use filepath if available, otherwise generate a name
      if (artifact.filepath) {
        filepath = artifact.filepath;
      } else {
        // Generate a suitable filename based on the artifact details
        let filename;
        if (artifact.title && !artifact.title.match(/^Artifact \d+$/)) {
          filename = sanitizeFilename(artifact.title);
        } else if (artifact.type === 'application/vnd.ant.code' && artifact.language) {
          filename = `${artifact.language}_code`;
        } else {
          filename = getDefaultFilename(artifact.type);
        }
        
        // Add extension if needed
        if (!filename.includes('.')) {
          let extension = getExtensionForType(artifact.type);
          if (artifact.type === 'application/vnd.ant.code' && artifact.language) {
            extension = getExtensionForLanguage(artifact.language);
          }
          filename = `${filename}.${extension}`;
        }
        
        filepath = filename;
      }
      
      // Add the file to the zip
      zip.file(filepath, content);
      console.log(`Added to ZIP: ${filepath} (${content.length} bytes)`);
    });
    
    // Generate zip file
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipFilename = `claude_artifacts_${timestamp}.zip`;
    
    // Download the zip file
    const url = URL.createObjectURL(zipBlob);
    
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      // Chrome/Firefox extension API
      chrome.downloads.download({
        url: url,
        filename: zipFilename,
        saveAs: false
      });
    } else {
      // Fallback method using a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = zipFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    
    // Clean up the object URL
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  }
  
  function getDefaultFilename(type) {
    switch (type) {
      case 'application/vnd.ant.code':
        return 'code_snippet';
      case 'image/svg+xml':
        return 'svg_image';
      case 'application/vnd.ant.mermaid':
        return 'mermaid_diagram';
      case 'text/markdown':
        return 'markdown_document';
      case 'text/html':
        return 'html_document';
      default:
        return 'claude_artifact';
    }
  }
  
  function sanitizeFilename(name) {
    // Replace invalid filename characters with underscores
    return name.replace(/[/\\?%*:|"<>]/g, '_');
  }
  
  function getExtensionForType(type) {
    switch (type) {
      case 'application/vnd.ant.code':
        return 'txt';
      case 'image/svg+xml':
        return 'svg';
      case 'application/vnd.ant.mermaid':
        return 'mmd';
      case 'text/markdown':
        return 'md';
      case 'text/html':
        return 'html';
      default:
        return 'txt';
    }
  }
  
  function getExtensionForLanguage(language) {
    // Return appropriate file extension based on programming language
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return 'js';
      case 'python':
      case 'py':
        return 'py';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'typescript':
      case 'ts':
        return 'ts';
      case 'java':
        return 'java';
      case 'csharp':
      case 'c#':
        return 'cs';
      case 'c':
        return 'c';
      case 'cpp':
      case 'c++':
        return 'cpp';
      case 'php':
        return 'php';
      case 'ruby':
        return 'rb';
      case 'go':
        return 'go';
      case 'rust':
        return 'rs';
      case 'json':
        return 'json';
      case 'xml':
        return 'xml';
      case 'markdown':
      case 'md':
        return 'md';
      case 'bash':
      case 'shell':
        return 'sh';
      case 'sql':
        return 'sql';
      default:
        return 'txt';
    }
  }
})();