import { decodeBase64Unicode, encodeUnicodeToBase64 } from './utils.js';

const GITHUB_API_BASE = 'https://api.github.com';
const EXTENSION_UPDATE_MESSAGE = "Update file via DeepSync Chrome Extension";
const EXTENSION_CREATE_MESSAGE = "Create new file via DeepSync Chrome Extension";

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateGitFile" || request.action === "pushCode") {
    chrome.storage.local.get(['repo', 'token'], function (data) {
      const { repo, token } = data;
      const { code, filePath } = request;

      if (!repo || !token) {
        sendResponse({ success: false, error: 'Repository name or GitHub token not configured.' });
        return;
      }

      const encodedRepoPath = encodeURIComponent(repo);
      const encodedFilePath = filePath.split('/').map(encodeURIComponent).join('/');

      const url = `${GITHUB_API_BASE}/repos/${encodedRepoPath}/contents/${encodedFilePath}`;

      console.log("Sending request to GitHub API...");
      console.log("URL:", url);
      console.log("Code:", code);
      console.log("FilePath:", filePath);

      // Fetch the file's SHA (if it exists)
      fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })
        .then((response) => {
            console.log("GitHub API Response Status:", response.status);
          if (response.status === 200) {
              return response.json().then((data) => {
                  console.log("File exists. SHA:", data.sha);
                // File exists, update it
                  updateFile(url, code, data.sha, token, sendResponse);
            });
          } else if (response.status === 404) {
              console.log("File does not exist. Creating new file...");
            // File doesn't exist, create it
            createFile(url, code, token, sendResponse);
          } else {
              return response.text().then(text => {
                  throw new Error(`GitHub API error: ${response.status} - ${response.statusText} ${text}`);
              })
          }
        })
        .catch((error) => {
          console.error("GitHub API Error:", error);
          sendResponse({ success: false, error: error.message });
        });
    });

    return true; // Required for async sendResponse
  }
});

// Function to update an existing file
function updateFile(url, code, sha, token, sendResponse) {
  console.log("Updating file...");
  fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: EXTENSION_UPDATE_MESSAGE,
      content: encodeUnicodeToBase64(code), // Encode code in Base64
      sha: sha,
    }),
  })
    .then((response) => {
      if (!response.ok) {
          return response.text().then(text => {
          throw new Error(`GitHub API error: ${response.status} - ${response.statusText} ${text}`);
        });
      }
        return response.json();
    })
    .then((data) => {
        console.log("GitHub API Response (Update):", data); // Log the response
        sendResponse({ success: true, isNewFile: false, filePath: data.content.path });
    })
    .catch((error) => {
        console.error("Error updating file:", error);
        sendResponse({ success: false, error: error.message });
    });
}

// Function to create a new file
function createFile(url, code, token, sendResponse) {
    console.log("Creating new file...");
    fetch(url, {
    method: "PUT",
    headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
        message: EXTENSION_CREATE_MESSAGE,
        content: encodeUnicodeToBase64(code), // Encode code in Base64
    }),
    })
    .then((response) => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`GitHub API error: ${response.status} - ${response.statusText} ${text}`);
            });
        }
        return response.json();
    })
    .then((data) => {
        console.log("GitHub API Response (Create):", data);
        sendResponse({ success: true, isNewFile: true, filePath: data.content.path });
    })
    .catch((error) => {
        console.error("Error creating file:", error);
        sendResponse({ success: false, error: error.message });
    });
}