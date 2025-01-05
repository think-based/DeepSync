// Function to extract the file name from the code
function extractFileName(code) {
  const fileNameRegex = /\/\/FileName:\s*([^\n]+)/; // Regex to match //FileName:[نام فایل]
  const match = code.match(fileNameRegex);
  return match ? match[1].trim() : null; // Return the file name or null if not found
}

// Function to add a "Pull" button next to the "Copy" button
function addPullButton(copyButton, codeText) {
  // Check if a "Pull" button already exists
  if (copyButton.parentNode.querySelector(".pull-button")) {
    return; // Exit if a "Pull" button is already present
  }

  // Create the "Pull" button
  const pullButton = document.createElement("div");
  pullButton.innerText = "Pull";
  pullButton.classList.add("pull-button"); // Add a class for identification
  pullButton.style.marginLeft = "10px";
  pullButton.style.backgroundColor = "#2d9cdb";
  pullButton.style.color = "#fff";
  pullButton.style.border = "none";
  pullButton.style.borderRadius = "4px";
  pullButton.style.padding = "5px 10px";
  pullButton.style.cursor = "pointer";

  // Add click event listener to the "Pull" button
  pullButton.addEventListener("click", () => {
    // Extract the file name from the code
    const defaultFileName = extractFileName(codeText);
    const filePath = prompt("Enter the file path in your repository (e.g., src/index.js):", defaultFileName || "");

    if (filePath) {
      // Send the code and file path to the background script
      chrome.runtime.sendMessage(
        {
          action: "pullCode",
          code: codeText,
          filePath: filePath,
        },
        (response) => {
          if (response.success) {
            alert("File updated successfully!");
          } else {
            alert(`Error: ${response.error}`);
          }
        }
      );
    }
  });

  // Add the "Pull" button next to the "Copy" button
  copyButton.parentNode.insertBefore(pullButton, copyButton.nextSibling);
}

// Function to detect code blocks and add "Pull" buttons
function detectCodeBlocks() {
  const codeBlocks = document.querySelectorAll(".md-code-block"); // Find all code block containers
  codeBlocks.forEach((codeBlock) => {
    const copyButton = codeBlock.querySelector(".ds-markdown-code-copy-button"); // Find the "Copy" button
    const codeText = codeBlock.querySelector("pre")?.innerText; // Extract the code text

    if (copyButton && codeText) {
      addPullButton(copyButton, codeText);
    }
  });
}

// Run the detection periodically to handle dynamically loaded content
setInterval(detectCodeBlocks, 1000);