// تابع برای استخراج نام فایل از کد
function extractFileName(code) {
  const fileNameRegex = /\/\/\s*FileName:\s*([^\n]+)/; // Regex to match // FileName: [filename]
  const match = code.match(fileNameRegex);
  return match ? match[1].trim() : null; // Return the file name or null if not found
}

// تابع برای نمایش نوتیفیکیشن
function showNotification(title, message) {
  chrome.runtime.sendMessage({
    action: "showNotification",
    title: title,
    message: message,
  });
}

// تابع برای مقایسه محتوای دو فایل
function compareContent(content1, content2) {
  return content1.trim() === content2.trim(); // مقایسه محتوا پس از حذف فاصله‌های اضافی
}

// تابع برای یافتن نام فایل به‌صورت هوشمند
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

        if (compareContent(fileContent, codeText)) {
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

// تابع برای افزودن دکمه "Update Git" کنار دکمه "Copy"
function addUpdateGitButton(copyButton, codeText) {
  // بررسی اگر دکمه "Update Git" از قبل وجود دارد
  if (copyButton.parentNode.querySelector(".update-git-button")) {
    return; // اگر وجود دارد، خروج
  }

  // ایجاد دکمه "Update Git"
  const updateGitButton = document.createElement("div");
  updateGitButton.innerText = "Update Git";
  updateGitButton.classList.add("update-git-button"); // Add a class for identification
  updateGitButton.style.marginLeft = "10px";
  updateGitButton.style.backgroundColor = "#2d9cdb";
  updateGitButton.style.color = "#fff";
  updateGitButton.style.border = "none";
  updateGitButton.style.borderRadius = "4px";
  updateGitButton.style.padding = "5px 10px";
  updateGitButton.style.cursor = "pointer";
  updateGitButton.style.display = "inline-block"; // اضافه کردن این خط برای اطمینان از نمایش دکمه

  // افزودن رویداد کلیک به دکمه "Update Git"
  updateGitButton.addEventListener("click", async () => {
    // دریافت تنظیمات از localStorage
    chrome.storage.local.get(['repo', 'token'], async function (data) {
      const { repo, token } = data;

      if (!repo || !token) {
        showNotification("DeepSync Error", "لطفاً تنظیمات ریپازیتوری و توکن را وارد کنید.");
        return;
      }

      // استخراج نام فایل از کد
      let filePath = extractFileName(codeText);

      // اگر نام فایل پیدا نشد، به‌صورت هوشمندانه نام فایل را پیدا کن
      if (!filePath) {
        filePath = await findMatchingFileName(codeText, repo, token);
      }

      // اگر هنوز نام فایل پیدا نشد، خطا بده
      if (!filePath) {
        showNotification("DeepSync Error", "فایل مورد نظر در ریپازیتوری یافت نشد.");
        return;
      }

      // بررسی وجود فایل در GitHub
      try {
        const fileResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (!fileResponse.ok) {
          throw new Error(`فایل "${filePath}" در ریپازیتوری وجود ندارد.`);
        }

        // گرفتن تاییدیه از کاربر (بدون نمایش نام فایل)
        const isConfirmed = confirm("آیا می‌خواهید این فایل را به‌روزرسانی کنید؟");
        if (isConfirmed) {
          // ارسال کد و مسیر فایل به background.js
          chrome.runtime.sendMessage(
            {
              action: "updateGitFile",
              code: codeText,
              filePath: filePath,
            },
            (response) => {
              if (response.success) {
                showNotification("DeepSync", `فایل "${filePath}" با موفقیت به‌روزرسانی شد!`);
                // تغییر نام دکمه به "Git Updated"
                updateGitButton.innerText = "Git Updated";
                updateGitButton.style.backgroundColor = "#4CAF50"; // تغییر رنگ به سبز
                updateGitButton.disabled = true; // غیرفعال کردن دکمه
              } else {
                console.error("Error updating file:", response.error); // لاگ خطا در کنسول
                showNotification("DeepSync Error", `خطا: ${response.error}`); // نمایش نوتیفیکیشن خطا
              }
            }
          );
        }
      } catch (error) {
        console.error("Error checking file existence:", error);
        showNotification("DeepSync Error", `خطا: ${error.message}`);
      }
    });
  });

  // افزودن دکمه "Update Git" کنار دکمه "Copy"
  copyButton.parentNode.insertBefore(updateGitButton, copyButton.nextSibling);
}

// تابع برای افزودن دکمه "Push" کنار دکمه "Copy"
function addPushButton(copyButton, codeText) {
  // بررسی اگر دکمه "Push" از قبل وجود دارد
  if (copyButton.parentNode.querySelector(".push-button")) {
    return; // اگر وجود دارد، خروج
  }

  // ایجاد دکمه "Push"
  const pushButton = document.createElement("div");
  pushButton.innerText = "Push";
  pushButton.classList.add("push-button"); // Add a class for identification
  pushButton.style.marginLeft = "10px";
  pushButton.style.backgroundColor = "#4CAF50";
  pushButton.style.color = "#fff";
  pushButton.style.border = "none";
  pushButton.style.borderRadius = "4px";
  pushButton.style.padding = "5px 10px";
  pushButton.style.cursor = "pointer";
  pushButton.style.display = "inline-block"; // اضافه کردن این خط برای اطمینان از نمایش دکمه

  // افزودن رویداد کلیک به دکمه "Push"
  pushButton.addEventListener("click", async () => {
    const defaultFileName = extractFileName(codeText); // استخراج نام فایل پیش‌فرض
    const filePath = prompt("Enter the file path in your repository (e.g., src/index.js):", defaultFileName || "index.js");

    if (filePath) {
      // گرفتن تاییدیه از کاربر (بدون نمایش نام فایل)
      const isConfirmed = confirm("آیا مطمئن هستید که می‌خواهید این فایل را در GitHub ارسال کنید؟");
      if (isConfirmed) {
        // ارسال کد و مسیر فایل به background.js
        chrome.runtime.sendMessage(
          {
            action: "pushCode",
            code: codeText,
            filePath: filePath,
          },
          (response) => {
            if (response.success) {
              if (response.isNewFile) {
                showNotification("DeepSync", `فایل جدید "${filePath}" ایجاد شد!`);
              } else {
                showNotification("DeepSync", `فایل "${filePath}" با موفقیت ارسال شد!`);
              }
              // تغییر نام دکمه به "Pushed"
              pushButton.innerText = "Pushed";
              pushButton.style.backgroundColor = "#2d9cdb"; // تغییر رنگ به آبی
              pushButton.disabled = true; // غیرفعال کردن دکمه
            } else {
              console.error("Error pushing file:", response.error); // لاگ خطا در کنسول
              showNotification("DeepSync Error", `خطا: ${response.error}`); // نمایش نوتیفیکیشن خطا
            }
          }
        );
      }
    }
  });

  // افزودن دکمه "Push" کنار دکمه "Copy"
  copyButton.parentNode.insertBefore(pushButton, copyButton.nextSibling);
}

// تابع برای تشخیص بلوک‌های کد و افزودن دکمه‌ها
function detectCodeBlocks() {
  const codeBlocks = document.querySelectorAll(".md-code-block"); // Find all code block containers
  console.log(`Found ${codeBlocks.length} code blocks.`); // اضافه کردن لاگ برای بررسی
  codeBlocks.forEach((codeBlock) => {
    const copyButton = codeBlock.querySelector(".ds-markdown-code-copy-button"); // Find the "Copy" button
    const codeElement = codeBlock.querySelector("pre"); // Find the <pre> element containing the code
    const codeText = codeElement?.innerText; // Extract the code text

    if (copyButton && codeText) {
      addUpdateGitButton(copyButton, codeText); // افزودن دکمه "Update Git"
      addPushButton(copyButton, codeText); // افزودن دکمه "Push"
    }
  });
}

// تابع برای تشخیص تغییرات در DOM
function observeDOMChanges() {
  const observer = new MutationObserver((mutations) => {
    console.log("DOM changed. Detecting code blocks..."); // اضافه کردن لاگ برای بررسی
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