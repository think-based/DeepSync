// تابع برای نمایش نوتیفیکیشن
function showNotification(title, message) {
  chrome.runtime.sendMessage({
    action: "showNotification",
    title: title,
    message: message,
  });
}

// تابع برای استخراج نام فایل از نزدیک‌ترین تگ HTML بالای کد بلاک
function extractFileName(codeBlock) {
  // پیمایش DOM به سمت بالا برای یافتن تگ <strong> حاوی نام فایل
  let element = codeBlock.previousElementSibling;
  while (element) {
    // بررسی محتوای تگ HTML
    const strongTag = element.querySelector('strong');
    if (strongTag) {
      const codeTag = strongTag.querySelector('code');
      if (codeTag) {
        return codeTag.innerText.trim(); // بازگرداندن نام فایل
      }
    }

    // بررسی تگ‌های بالاتر
    element = element.previousElementSibling;
  }

  return null; // اگر نام فایل پیدا نشد
}

// تابع برای افزودن دکمه "Update Git" کنار دکمه "Copy"
function addUpdateGitButton(copyButton, codeText, codeBlock) {
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

      // استخراج نام فایل از نزدیک‌ترین تگ HTML بالای کد بلاک
      let filePath = extractFileName(codeBlock);

      // اگر نام فایل پیدا نشد، از کاربر بخواهید نام فایل را وارد کند
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
      addUpdateGitButton(copyButton, codeText, codeBlock); // افزودن دکمه "Update Git"
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