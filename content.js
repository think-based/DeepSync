// تابع نمایش toast
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

  // نمایش toast
  setTimeout(() => {
    toast.style.opacity = "1";
  }, 10);

  // مخفی کردن toast پس از 3 ثانیه
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 500);
  }, 3000);
}

// تابع برای استخراج نام فایل
function extractFileName(codeBlock) {
  const codeElement = codeBlock.querySelector("pre");
  const codeText = codeElement?.innerText;

  // Step 1: Check the first 3 lines of the code for a file name in comments
  if (codeText) {
    const lines = codeText.split('\n').slice(0, 3); // Check the first 3 lines
    for (const line of lines) {
      // Look for a comment pattern that might contain a file name
      const commentMatch = line.match(/\/\/\s*File\s*Name:\s*(.+\.\w+)/i); // Matches variations like "//FileName:", "// FileName:", "//File Name:"
      if (commentMatch) {
        return commentMatch[1].trim(); // Return the extracted file name
      }
    }
  }

  // Step 2: Check the HTML structure (original logic)
  let element = codeBlock.previousElementSibling;
  while (element) {
    const strongTag = element.querySelector('strong');
    if (strongTag) {
      const codeTag = strongTag.querySelector('code');
      if (codeTag) {
        return codeTag.innerText.trim();
      }
    }
    element = element.previousElementSibling;
  }

  // Step 3: If no file name is found, prompt the user to enter it
  const filePath = prompt("Please enter the file path in the repository (e.g., src/index.js):", "");
  return filePath?.trim() || null; // Return the user-provided file path or null if canceled
}

// تابع برای نرمال‌سازی مسیر فایل
function normalizeFilePath(filePath) {
  // Remove leading slashes and trim whitespace
  return filePath.replace(/^\//, '').trim();
}

// تابع برای افزودن دکمه "Update Git" کنار دکمه "Copy"
function addUpdateGitButton(copyButton, codeText, codeBlock) {
  if (copyButton.parentNode.querySelector(".update-git-button")) {
    return;
  }

  const updateGitButton = document.createElement("div");
  updateGitButton.innerText = "Update Git";
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
    updateGitButton.disabled = true; // Disable the button
    updateGitButton.innerText = "Updating..."; // Change button text

    try {
      // Check if the extension context is still valid
      if (!chrome.runtime?.id) {
        throw new Error("Extension context invalidated. Please reload the page.");
      }

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
        throw new Error("Please configure repository and token in settings!");
      }

      let filePath = extractFileName(codeBlock);
      if (!filePath) {
        throw new Error("File path is required!");
      }

      // Normalize the file path (remove leading slashes)
      filePath = normalizeFilePath(filePath);

      const response = await chrome.runtime.sendMessage({
        action: "updateGitFile",
        code: codeText,
        filePath: filePath,
      });

      if (response.success) {
        // Change button text to "[filename] Updated" and keep it disabled
        updateGitButton.innerText = `${filePath} Updated`;
        updateGitButton.style.backgroundColor = "#4CAF50"; // Change color to green
        updateGitButton.disabled = true; // Keep the button disabled
        showToast(`File "${filePath}" updated successfully!`);
      } else {
        throw new Error(response.error || "Failed to update file.");
      }
    } catch (error) {
      console.error("Error updating file:", error);
      showToast(`Error: ${error.message}`, true);

      // Reload the page if the extension context is invalidated
      if (error.message.includes("Extension context invalidated")) {
        showToast("Reloading page...", true);
        setTimeout(() => location.reload(), 2000); // Reload the page after 2 seconds
      }

      // Re-enable the button and reset its text
      updateGitButton.disabled = false;
      updateGitButton.innerText = "Update Git";
    }
  });

  copyButton.parentNode.insertBefore(updateGitButton, copyButton.nextSibling);
}

// تابع برای تشخیص بلوک‌های کد و افزودن دکمه‌ها
function detectCodeBlocks() {
  const codeBlocks = document.querySelectorAll(".md-code-block");
  codeBlocks.forEach((codeBlock) => {
    const copyButton = codeBlock.querySelector(".ds-markdown-code-copy-button");
    const codeElement = codeBlock.querySelector("pre");
    const codeText = codeElement?.innerText;

    if (copyButton && codeText) {
      addUpdateGitButton(copyButton, codeText, codeBlock);
    }
  });
}

// تابع برای تشخیص تغییرات در DOM
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

// شروع مشاهده تغییرات
observeDOMChanges();