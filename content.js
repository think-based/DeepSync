import { wildcardToRegex } from './utils.js';

const UPDATE_GIT_BUTTON_CLASS = "update-git-button";
const COPY_BUTTON_SELECTOR = ".ds-markdown-code-copy-button";
const AISTUDIO_COPY_BUTTON_SELECTOR = "button[mattooltip='Copy to clipboard']";
const CODE_BLOCK_SELECTOR = ".md-code-block";
const AISTUDIO_CODE_BLOCK_SELECTOR = "ms-code-block";

const CODE_ELEMENT_SELECTOR = "pre";
const EXTENSION_INVALIDATED_MESSAGE = "Extension context invalidated. Please reload the page.";
const SETTINGS_MISSING_MESSAGE = "Please configure repository and token in settings!";
const FILE_PATH_REQUIRED_MESSAGE = "File path is required!";
const FAILED_TO_READ_CODE_MESSAGE = "Failed to read code block content. Please try again.";
const FILE_UPDATED_MESSAGE = `File "$" updated successfully!`;
const UPDATE_GIT_TEXT = 'Update Git'
const UPDATING_TEXT = 'Updating...'
const UPDATED_TEXT = '$ Updated'

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

function extractFileName(codeBlock) {
  let element = codeBlock.previousElementSibling;
  while (element) {
      const strongTag = element.querySelector('strong');
      if (strongTag) {
          const codeTag = strongTag.querySelector('code');
          if (codeTag) return codeTag.textContent.trim();
      }
      element = element.previousElementSibling;
  }
  return null;
}

function normalizeFilePath(filePath) {
    return filePath.replace(/^\//, '').trim();
}

function findCopyButton(codeBlock) {
    if (window.location.href.includes("aistudio.google.com")) {
        return codeBlock.querySelector(AISTUDIO_COPY_BUTTON_SELECTOR);
    } else {
        return codeBlock.querySelector(COPY_BUTTON_SELECTOR);
    }
}

function findCodeElement(codeBlock) {
    return codeBlock.querySelector(CODE_ELEMENT_SELECTOR);
}

function addUpdateGitButton(copyButton, codeBlock) {
    if (copyButton.parentNode.querySelector(`.${UPDATE_GIT_BUTTON_CLASS}`)) {
        return;
    }

    const updateGitButton = document.createElement("div");
    updateGitButton.textContent = UPDATE_GIT_TEXT;
    updateGitButton.classList.add(UPDATE_GIT_BUTTON_CLASS);
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
    updateGitButton.textContent = UPDATING_TEXT;

    try {
        if (!chrome.runtime?.id) {
            throw new Error(EXTENSION_INVALIDATED_MESSAGE);
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
        throw new Error(SETTINGS_MISSING_MESSAGE);
      }

        let filePath = extractFileName(codeBlock);
        if (!filePath) {
            throw new Error(FILE_PATH_REQUIRED_MESSAGE);
        }
        filePath = normalizeFilePath(filePath);


      const codeElement = findCodeElement(codeBlock);
        let codeText = codeElement?.textContent;
        if (!codeText || codeText.trim() === "") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            codeText = codeElement?.textContent;
        }
      if (!codeText || codeText.trim() === "") {
          throw new Error(FAILED_TO_READ_CODE_MESSAGE);
      }


      const response = await chrome.runtime.sendMessage({
        action: "updateGitFile",
        code: codeText,
        filePath: filePath,
      });

      if (response.success) {
          updateGitButton.textContent = UPDATED_TEXT.replace('$', filePath);
          updateGitButton.style.backgroundColor = "#4CAF50";
          updateGitButton.disabled = true;
          showToast(FILE_UPDATED_MESSAGE.replace('$', filePath));
      } else {
          throw new Error(response.error || "Failed to update file.");
      }
    } catch (error) {
        console.error("Error updating file:", error);
        showToast(`Error: ${error.message}`, true);
      if (error.message.includes(EXTENSION_INVALIDATED_MESSAGE)) {
        showToast("Reloading page...", true);
        setTimeout(() => location.reload(), 2000);
      }
        updateGitButton.disabled = false;
        updateGitButton.textContent = UPDATE_GIT_TEXT;
    }
    });
  copyButton.parentNode.insertBefore(updateGitButton, copyButton.nextSibling);
}

function detectCodeBlocks() {
    let codeBlocks;
    if (window.location.href.includes("aistudio.google.com")) {
        codeBlocks = document.querySelectorAll(AISTUDIO_CODE_BLOCK_SELECTOR);
    } else {
        codeBlocks = document.querySelectorAll(CODE_BLOCK_SELECTOR);
    }
  codeBlocks.forEach((codeBlock) => {
      const copyButton = findCopyButton(codeBlock);
    const codeElement = findCodeElement(codeBlock);
      const codeText = codeElement?.textContent;
      if (copyButton && codeText && extractFileName(codeBlock)) {
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