      // Function to decode Base64 while preserving Unicode characters
function decodeBase64Unicode(base64) {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const decodedString = new TextDecoder('utf-8').decode(bytes);
        return decodedString;
    } catch (error) {
        console.error("Base64 Decoding Error:", error);
        return null;
    }
}

// Function to encode Unicode strings to Base64
function encodeUnicodeToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }));
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
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    return derivedKey;
}

// Function to decrypt token
async function decryptToken(encryptedToken, key) {
    try {
        const combinedData = new Uint8Array(atob(encryptedToken).split('').map(char => char.charCodeAt(0)));
        const iv = combinedData.slice(0, 12);
        const encryptedBytes = combinedData.slice(12);
        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encryptedBytes
        );

        const decryptedText = new TextDecoder().decode(decryptedData);
        return decryptedText;
    } catch (error) {
        console.error("Decryption Error:", error);
        return null;
    }
}

// Function to get decrypted token from storage
async function getDecryptedToken() {
    const { token, salt } = await new Promise((resolve) => {
        chrome.storage.local.get(['token', 'salt'], resolve);
    });

    if (!token || !salt) {
        console.error("No token or salt found in storage.");
        return null;
    }

    const password = chrome.runtime.id; // Use the extension ID as password
    const generatedKey = await generateKey(password, salt);
    const decryptedToken = await decryptToken(token, generatedKey);
    if (!decryptedToken) {
        console.error("Failed to decrypt token.");
        return null;
    }
    return decryptedToken;
}

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "updateGitFile" || request.action === "pushCode") {
        try {
            const { repo } = await new Promise((resolve) => {
                chrome.storage.local.get(['repo'], resolve);
            });

            if (!repo) {
                sendResponse({ success: false, error: "Repository not configured." });
                return true;
            }
            const token = await getDecryptedToken();
            if (!token) {
                sendResponse({ success: false, error: "Failed to decrypt token." });
                return true;
            }

            const { code, filePath } = request;
            const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

            console.log("Sending request to GitHub API...");
            console.log("URL:", url);
            console.log("FilePath:", filePath);
            const response = await fetch(url, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3+json",
                },
            });

            if (response.status === 200) {
                const data = await response.json();
                console.log("File exists. SHA:", data.sha);
                await updateFile(url, code, data.sha, token, sendResponse);
            } else if (response.status === 404) {
                console.log("File does not exist. Creating new file...");
                await createFile(url, code, token, sendResponse);
            } else {
                throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
            }
        } catch (error) {
            console.error("Error:", error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});

// Function to update an existing file
function updateFile(url, code, sha, token, sendResponse) {
    console.log("Updating file...");
    fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
            message: "Update file via DeepSync Chrome Extension",
            content: encodeUnicodeToBase64(code),
            sha: sha,
        }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log("GitHub API Response (Update):", data);
            sendResponse({ success: true, isNewFile: false, filePath: data.content.path });
        })
        .catch((error) => {
            console.error("Error updating file:", error);
            sendResponse({ success: false, error: error.message });
        });
}

// Function to create a new file
function createFile(url, code, token, sendResponse) {
    console.log("Creating new file...");
    fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
            message: "Create new file via DeepSync Chrome Extension",
            content: encodeUnicodeToBase64(code),
        }),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log("GitHub API Response (Create):", data);
            sendResponse({ success: true, isNewFile: true, filePath: data.content.path });
        })
        .catch((error) => {
            console.error("Error creating file:", error);
            sendResponse({ success: false, error: error.message });
        });
}
    