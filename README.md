# DeepSync Chrome Extension

DeepSync is a Chrome extension that allows you to sync code blocks from chat platforms (like ChatGPT or DeepSeek Chat) directly to your GitHub repository. It also provides the ability to fetch entire GitHub projects based on a `config.json` file.

---

## Features

- **Sync Code to GitHub**:
  - Update or create files in your GitHub repository directly from chat platforms.
  - Supports both existing and new files.

- **Fetch GitHub Projects**:
  - Fetch entire GitHub projects based on a `config.json` file.
  - Combine the content of specified files and copy it to the clipboard.

- **User-Friendly Interface**:
  - Adds "Update Git" buttons to code blocks in chat platforms.
  - Displays toast notifications for success or error messages.

- **Configuration**:
  - Configure the repository name and GitHub token in the popup menu.
  - Supports wildcard patterns for including or excluding files.

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/deepsync.git
   cd deepsync