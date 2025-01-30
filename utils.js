// utils.js
function decodeBase64Unicode(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
}

function encodeUnicodeToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F])/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }));
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegex(pattern) {
  const escapedPattern = escapeRegExp(pattern);
  let regexPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

  if (!pattern.startsWith('*') && !pattern.includes('/')) {
      regexPattern = `(.*\/)?${regexPattern}`;
  }

    return new RegExp(`^${regexPattern}$`, 'i');
}

export { decodeBase64Unicode, encodeUnicodeToBase64, wildcardToRegex };