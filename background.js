    // Function to update an existing file
    function updateFile(url, code, sha, token, sendResponse) {
      console.log("Updating existing file...");
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message: "Update file via DeepSync Chrome Extension",
          content: encodeUnicodeToBase64(code),
          sha: sha,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            return response.text().then((errorDetails) => {
              throw new Error(
                `GitHub API error: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`
              );
            });
          }
          return response.json();
        })
        .then((data) => {
          console.log("GitHub API Response (Update):", data);
          sendResponse({
            success: true,
            isNewFile: false,
            filePath: data.content.path,
          });
          return true;
        })
        .catch((error) => {
          console.error("Error updating file:", error);
          sendResponse({ success: false, error: error.message });
        });
    }
// Function to create a new file
function createFile(url, code, token, sendResponse) {
  console.log("Creating new file...");
  return fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: "Create new file via DeepSync Chrome Extension",
      content: encodeUnicodeToBase64(code),
    }),
  })
    .then((response) => {
        if (!response.ok) {
          return response.text().then((errorDetails) => {
            throw new Error(
              `GitHub API error: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`
            );
          });
        }
      return response.json();
    })
    .then((data) => {
      console.log("GitHub API Response (Create):", data);
        sendResponse({
          success: true,
          isNewFile: true,
          filePath: data.content.path,
        });
        return true;
    })
    .catch((error) => {
      console.error("Error creating file:", error);
      sendResponse({ success: false, error: error.message });
    });
}

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener(
   (request, sender, sendResponse) => {
  if (request.action === "updateGitFile" || request.action === "pushCode") {
      const { repo, token } = request;

      if (!repo) {
        sendResponse({
          success: false,
          error: "Repository not configured.",
        });
        return true;
      }

      if (!token) {
        sendResponse({ success: false, error: "Failed to decrypt token." });
        return true;
      }


      const { code, filePath } = request;
      const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

      console.log("Sending request to GitHub API...");
      console.log("URL:", url);
      console.log("FilePath:", filePath);

      fetch(url, {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })
        .then(response => {
            if (response.ok) { // Check for 200-299 status codes
                return response.json().then(data => {
                    console.log("File exists. SHA:", data.sha);
                    return updateFile(url, code, data.sha, token, sendResponse);
                  });
              } else if (response.status === 404) {
                  console.log("File does not exist. Creating new file...");
                 return createFile(url, code, token, sendResponse);
              } else {
                    return response.text().then(errorDetails => {
                        console.error(
                            `GitHub API error: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`
                        );
                        sendResponse({
                            success: false,
                            error: `GitHub API error: ${response.status} - ${response.statusText}\nDetails: ${errorDetails}`,
                            });
                    });
                }
            }
        )
        .catch(error => {
          console.error("Fetch operation failed:", error);
        sendResponse({
          success: false,
          error: `Fetch operation failed: ${error.message}`,
        });
      });
     return true;
  }
}
);

// Add this at the top of background.js
function encodeUnicodeToBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode("0x" + p1);
    })
  );
}

// The rest of your background.js code remains the same
