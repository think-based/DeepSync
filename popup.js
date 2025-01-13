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
  }, 3000);
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
  const regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i'); // Case-insensitive matching
}

// Recursive function to fetch files from a directory
async function fetchFilesFromDirectory(url, configContent) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  let combinedText = "";

  for (const item of data) {
    if (item.type === "file") {
      // Check if the file matches the include/exclude patterns
      const isIncluded = configContent.include.some(pattern => wildcardToRegex(pattern).test(item.path));
      const isExcluded = configContent.exclude.some(pattern => wildcardToRegex(pattern).test(item.path));

      if (isIncluded && !isExcluded) {
        const fileResponse = await fetch(item.download_url);
        const fileContent = await fileResponse.text();
        combinedText += `\n\n// ===== File: ${item.path} =====\n${fileContent}\n// ===== End of File: ${item.path} =====\n`;
      }
    } else if (item.type === "dir") {
      // Recursively fetch files from the subdirectory
      const subDirText = await fetchFilesFromDirectory(item.url, configContent);
      combinedText += subDirText;
    }
  }

  return combinedText;
}

// Fetch GitHub project
document.getElementById('githubForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const fetchButton = document.getElementById('fetchButton');
  fetchButton.disabled = true;
  fetchButton.innerText = "Fetching...";

  const repoUrl = document.getElementById('repoUrl').value;
  const repoPath = repoUrl.replace("https://github.com/", "");

  chrome.storage.local.set({ repoUrl }, function () {
    console.log("Repository URL saved:", repoUrl);
  });

  try {
    // Fetch the config.json file
    const configResponse = await fetch(`https://api.github.com/repos/${repoPath}/contents/config.json`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!configResponse.ok) {
      throw new Error("config.json file not found!");
    }

    const configData = await configResponse.json();
    const configContent = JSON.parse(atob(configData.content));

    // Fetch all files recursively
    const combinedText = await fetchFilesFromDirectory(`https://api.github.com/repos/${repoPath}/contents`, configContent);

    // Copy the combined text to the clipboard
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