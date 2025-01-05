// بخش ثبت تنظیمات
document.getElementById('settingsForm').addEventListener('submit', function (e) {
  e.preventDefault(); // جلوگیری از ارسال فرم

  // دریافت مقادیر از فرم
  const repo = document.getElementById('repo').value;
  const token = document.getElementById('token').value;

  // ذخیره تنظیمات در localStorage
  chrome.storage.local.set({ repo, token }, function () {
    alert('تنظیمات با موفقیت ذخیره شد!');
  });
});

// بازیابی تنظیمات از localStorage
chrome.storage.local.get(['repo', 'token'], function (data) {
  if (data.repo) {
    document.getElementById('repo').value = data.repo;
  }
  if (data.token) {
    document.getElementById('token').value = data.token;
  }
});

// بخش دریافت پروژه GitHub
document.getElementById('githubForm').addEventListener('submit', async function (e) {
  e.preventDefault(); // جلوگیری از ارسال فرم

  const repoUrl = document.getElementById('repoUrl').value;
  const repoPath = repoUrl.replace("https://github.com/", ""); // تبدیل آدرس به مسیر ریپازیتوری

  try {
    // دریافت محتوای ریپازیتوری از GitHub API
    const response = await fetch(`https://api.github.com/repos/${repoPath}/contents`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    let combinedText = "";

    // دریافت محتوای هر فایل
    for (const item of data) {
      if (item.type === "file") {
        const fileResponse = await fetch(item.download_url);
        const fileContent = await fileResponse.text();
        combinedText += `\n\n// File: ${item.path}\n${fileContent}`;
      }
    }

    // ارسال متن ترکیبی به فیلد چت
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: injectTextIntoChat,
        args: [combinedText],
      });
    });

    alert("پروژه با موفقیت دریافت و در چت بارگذاری شد!");
  } catch (error) {
    console.error("Error fetching GitHub project:", error);
    alert(`خطا: ${error.message}`);
  }
});

// تابع برای تزریق متن به فیلد چت
function injectTextIntoChat(text) {
  console.log(text);
  const chatInput = document.querySelector("#chat-input");
  if (chatInput) {
    setTimeout(() => {
      chatInput.value = text;
    }, "3000");
    
  } else {
    console.error("فیلد چت پیدا نشد!");
  }
}