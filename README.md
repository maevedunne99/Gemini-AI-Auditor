# Gemini-AI-Auditor

📌 1. Overview \
This repository contains a Google Apps Script (GAS) solution that integrates Google Sheets with the Gemini API to automate Quality Assurance (QA) and auditing for data labeling tasks.

By adding a custom menu to your spreadsheet, data auditors can trigger an automated sanity check on any selected row. The script evaluates both text content and linked images against predefined quality guidelines, depositing Auditor comments and pass/fail statuses directly back into designated columns.

🛠️ 2. Code Architecture & Method \
The script is modular and divided into four primary components:

A. Custom UI Injection (onOpen)
 - Hooks into the native Google Sheets UI to create a custom dropdown menu (QA Tools). This allows reviewers to run audits on-demand without needing to interact with the script editor.

B. Row Processing Engine (processRowEvaluation)
 - Identifies the active row selected by the user.
 - Reads data from customizable columns (e.g., User Query, Image Link, Category, Expected Outputs).
 - Coordinates the prompt-building and API-calling functions.
 - Writes the evaluation output and status back to the sheet.
   
C. Multimodal Prompt Construction (buildSanityCheckPrompt)
 - Compiles a structured prompt using standard Prompt Engineering principles:

_**Role Definition:**_ Instructs the model to act as an expert QA Auditor.

_**Context Injection:**_ Passes the row-specific data (Query, Category, etc.).

_**Rules & Constraints:**_ Defines specific validation rules (e.g., fact grounding, PII handling, formatting restrictions).

_**Output Formatting:**_ Constrains the AI to return predefined tokens ([PASS] or [FLAG]) for easy programmatic parsing.

D. Secure Gemini API Fetch (fetchGuidelineValidationFromGemini)
 - Retrieves standard image formats (JPEG, PNG, etc.) via URL.
 - Converts image binaries to Base64 inline data.
 - Bundles text prompts and visual media into the required multimodal JSON payload.
 - Calls the Gemini API endpoint securely using GAS UrlFetchApp.

☁️ 3. API Integration & GCP Setup \
The automation utilizes the Generative Language API via Google Cloud (GCP) or Google AI Studio.

Prerequisites: \
A Gemini API Key generated via Google AI Studio or the Google Cloud Console & the Generative Language API must be enabled in your linked project.

🔐 Securing the API Key
To protect your credentials, this script avoids hardcoding API keys in plain text. Instead, it uses GAS Properties Service:

 - In your Apps Script editor, go to Project Settings.
 - Under Script Properties, add a property named GEMINI_API_KEY.
 - Paste your key in the value field.
 - The script retrieves this key dynamically via PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY').

📋 4. Configuration (Column Mapping) \
Spreadsheets vary in layout. You can customize the script to match your specific column indices within the processRowEvaluation function.

Ensure your script corresponds to your spreadsheet columns.

🚀 5. Usage Guide
- Paste the script into your Google Sheets script editor (Extensions > Apps Script).
 - Follow the GCP Setup steps above to insert your GEMINI_API_KEY.
 - Refresh your Google Sheet.
 - Highlight a cell in the row you wish to audit (Row 2 or below).
 - Go to QA Tools > Run AI Sanity Check (Selected Row).

The AI auditor will review the row and post its feedback in the designated comment column.

⚠️ Disclaimer
Model Compatibility: Ensure you are calling a multimodal model (e.g., **gemini-3.5-flash** or newer) to support image payloads.
