// تابع نمایش toast
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
  }, 5000); // Increase timeout to 5 seconds for better readability
}

// Function to decode Base64 while preserving Unicode characters
function decodeBase64Unicode(base64) {
  try {
      const binaryString = atob(base64); // Decode Base64 to binary string
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      const decodedString = new TextDecoder('utf-8').decode(bytes); // Decode bytes to UTF-8 string
      return decodedString;
  } catch (error) {
      console.error("Base64 Decoding Error:", error);
      return null;
  }
}


// Function to generate a secret key from password
async function generateKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
      {
          name: "PBKDF2",
          salt: encoder.encode(salt),
          iterations: 100000,
          hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
  );
  return derivedKey;
}

// Function to encrypt token
async function encryptToken(token, key) {
  try {
  const encodedToken = new TextEncoder().encode(token);
      const iv = crypto.getRandomValues(new Uint8Array(12)); // Generate a random IV (Initialization Vector)

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

// Function to decrypt token
async function decryptToken(encryptedToken, key) {
  try {
      const combinedData = new Uint8Array(atob(encryptedToken).split('').map(char => char.charCodeAt(0)));
      const iv = combinedData.slice(0, 12);
      const encryptedBytes = combinedData.slice(12);

      const decryptedData = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: iv },
          key,
          encryptedBytes
      );

      const decryptedText = new TextDecoder().decode(decryptedData);
      return decryptedText;

  } catch (error) {
      console.error("Decryption Error:", error);
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

  const response = await fetch(url, { headers });

  if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to fetch repositories: ${url}\nStatus: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`);
  }

  const data = await response.json();
  return data.map(repo => repo.full_name); // Return repository full names (e.g., "username/repo")
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
  const encryptionKey = "your-secure-encryption-key"; // Use a secure key for encryption
  const salt = "your-salt";

  if (!repo || !token) {
      showToast("Repository and token are required!", true);
      return;
  }
   const generatedKey = await generateKey(encryptionKey,salt);
  // Encrypt the token before saving
  const encryptedToken = await encryptToken(token, generatedKey);
  if (!encryptedToken) {
      showToast("Failed to encrypt token!", true)
      return;
  }

  // Save the repository and encrypted token
  chrome.storage.local.set({ repo, token: encryptedToken}, function () {
      if (chrome.runtime.lastError) {
          console.error("Error saving settings:", chrome.runtime.lastError);
          showToast("Failed to save settings!", true);
      } else {
          console.log("Settings saved successfully:", { repo, token: encryptedToken });
          showToast("Settings saved successfully!");
      }
  });
});


// Convert wildcard pattern to regex
function wildcardToRegex(pattern) {
  // Escape special regex characters except '*' and '?'
  const escapedPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // Replace '*' with '.*' and '?' with '.'
  let regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

  // If the pattern does not start with '*' and does not contain '/', treat it as a file name match at any directory level
  if (!pattern.startsWith('*') && !pattern.includes('/')) {
    regexPattern = `(.*\/)?${regexPattern}`; // Match at any directory level or root
  }

  return new RegExp(`^${regexPattern}$`, 'i'); // Case-insensitive matching
}

// Function to decode Base64 while preserving Unicode characters
function decodeBase64Unicode(base64) {
  const binaryString = atob(base64); // Decode Base64 to binary string
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decodedString = new TextDecoder('utf-8').decode(bytes); // Decode bytes to UTF-8 string
  return decodedString;
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

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorDetails = await response.text(); // Get the response body for more details
    throw new Error(`Failed to fetch file: ${url}\nStatus: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`);
  }

  const data = await response.json();
  return decodeBase64Unicode(data.content); // Use custom function to decode Base64
}

// Recursive function to fetch files from a directory
async function fetchFilesFromDirectory(url, configContent, token, repoPath) {
  const headers = {
    Accept: "application/vnd.github.v3+json",
  };

  // Add authorization header if a token is provided
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    console.log(`Fetching URL: ${url}`); // Log the URL being fetched
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorDetails = await response.text(); // Get the response body for more details
      throw new Error(`GitHub API error: ${response.status} - ${response.statusText}\nURL: ${url}\nDetails: ${errorDetails}`);
    }

    const data = await response.json();
    let combinedText = "";

    for (const item of data) {
      if (item.type === "file") {
        // Check if the file matches the include/exclude patterns
        const isIncluded = configContent.include.some(pattern => wildcardToRegex(pattern).test(item.path));
        const isExcluded = configContent.exclude.some(pattern => wildcardToRegex(pattern).test(item.path));

        if (isIncluded && !isExcluded) {
          console.log(`Fetching file: ${item.path}`); // Log the file path being fetched
          const fileContent = await fetchFileFromGitHub(item.path, token, repoPath);
          combinedText += `\n\n// ===== File: ${item.path} =====\n${fileContent}\n// ===== End of File: ${item.path} =====\n`;
        }
      } else if (item.type === "dir") {
        // Recursively fetch files from the subdirectory
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

  try {
      // Fetch the selected repository and token
      const { repo, token } = await new Promise((resolve, reject) => {
          chrome.storage.local.get(['repo', 'token'], (data) => {
              if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || "Failed to fetch settings."));
              } else {
                  resolve(data);
              }
          });
      });

      if (!repo || !token) {
          throw new Error("Repository and token are required!");
      }

        const encryptionKey = "your-secure-encryption-key"; // Use a secure key for encryption
      const salt = "your-salt";

       const generatedKey = await generateKey(encryptionKey,salt);

      const decryptedToken = await decryptToken(token, generatedKey);

       if (!decryptedToken) {
          throw new Error("Failed to decrypt token.");
      }
      // Fetch the config.json file from the repository
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


      // Fetch all files recursively
      const combinedText = await fetchFilesFromDirectory(`https://api.github.com/repos/${repo}/contents`, configContent, decryptedToken, repo);

     console.log("Combined Text:", combinedText);
      // Copy the combined text to the clipboard
      navigator.clipboard.writeText(combinedText).then(() => {
          showToast("Text copied to clipboard successfully!");
      }).catch((error) => {
          console.error("Clipboard error:", error);
          showToast("Failed to copy text to clipboard!", true);
      });

  } catch (error) {
      console.error("Error fetching GitHub project:", error);
      showToast(`Error: ${error.message}`, true); // Show detailed error message in toast
  } finally {
      fetchButton.disabled = false;
      fetchButton.innerText = "Fetch Project";
  }
});

// Load saved settings when the popup opens
chrome.storage.local.get(['repo', 'token'], async function (data) {
  if (chrome.runtime.lastError) {
      console.error("Error loading settings:", chrome.runtime.lastError);
      showToast("Failed to load settings!", true);
      return;
  }

  let savedRepo = null;
  if (data.repo) {
    savedRepo = data.repo;
  }
  if (data.token) {
       const encryptionKey = "your-secure-encryption-key"; // Use a secure key for encryption
      const salt = "your-salt";

        const generatedKey = await generateKey(encryptionKey,salt);
      const decryptedToken = await decryptToken(data.token, generatedKey);

        if (decryptedToken) {
          document.getElementById('token').value = decryptedToken;
          // Populate the repository dropdown when the token is available
          populateRepositoryDropdown(decryptedToken, savedRepo);
        } else {
          showToast("Failed to decrypt token!", true);
        }
  }else {
        populateRepositoryDropdown("", savedRepo);
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
      chrome.storage.local.remove(['repo', 'token'], function () {
          console.log("Token and repository cleared on uninstall.");
      });
  }
});