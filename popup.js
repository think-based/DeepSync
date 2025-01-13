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

// Save settings
document.getElementById('settingsForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const repo = document.getElementById('repo').value;
  const token = document.getElementById('token').value;

  chrome.storage.local.set({ repo, token }, function () {
    showToast("Settings saved successfully!");
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
  return atob(data.content); // Decode the base64-encoded content
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
document.getElementById('githubForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const fetchButton = document.getElementById('fetchButton');
  fetchButton.disabled = true;
  fetchButton.innerText = "Fetching...";

  const repoUrl = document.getElementById('repoUrl').value;

  // Extract repoPath from the URL (e.g., "https://github.com/username/repo" -> "username/repo")
  let repoPath = repoUrl.replace("https://github.com/", "").replace(/\/$/, ""); // Remove trailing slash
  if (repoPath.includes("/tree/") || repoPath.includes("/blob/")) {
    // Handle URLs with branch or file paths
    repoPath = repoPath.split("/").slice(0, 2).join("/");
  }

  console.log("Extracted repoPath:", repoPath); // Log the extracted repoPath

  try {
    // Fetch the token from storage
    const { token } = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['token'], (data) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Failed to fetch token."));
        } else {
          resolve(data);
        }
      });
    });

    if (!token) {
      throw new Error("GitHub token is missing. Please configure it in settings.");
    }

    // Fetch the config.json file
    const configUrl = `https://api.github.com/repos/${repoPath}/contents/config.json`;
    console.log(`Fetching config file: ${configUrl}`); // Log the config file URL
    const configResponse = await fetch(configUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
      },
    });

    if (!configResponse.ok) {
      const errorDetails = await configResponse.text(); // Get the response body for more details
      throw new Error(`Failed to fetch config file: ${configUrl}\nStatus: ${configResponse.status} - ${configResponse.statusText}\nDetails: ${errorDetails}`);
    }

    const configData = await configResponse.json();
    const configContent = JSON.parse(atob(configData.content));

    // Fetch all files recursively
    const combinedText = await fetchFilesFromDirectory(`https://api.github.com/repos/${repoPath}/contents`, configContent, token, repoPath);

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

// Load saved settings
chrome.storage.local.get(['repo', 'token', 'repoUrl'], function (data) {
  if (data.repo) {
    document.getElementById('repo').value = data.repo;
  }
  if (data.token) {
    document.getElementById('token').value = data.token;
  }
  if (data.repoUrl) {
    document.getElementById('repoUrl').value = data.repoUrl;
  }
});