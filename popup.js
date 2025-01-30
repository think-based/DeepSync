import { decodeBase64Unicode, wildcardToRegex } from './utils.js';

const GITHUB_API_BASE = 'https://api.github.com';
const CONFIG_FILE_NAME = 'config.json';

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


document.getElementById('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const repo = document.getElementById('repo').value;
  const token = document.getElementById('token').value;

  chrome.storage.local.set({ repo, token }, function () {
    showToast("Settings saved successfully!");
  });
});


async function fetchFileFromGitHub(path, token, repoPath) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const encodedRepoPath = encodeURIComponent(repoPath);
  const url = `${GITHUB_API_BASE}/repos/${encodedRepoPath}/contents/${encodedPath}`;
    const headers = {
        Accept: "application/vnd.github.v3+json",
    };

    if (token) {
        headers.Authorization = `token ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Failed to fetch file: ${path}\nStatus: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`);
    }

    const data = await response.json();
    return decodeBase64Unicode(data.content); // Use custom function to decode Base64
}


async function fetchFilesFromDirectory(url, configContent, token, repoPath) {
    const headers = {
        Accept: "application/vnd.github.v3+json",
    };

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


document.getElementById('githubForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const fetchButton = document.getElementById('fetchButton');
  fetchButton.disabled = true;
  fetchButton.innerText = "Fetching...";

  const repoUrl = document.getElementById('repoUrl').value;

  let repoPath = repoUrl.replace("https://github.com/", "").replace(/\/$/, ""); // Remove trailing slash
  if (repoPath.includes("/tree/") || repoPath.includes("/blob/")) {
    repoPath = repoPath.split("/").slice(0, 2).join("/");
  }

    console.log("Extracted repoPath:", repoPath); // Log the extracted repoPath
    chrome.storage.local.set({ repoUrl }, function () {
        console.log("Repository URL saved:", repoUrl);
    });

  try {
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
        const encodedRepoPath = encodeURIComponent(repoPath);
    const configUrl = `${GITHUB_API_BASE}/repos/${encodedRepoPath}/contents/${CONFIG_FILE_NAME}`;
    console.log(`Fetching config file: ${configUrl}`);
      const configResponse = await fetch(configUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
            Authorization: `token ${token}`,
        },
    });

      if (!configResponse.ok) {
          const errorDetails = await configResponse.text();
        throw new Error(`Failed to fetch config file: ${CONFIG_FILE_NAME}\nStatus: ${configResponse.status} - ${configResponse.statusText}\nDetails: ${errorDetails}`);
    }


    const configData = await configResponse.json();
    const configContent = JSON.parse(decodeBase64Unicode(configData.content));


      const combinedText = await fetchFilesFromDirectory(`${GITHUB_API_BASE}/repos/${encodedRepoPath}/contents`, configContent, token, repoPath);

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