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