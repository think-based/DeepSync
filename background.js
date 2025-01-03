chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "pullCode") {
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

// Functions for updating and creating files (unchanged)