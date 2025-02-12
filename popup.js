// Helper function to show/hide loading overlay
function setLoading(isLoading) {
const loadingOverlay = document.getElementById("loadingOverlay");
loadingOverlay.style.display = isLoading ? "flex" : "none";
}

// Function to show toast messages
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast';

  if (isError) {
      toast.classList.add('error');
  }

  toast.classList.add('show');

  setTimeout(() => {
      toast.classList.remove('show');
  }, 5000);
}


// Function to generate a unique salt
function generateSalt() {
return crypto.getRandomValues(new Uint8Array(16)).toString();
}

// Function to encrypt token
async function encryptToken(token, key) {
  try {
      const encodedToken = new TextEncoder().encode(token);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedData = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv },
          key,
          encodedToken
      );

      const encryptedBytes = new Uint8Array(encryptedData);
      const combinedData = new Uint8Array(iv.length + encryptedBytes.length);
      combinedData.set(iv, 0);
      combinedData.set(encryptedBytes, iv.length);

      const encryptedBase64 = btoa(String.fromCharCode(...combinedData));
      return encryptedBase64;
  } catch (error) {
      console.error("Encryption Error:", error);
      return null;
  }
}

// Fetch repositories from GitHub API
async function fetchRepositories(token) {
const url = "https://api.github.com/user/repos";
const headers = {
    Accept: "application/vnd.github.v3+json",
    Authorization: `token ${token}`,
};
try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Failed to fetch repositories: ${url}\nStatus: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`);
    }
      const data = await response.json();
    return data.map(repo => repo.full_name);
 } catch (error) {
       console.error("Error fetching repositories:", error);
       showToast(`Error: ${error.message}`, true)
       return [];
  }
}


// Populate the repository dropdown
async function populateRepositoryDropdown(token, savedRepo) {
const repoSelect = document.getElementById('repo');
repoSelect.innerHTML = '<option value="">Select a repository</option>';

try {
    const repositories = await fetchRepositories(token);
    repositories.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo;
        option.textContent = repo;
        repoSelect.appendChild(option);

        // Set selected if it matches savedRepo
         if (repo === savedRepo) {
            option.selected = true;
         }
    });
} catch (error) {
    console.error("Error fetching repositories:", error);
    showToast(`Error: ${error.message}`, true);
}
}

// Save settings
document.getElementById('settingsForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;

    if (!repo || !token) {
        showToast("Repository and token are required!", true);
        return;
    }

    try {
        await handleToken(token);
      
        // Save the repository
        chrome.storage.local.set({ repo }, function () {
           if (chrome.runtime.lastError) {
                 console.error("Error saving settings:", chrome.runtime.lastError);
               showToast("Failed to save settings!", true);
            } else {
                console.log("Settings saved successfully:", { repo });
                showToast("Settings saved successfully!");
                updateCurrentSettingsDisplay(repo, token);
            }
        });
    } catch (error) {
        console.error("Error saving settings:", error);
        showToast(`Error: ${error.message}`, true);
    }
});

// Update token handling with storage
async function handleToken(token) {
    setLoading(true);
    try {
      const salt = generateSalt();
      const key = await generateKey(password, salt);
      const encryptedToken = await encryptToken(token, key);
    
      await StorageUtils.cacheKey('github_token', {
        encrypted: encryptedToken,
        salt
      });
    
      showToast('Token saved successfully');
    } catch (error) {
      showToast('Failed to save token', true);
    } finally {
      setLoading(false);
    }
}

// Add cleanup on extension disable
chrome.runtime.onSuspend.addListener(() => {
    chrome.storage.local.clear();
});

// Convert wildcard pattern to regex
function wildcardToRegex(pattern) {
const escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
let regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

if (!pattern.startsWith('*') && !pattern.includes('/')) {
  regexPattern = `(.*\/)?${regexPattern}`;
}

return new RegExp(`^${regexPattern}$`, 'i');
}


// Fetch a file from GitHub using the API
async function fetchFileFromGitHub(path, token, repoPath) {
const url = `https://api.github.com/repos/${repoPath}/contents/${path}`;
const headers = {
  Accept: "application/vnd.github.v3+json",
};

if (token) {
  headers.Authorization = `token ${token}`;
}
try{
      const response = await fetch(url, { headers });
      if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`Failed to fetch file: ${url}\nStatus: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`);
      }
     const data = await response.json();
      return decodeBase64Unicode(data.content);
  } catch (error) {
         console.error("Error fetching file:", error);
         showToast(`Error: ${error.message}`, true);
      return null;
   }
}


// Recursive function to fetch files from a directory
async function fetchFilesFromDirectory(url, configContent, token, repoPath) {
  const headers = {
      Accept: "application/vnd.github.v3+json",
  };

  if (token) {
      headers.Authorization = `token ${token}`;
  }

  try {
      console.log(`Fetching URL: ${url}`);
      const response = await fetch(url, { headers });

      if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`GitHub API error: ${response.status} - ${response.statusText}\nURL: ${url}\nDetails: ${errorDetails}`);
      }
      const data = await response.json();
      let combinedText = "";

      for (const item of data) {
          if (item.type === "file") {
              const isIncluded = configContent.include.some(pattern => wildcardToRegex(pattern).test(item.path));
              const isExcluded = configContent.exclude.some(pattern => wildcardToRegex(pattern).test(item.path));

              if (isIncluded && !isExcluded) {
                  console.log(`Fetching file: ${item.path}`);
                  const fileContent = await fetchFileFromGitHub(item.path, token, repoPath);
                    if (fileContent) {
                      combinedText += `\n\n// ===== File: ${item.path} =====\n${fileContent}\n// ===== End of File: ${item.path} =====\n`;
                     }
              }
          } else if (item.type === "dir") {
              const subDirText = await fetchFilesFromDirectory(item.url, configContent, token, repoPath);
              combinedText += subDirText;
          }
      }

      return combinedText;
  } catch (error) {
       console.error("Error fetching files from directory:", error);
       throw error;
  }
}



