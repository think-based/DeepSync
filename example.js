// تابع برای استخراج نام فایل از کامنت‌ها
function extractFileName(code) {
  const patterns = [
    /\/\/\s*FileName:\s*([^\n]+)/, // // FileName: example.js
    /#\s*FileName:\s*([^\n]+)/,    // # FileName: example.py
    /\/\*\s*FileName:\s*([^*]+)\*\//, // /* FileName: example.js */
    /<!--\s*FileName:\s*([^>]+)-->/ // <!-- FileName: example.html -->
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match) {
      return match[1].trim(); // بازگرداندن نام فایل
    }
  }

  return null; // اگر نام فایل پیدا نشد
}

// تابع برای نمایش نوتیفیکیشن
function showNotification(title, message) {
  chrome.runtime.sendMessage({
    action: "showNotification",
    title: title,
    message: message,
  });
}

// تابع برای یافتن فایل تطبیق‌یافته بر اساس محتوا
async function findMatchingFileName(codeText, repo, token) {
  try {
    // دریافت لیست فایل‌ها از ریپازیتوری
    const repoResponse = await fetch(`https://api.github.com/repos/${repo}/contents`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!repoResponse.ok) {
      throw new Error(`GitHub API error: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();

    // بررسی هر فایل برای یافتن تطابق محتوا
    for (const item of repoData) {
      if (item.type === "file") {
        const fileResponse = await fetch(item.download_url);
        const fileContent = await fileResponse.text();

        // مقایسه محتوا با استفاده از Levenshtein Distance
        const distance = levenshteinDistance(codeText, fileContent);
        if (distance < 10) { // اگر فاصله کمتر از ۱۰ باشد، فایل تطبیق‌یافته در نظر گرفته می‌شود
          return item.path; // فایل تطبیق‌یافته پیدا شد
        }
      }
    }

    // اگر هیچ فایل مطابقت‌دهنده‌ای پیدا نشد
    return null;
  } catch (error) {
    console.error("Error finding matching file:", error);
    return null;
  }
}

// تابع محاسبه فاصله Levenshtein
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // جایگزینی
          matrix[i][j - 1] + 1, // درج
          matrix[i - 1][j] + 1 // حذف
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// تابع برای افزودن دکمه "Update Git" کنار دکمه "Copy"
function addUpdateGitButton(copyButton, codeText) {
  // بررسی اگر دکمه "Update Git" از قبل وجود دارد
  if (copyButton.parentNode.querySelector(".update-git-button")) {
    return; // اگر وجود دارد، خروج
  }

  // ایجاد دکمه "Update Git"
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

  // افزودن رویداد کلیک به دکمه "Update Git"
  updateGitButton.addEventListener("click", async () => {
    // دریافت تنظیمات از localStorage
    chrome.storage.local.get(['repo', 'token'], async function (data) {
      const { repo, token } = data;

      if (!repo || !token) {
        showNotification("DeepSync Error", "لطفاً تنظیمات ریپازیتوری و توکن را وارد کنید.");
        return;
      }

      // استخراج نام فایل از کامنت‌ها
      let filePath = extractFileName(codeText);

      // اگر نام فایل پیدا نشد، از GitHub API برای جستجوی محتوا استفاده کنید
      if (!filePath) {
        filePath = await findMatchingFileName(codeText, repo, token);
      }

      // اگر هنوز نام فایل پیدا نشد، از کاربر بخواهید نام فایل را وارد کند
      if (!filePath) {
        filePath = prompt("لطفاً مسیر فایل را در مخزن وارد کنید (مثلاً src/index.js):", "index.js");
      }

      // اگر کاربر نام فایل را وارد کرد، فایل را به‌روزرسانی کنید
      if (filePath) {
        chrome.runtime.sendMessage(
          {
            action: "updateGitFile",
            code: codeText,
            filePath: filePath,
          },
          (response) => {
            if (response.success) {
              showNotification("DeepSync", `فایل "${filePath}" با موفقیت به‌روزرسانی شد!`);
              updateGitButton.innerText = "Git Updated";
              updateGitButton.style.backgroundColor = "#4CAF50";
              updateGitButton.disabled = true;
            } else {
              console.error("Error updating file:", response.error);
              showNotification("DeepSync Error", `خطا: ${response.error}`);
            }
          }
        );
      }
    });
  });

  // افزودن دکمه "Update Git" کنار دکمه "Copy"
  copyButton.parentNode.insertBefore(updateGitButton, copyButton.nextSibling);
}

// تابع برای تشخیص بلوک‌های کد و افزودن دکمه‌ها
function detectCodeBlocks() {
  const codeBlocks = document.querySelectorAll(".md-code-block"); // پیدا کردن تمام بلوک‌های کد
  codeBlocks.forEach((codeBlock) => {
    const copyButton = codeBlock.querySelector(".ds-markdown-code-copy-button"); // پیدا کردن دکمه "Copy"
    const codeElement = codeBlock.querySelector("pre"); // پیدا کردن عنصر <pre> حاوی کد
    const codeText = codeElement?.innerText; // استخراج متن کد

    if (copyButton && codeText) {
      addUpdateGitButton(copyButton, codeText); // افزودن دکمه "Update Git"
    }
  });
}

// تابع برای تشخیص تغییرات در DOM
function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        detectCodeBlocks(); // تشخیص بلوک‌های کد پس از تغییرات DOM
      }
    });
  });

  // شروع مشاهده تغییرات در body
  observer.observe(document.body, {
    childList: true, // مشاهده تغییرات در فرزندان
    subtree: true, // مشاهده تغییرات در کل زیردرخت
  });
}

// شروع مشاهده تغییرات
observeDOMChanges();