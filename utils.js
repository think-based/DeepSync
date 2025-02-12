// Function to decode Base64 while preserving Unicode characters
function decodeBase64Unicode(base64) {
    try {
      const binaryString = atob(base64);
      return new TextDecoder("utf-8").decode(
        new Uint8Array([...binaryString].map((c) => c.charCodeAt(0)))
      );
    } catch (error) {
      console.error("Base64 Decoding Error:", error);
      return null;
    }
  }
  
  // Function to encode Unicode strings to Base64
  function encodeUnicodeToBase64(str) {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode("0x" + p1);
      })
    );
  }
  
  // Function to generate a secret key from password
  async function generateKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
  
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return derivedKey;
  }
  
  // Function to decrypt token
  async function decryptToken(encryptedToken, password, salt) {
    try {
      const combinedData = new Uint8Array(
        atob(encryptedToken).split("").map((char) => char.charCodeAt(0))
      );
      const iv = combinedData.slice(0, 12);
      const encryptedBytes = combinedData.slice(12);
        const generatedKey = await generateKey(password, salt);
      const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        generatedKey,
        encryptedBytes
      );
  
      const decryptedText = new TextDecoder().decode(decryptedData);
      return decryptedText;
    } catch (error) {
      console.error("Decryption Error:", error);
      return null;
    }
  }

// Add all shared functions here
const SharedUtils = {
  encodeUnicodeToBase64,
  decodeBase64Unicode,
  generateKey,
  decryptToken,
  showToast: (message, isError = false) => {
    chrome.runtime.sendMessage({
      action: 'showToast',
      message,
      isError
    });
  }
};

// Message handler for shared functionality
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'encodeBase64':
      sendResponse({ result: SharedUtils.encodeUnicodeToBase64(request.data) });
      break;
    case 'decryptToken':
      SharedUtils.decryptToken(request.token, request.password, request.salt)
        .then(result => sendResponse({ result }));
      break;
  }
  return true;
});

// Add storage utilities
const StorageUtils = {
  async cacheKey(key, value, expirationMinutes = 30) {
    const item = {
      value,
      timestamp: Date.now(),
      expirationMinutes
    };
    await chrome.storage.local.set({ [key]: item });
  },

  async getCachedKey(key) {
    const data = await chrome.storage.local.get(key);
    if (!data[key]) return null;

    const item = data[key];
    const expirationTime = item.timestamp + (item.expirationMinutes * 60 * 1000);
    
    if (Date.now() > expirationTime) {
      await chrome.storage.local.remove(key);
      return null;
    }
    
    return item.value;
  }
};
