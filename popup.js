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

    const repoResponse = await fetch(`https://api.github.com/repos/${repoPath}/contents`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!repoResponse.ok) {
      throw new Error(`GitHub API error: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    let combinedText = "";

    const filesToDownload = repoData.filter(item => {
      const path = item.path;
      const isIncluded = configContent.include.some(pattern => matchPattern(path, pattern));
      const isExcluded = configContent.exclude.some(pattern => matchPattern(path, pattern));
      return isIncluded && !isExcluded;
    });

    for (const item of filesToDownload) {
      if (item.type === "file") {
        const fileResponse = await fetch(item.download_url);
        const fileContent = await fileResponse.text();
        combinedText += `\n\n// ===== File: ${item.path} =====\n${fileContent}\n// ===== End of File: ${item.path} =====\n`;
      }
    }

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

// Wildcard pattern matching
function matchPattern(path, pattern) {
  const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
  return regex.test(path);
}