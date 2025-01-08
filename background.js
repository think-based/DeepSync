// Function to encode Unicode strings to Base64
function encodeUnicodeToBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
}

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateGitFile" || request.action === "pushCode") {
    // دریافت تنظیمات از localStorage
    chrome.storage.local.get(['repo', 'token'], function (data) {
      const { repo, token } = data;
      const { code, filePath } = request;
      const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

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
            throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
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
      message: "Update file via DeepSync Chrome Extension",
      content: encodeUnicodeToBase64(code), // Encode code in Base64
      sha: sha,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
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
      message: "Create new file via DeepSync Chrome Extension",
      content: encodeUnicodeToBase64(code), // Encode code in Base64
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("GitHub API Response (Create):", data); // Log the response
      sendResponse({ success: true, isNewFile: true, filePath: data.content.path });
    })
    .catch((error) => {
      console.error("Error creating file:", error);
      sendResponse({ success: false, error: error.message });
    });
}