chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pullCode") {
    const { code, filePath } = request;
    const repo = "think-based/DeepSync"; // Replace with your repository
    const token = "e95fbd2f971f7eb5749d031ff91bdb30f60b78ed"; // Replace with your GitHub token

    const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    // Fetch the file's SHA (if it exists)
    fetch(url, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
      .then((response) => {
        if (response.status === 200) {
          return response.json().then((data) => {
            // File exists, update it
            updateFile(url, code, data.sha, token, sendResponse);
          });
        } else if (response.status === 404) {
          // File doesn't exist, create it
          createFile(url, code, token, sendResponse);
        } else {
          throw new Error(`GitHub API error: ${response.status}`);
        }
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });

    return true; // Required for async sendResponse
  }
});

function updateFile(url, code, sha, token, sendResponse) {
  fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: "Update file via Chrome Extension",
      content: btoa(code), // Encode code in Base64
      sha: sha,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      sendResponse({ success: true, data });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
}

function createFile(url, code, token, sendResponse) {
  fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: "Create new file via Chrome Extension",
      content: btoa(code), // Encode code in Base64
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      sendResponse({ success: true, data });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
}