// Fetch GitHub project
document.getElementById('fetchButton').addEventListener('click', async function () {
const fetchButton = document.getElementById('fetchButton');
fetchButton.disabled = true;
fetchButton.innerText = "Fetching...";
setLoading(true);

  try {
      const { repo, token, salt } = await new Promise((resolve, reject) => {
          chrome.storage.local.get(['repo', 'token', 'salt'], (data) => {
              if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || "Failed to fetch settings."));
              } else {
                  resolve(data);
              }
          });
      });

      if (!repo || !token || !salt) {
          throw new Error("Repository, token, and salt are required!");
      }
      const password = chrome.runtime.id;
        const generatedKey = await generateKey(password, salt);
        const decryptedToken = await decryptToken(token, password, salt);

        if (!decryptedToken) {
          throw new Error("Failed to decrypt token.");
      }
      const configUrl = `https://api.github.com/repos/${repo}/contents/config.json`;
      const [owner, repoName] = repo.split("/");
      if (!owner || !repoName) {
          throw new Error("Invalid repository name format.");
      }
      const configResponse = await fetch(configUrl, {
          headers: {
              Accept: "application/vnd.github.v3+json",
              Authorization: `token ${decryptedToken}`,
          },
      });

      if (!configResponse.ok) {
          const errorDetails = await configResponse.text();
          throw new Error(`Failed to fetch config file: ${configUrl}\nStatus: ${configResponse.status} - ${configResponse.statusText}\nDetails: ${errorDetails}`);
      }

       const configData = await configResponse.json();
      const decodedContent = decodeBase64Unicode(configData.content)

         if (!decodedContent) {
           throw new Error(`Failed to decode config file content: ${configUrl}`);
      }
      let configContent = null;
      try {
          configContent = JSON.parse(decodedContent);
           console.log("Parsed configContent:", configContent);
      } catch (error) {
           console.error("JSON Parsing Error:", error);
          throw new Error(`Failed to parse config file content: ${configUrl}\n ${error.message}`);
      }
      const combinedText = await fetchFilesFromDirectory(`https://api.github.com/repos/${repo}/contents`, configContent, decryptedToken, repo);

      console.log("Combined Text:", combinedText);
      navigator.clipboard.writeText(combinedText).then(() => {
          showToast("Text copied to clipboard successfully!");
      }).catch((error) => {
          console.error("Clipboard error:", error);
          showToast("Failed to copy text to clipboard!", true);
      });
  } catch (error) {
       console.error("Error fetching GitHub project:", error);
      showToast(`Error: ${error.message}`, true);
  } finally {
       fetchButton.disabled = false;
      fetchButton.innerText = "Fetch Project";
      setLoading(false);
  }
});


// Function to display current settings
async function updateCurrentSettingsDisplay(repo, token) {
const currentSettingsDisplay = document.getElementById('currentSettings');
  if (repo && token) {
      currentSettingsDisplay.textContent = `Current Repo: ${repo}, Token Set`;
  } else {
     currentSettingsDisplay.textContent = "No settings saved.";
}
}


// Load saved settings when the popup opens
chrome.storage.local.get(['repo', 'token', 'salt'], async function (data) {
  if (chrome.runtime.lastError) {
      console.error("Error loading settings:", chrome.runtime.lastError);
      showToast("Failed to load settings!", true);
      return;
  }
let savedRepo = null;
  if (data.repo) {
      savedRepo = data.repo;
  }
if (data.token && data.salt) {
      try{
       const password = chrome.runtime.id;
         const generatedKey = await generateKey(password, data.salt);
         const decryptedToken = await decryptToken(data.token, password, data.salt);
      if(decryptedToken){
           document.getElementById('token').value = decryptedToken;
         populateRepositoryDropdown(decryptedToken, savedRepo);
         updateCurrentSettingsDisplay(data.repo, decryptedToken)
     } else {
         showToast("Failed to decrypt token!", true);
     }
  } catch(error){
          console.error("Error loading settings:", error);
        showToast(`Error: ${error.message}`, true);
     }
} else {
      populateRepositoryDropdown("", savedRepo);
     updateCurrentSettingsDisplay("", "")
}
});

// Populate repositories when the token input changes
document.getElementById('token').addEventListener('input', function (e) {
  const token = e.target.value;
  const repoSelect = document.getElementById('repo');
  const savedRepo = repoSelect.value;
  if (token) {
      populateRepositoryDropdown(token, savedRepo);
  }
});

// Clear token and repository on extension uninstall
chrome.runtime.onInstalled.addListener((details) => {
if (details.reason === "uninstall") {
    chrome.storage.local.remove(['repo', 'token', 'salt'], function () {
        console.log("Token, salt, and repository cleared on uninstall.");
    });
}
});