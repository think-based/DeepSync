      // Function to show toast messages
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.backgroundColor = isError ? "#ff4444" : "#2d9cdb";
  toast.style.color = "#fff";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "4px";
  toast.style.zIndex = "1000";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.5s";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 500);
  }, 3000);
}

// Function to extract file name from code block
function extractFileName(codeBlock) {
  const codeElement = codeBlock.querySelector("pre");
  const codeText = codeElement?.textContent;

  if (codeText) {
    const lines = codeText.split("\n").slice(0, 3);
    for (const line of lines) {
      const jsCommentMatch = line.match(/\/\/\s*File\s*Name:\s*(.+?\.\w+)/i);
      if (jsCommentMatch) return jsCommentMatch[1].trim();

      const htmlCommentMatch = line.match(
        /<!--\s*File\s*Name:\s*(.+?\.\w+)\s*-->/i
      );
      if (htmlCommentMatch) return htmlCommentMatch[1].trim();

      const blockCommentMatch = line.match(
        /\/\*\s*File\s*Name:\s*(.+?\.\w+)\s*\*\//i
      );
      if (blockCommentMatch) return blockCommentMatch[1].trim();
    }
  }
  let element = codeBlock.previousElementSibling;
  while (element) {
    const strongTag = element.querySelector("strong");
    if (strongTag) {
      const codeTag = strongTag.querySelector("code");
      if (codeTag) return codeTag.textContent.trim();
    }
    element = element.previousElementSibling;
  }

  const filePath = prompt(
    "Please enter the file path in the repository (e.g., src/index.js):",
    ""
  );
  return filePath?.trim() || null;
}

// Function to normalize file path
function normalizeFilePath(filePath) {
  return filePath.replace(/^\//, "").trim();
}

// Function to find the copy button
function findCopyButton(codeBlock) {
  if (window.location.href.includes("aistudio.google.com")) {
    return codeBlock.querySelector("button[mattooltip='Copy to clipboard']");
  } else {
    return codeBlock.querySelector(".ds-markdown-code-copy-button");
  }
}

// Function to find the code element
function findCodeElement(codeBlock) {
  return codeBlock.querySelector("pre");
}

// Function to add the "Update Git" button
function addUpdateGitButton(copyButton, codeBlock) {
  if (copyButton.parentNode.querySelector(".update-git-button")) {
    return;
  }

  const updateGitButton = document.createElement("div");
  updateGitButton.textContent = "Update Git";
  updateGitButton.classList.add("update-git-button");
  updateGitButton.style.marginLeft = "10px";
  updateGitButton.style.backgroundColor = "#2d9cdb";
  updateGitButton.style.color = "#fff";
  updateGitButton.style.border = "none";
  updateGitButton.style.borderRadius = "4px";
  updateGitButton.style.padding = "5px 10px";
  updateGitButton.style.cursor = "pointer";
  updateGitButton.style.display = "inline-block";
  updateGitButton.addEventListener("click", async () => {
    updateGitButton.disabled = true;
    updateGitButton.textContent = "Updating...";
    try {
      if (!chrome.runtime?.id) {
        throw new Error("Extension context invalidated. Please reload the page.");
      }
      const { repo, token } = await new Promise((resolve, reject) => {
        chrome.storage.local.get(["repo", "token"], (data) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                chrome.runtime.lastError.message || "Failed to fetch settings."
              )
            );
          } else {
            resolve(data);
          }
        });
      });

      if (!repo || !token) {
        throw new Error("Please configure repository and token in settings!");
      }
      let filePath = extractFileName(codeBlock);
      if (!filePath) {
        throw new Error("File path is required!");
      }
      filePath = normalizeFilePath(filePath);

      const codeElement = findCodeElement(codeBlock);
      let codeText = codeElement?.textContent;

      if (!codeText || codeText.trim() === "") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        codeText = codeElement?.textContent;
      }

      if (!codeText || codeText.trim() === "") {
        throw new Error("Failed to read code block content. Please try again.");
      }

      // Use await here to properly wait for the response
      const response = await chrome.runtime.sendMessage({
        action: "updateGitFile",
        code: codeText,
        filePath: filePath,
      });
      if (response && response.success) {
        updateGitButton.textContent = `${filePath} Updated`;
        updateGitButton.style.backgroundColor = "#4CAF50";
        updateGitButton.disabled = true;
        showToast(`File "${filePath}" updated successfully!`);
      } else {
        throw new Error(response?.error || "Failed to update file.");
      }
    } catch (error) {
      console.error("Error updating file:", error);
      showToast(`Error: ${error.message}`, true);
      if (error.message.includes("Extension context invalidated")) {
        showToast("Reloading page...", true);
        setTimeout(() => location.reload(), 2000);
      }
      updateGitButton.disabled = false;
      updateGitButton.textContent = "Update Git";
    }
  });

  copyButton.parentNode.insertBefore(updateGitButton, copyButton.nextSibling);
}

// Function to detect code blocks and add buttons
function detectCodeBlocks() {
  let codeBlocks;

  if (window.location.href.includes("aistudio.google.com")) {
    codeBlocks = document.querySelectorAll("ms-code-block");
  } else {
    codeBlocks = document.querySelectorAll(".md-code-block");
  }

  codeBlocks.forEach((codeBlock) => {
    const copyButton = findCopyButton(codeBlock);
    const codeElement = findCodeElement(codeBlock);
    let codeText = codeElement?.textContent?.trim();

    if (copyButton && codeText) {
      addUpdateGitButton(copyButton, codeBlock);
    }
  });
}

function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        detectCodeBlocks();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

observeDOMChanges();
    