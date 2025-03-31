// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const scanButton = document.getElementById('scan-button');
  const downloadAllButton = document.getElementById('download-all');
  const downloadZipButton = document.getElementById('download-zip');
  const artifactsList = document.getElementById('artifact-list');
  const artifactsContainer = document.getElementById('artifacts-container');
  const statusDiv = document.getElementById('status');
  
  let artifacts = [];
  
  // Use the appropriate API (browser for Firefox, chrome for Chrome)
  const api = typeof browser !== 'undefined' ? browser : chrome;
  
  scanButton.addEventListener('click', function() {
    statusDiv.textContent = 'Scanning page for artifacts...';
    artifactsList.style.display = 'none';
    
    api.tabs.query({active: true, currentWindow: true}, function(tabs) {
      api.tabs.sendMessage(
        tabs[0].id, 
        {action: "scanArtifacts"},
        function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
          }
          
          if (response && response.artifacts) {
            artifacts = response.artifacts;
            
            if (artifacts.length > 0) {
              // Group artifacts by directory path
              const groupedArtifacts = groupArtifactsByPath(artifacts);
              statusDiv.textContent = `Found ${artifacts.length} artifact(s).`;
              artifactsList.style.display = 'block';
              renderArtifactsList(groupedArtifacts);
            } else {
              statusDiv.textContent = 'No artifacts found on this page.';
              artifactsList.style.display = 'none';
            }
          } else {
            statusDiv.textContent = 'No response from content script. Try refreshing the page.';
          }
        }
      );
    });
  });
  
  downloadAllButton.addEventListener('click', function() {
    if (artifacts.length === 0) {
      statusDiv.textContent = 'No artifacts to download. Scan first.';
      return;
    }
    
    api.tabs.query({active: true, currentWindow: true}, function(tabs) {
      api.tabs.sendMessage(
        tabs[0].id, 
        {action: "downloadAllArtifacts", artifacts: artifacts},
        function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
          }
          
          if (response && response.count) {
            statusDiv.textContent = `Downloaded ${response.count} artifact(s).`;
          } else {
            statusDiv.textContent = 'Error downloading artifacts.';
          }
        }
      );
    });
  });
  
  downloadZipButton.addEventListener('click', function() {
    if (artifacts.length === 0) {
      statusDiv.textContent = 'No artifacts to download. Scan first.';
      return;
    }
    
    api.tabs.query({active: true, currentWindow: true}, function(tabs) {
      api.tabs.sendMessage(
        tabs[0].id, 
        {action: "downloadAsZip", artifacts: artifacts},
        function(response) {
          if (chrome.runtime.lastError) {
            statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
          }
          
          if (response && response.success) {
            statusDiv.textContent = `Downloaded all artifacts as ZIP.`;
          } else {
            statusDiv.textContent = 'Error creating ZIP archive.';
          }
        }
      );
    });
  });
  
  function groupArtifactsByPath(artifacts) {
    const groups = {};
    
    artifacts.forEach(artifact => {
      if (artifact.filepath) {
        // Split the path into directories
        const pathParts = artifact.filepath.split('/');
        const fileName = pathParts.pop(); // Remove the filename from the path
        const dirPath = pathParts.join('/');
        
        // Initialize the group if it doesn't exist
        if (!groups[dirPath]) {
          groups[dirPath] = [];
        }
        
        // Add the artifact to its directory group
        groups[dirPath].push(artifact);
      } else {
        // For artifacts without a filepath, put them in a root group
        if (!groups['']) {
          groups[''] = [];
        }
        groups[''].push(artifact);
      }
    });
    
    return groups;
  }
  
  function renderArtifactsList(groupedArtifacts) {
    artifactsContainer.innerHTML = '';
    
    // Sort the directory paths
    const sortedPaths = Object.keys(groupedArtifacts).sort();
    
    sortedPaths.forEach(dirPath => {
      // Create a directory header if we have a path
      if (dirPath) {
        const dirHeader = document.createElement('div');
        dirHeader.className = 'directory-header';
        dirHeader.style.fontWeight = 'bold';
        dirHeader.style.padding = '8px';
        dirHeader.style.backgroundColor = '#f5f5f5';
        dirHeader.style.marginTop = '5px';
        dirHeader.style.borderRadius = '4px';
        dirHeader.textContent = dirPath + '/';
        artifactsContainer.appendChild(dirHeader);
      }
      
      // Create artifact items for this directory
      groupedArtifacts[dirPath].forEach(artifact => {
        // Create more readable type labels
        let typeLabel;
        switch (artifact.type) {
          case 'application/vnd.ant.code':
            typeLabel = 'Code';
            break;
          case 'image/svg+xml':
            typeLabel = 'SVG';
            break;
          case 'application/vnd.ant.mermaid':
            typeLabel = 'Mermaid';
            break;
          case 'text/markdown':
            typeLabel = 'Markdown';
            break;
          case 'text/html':
            typeLabel = 'HTML';
            break;
          default:
            typeLabel = 'Text';
        }
        
        // Display either the filepath or the title
        const displayName = artifact.filepath ? 
          (artifact.filepath.split('/').pop()) : artifact.title;
        
        const artifactItem = document.createElement('div');
        artifactItem.className = 'artifact-item';
        artifactItem.style.paddingLeft = dirPath ? '20px' : '8px'; // Indent if in a directory
        artifactItem.textContent = `${displayName} (${typeLabel})`;
        
        artifactItem.addEventListener('click', function() {
          api.tabs.query({active: true, currentWindow: true}, function(tabs) {
            api.tabs.sendMessage(
              tabs[0].id, 
              {action: "downloadArtifact", artifact: artifact},
              function(response) {
                if (chrome.runtime.lastError) {
                  statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                  return;
                }
                
                statusDiv.textContent = `Downloaded ${displayName}.`;
              }
            );
          });
        });
        
        artifactsContainer.appendChild(artifactItem);
      });
    });
  }
});