// بخش ثبت تنظیمات
document.getElementById('settingsForm').addEventListener('submit', function (e) {
  e.preventDefault(); // جلوگیری از ارسال فرم

  // دریافت مقادیر از فرم
  const repo = document.getElementById('repo').value;
  const token = document.getElementById('token').value;

  // ذخیره تنظیمات در localStorage
  chrome.storage.local.set({ repo, token }, function () {
    showNotification("DeepSync", "تنظیمات با موفقیت ذخیره شد!");
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
    // دریافت فایل تنظیمات (config.json)
    const configResponse = await fetch(`https://api.github.com/repos/${repoPath}/contents/config.json`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!configResponse.ok) {
      throw new Error("فایل تنظیمات (config.json) یافت نشد!");
    }

    const configData = await configResponse.json();
    const configContent = JSON.parse(atob(configData.content)); // دیکد کردن محتوای Base64

    // دریافت لیست فایل‌ها از ریپازیتوری
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

    // فیلتر کردن فایل‌ها بر اساس تنظیمات
    const filesToDownload = repoData.filter(item => {
      const path = item.path;
      const isIncluded = configContent.include.some(pattern => matchPattern(path, pattern));
      const isExcluded = configContent.exclude.some(pattern => matchPattern(path, pattern));
      return isIncluded && !isExcluded;
    });

    // دریافت محتوای هر فایل
    for (const item of filesToDownload) {
      if (item.type === "file") {
        const fileResponse = await fetch(item.download_url);
        const fileContent = await fileResponse.text();
        combinedText += `\n\n// ===== File: ${item.path} =====\n${fileContent}\n// ===== End of File: ${item.path} =====\n`;
      }
    }

    // انتقال متن به کلیپ‌بورد
    navigator.clipboard.writeText(combinedText).then(() => {
      showNotification("DeepSync", "متن با موفقیت به کلیپ‌بورد منتقل شد!");
    }).catch((error) => {
      console.error("خطا در انتقال به کلیپ‌بورد:", error);
      showNotification("DeepSync Error", "خطا در انتقال به کلیپ‌بورد!");
    });

  } catch (error) {
    console.error("Error fetching GitHub project:", error);
    showNotification("DeepSync Error", `خطا: ${error.message}`);
  }
});

// تابع برای تطبیق الگوهای wildcard
function matchPattern(path, pattern) {
  const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
  return regex.test(path);
}