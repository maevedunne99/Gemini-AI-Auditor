/**
 * Adds a custom menu to Google Sheets upon opening to streamline QA execution.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('QA Tools')
      .addItem('Run AI Sanity Check (Selected Row)', 'executeAiSanityCheckForSelectedRow')
      .addToUi();
}

/**
 * Validates the active user selection and triggers the AI evaluation workflow.
 */
function executeAiSanityCheckForSelectedRow() {
  var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var currentRow = activeSheet.getActiveCell().getRow();
  
  // Ensure the user selected a valid data row (row 2 or below)
  if (currentRow < 2) {
    SpreadsheetApp.getUi().alert('Please select a valid data row (row 2 or below).');
    return;
  }
  
  processRowEvaluation(activeSheet, currentRow);
}

/**
 * Core evaluation engine: reads row parameters including image link, queries the LLM, and writes results.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The active sheet.
 * @param {number} rowIndex - The index of the row being evaluated.
 */
function processRowEvaluation(sheet, rowIndex) {
  // Extract dataset fields from specified columns
  var rowData = {
    userQuery: sheet.getRange(rowIndex, 1).getValue(),      // Column A
    imageUrl: sheet.getRange(rowIndex, 2).getValue(),       // Column B
    vertical: sheet.getRange(rowIndex, 3).getValue(),       // Column C
    subCategory: sheet.getRange(rowIndex, 4).getValue(),    // Column D
    targetEntities: sheet.getRange(rowIndex, 5).getValue(), // Column E
    primarySources: sheet.getRange(rowIndex, 6).getValue()  // Column F
  };

  // Build the comprehensive evaluation prompt based on QA Guidelines
  var evaluationPrompt = buildSanityCheckPrompt(rowData);

  // Call the Gemini API model securely, passing both the prompt and the image URL
  var aiEvaluationResult = fetchGuidelineValidationFromGemini(evaluationPrompt, rowData.imageUrl);

  // Write the resulting evaluation comment into Column G (QA Comment)
  sheet.getRange(rowIndex, 7).setValue(aiEvaluationResult);

  // Automatically set Column H (QA Result) to "Good" if verification passes
  if (aiEvaluationResult.indexOf("[PASS]") !== -1) {
    sheet.getRange(rowIndex, 8).setValue("Good");
  }
}

/**
 * Constructs the structured prompt text incorporating sample Data Labeling Guidelines.
 * @param {Object} data - Object containing row data fields.
 * @return {string} Formatted prompt string.
 */
function buildSanityCheckPrompt(data) {
  return "You are an expert QA Auditor for a Data Annotation project. " +
    "Evaluate this row against the following Data Quality Guidelines:\n" +
    "- User Query: " + data.userQuery + "\n" +
    "- Category / Sub-Category: " + data.vertical + " / " + data.subCategory + "\n" +
    "- Expected Entities: " + data.targetEntities + "\n" +
    "- Primary Sources: " + data.primarySources + "\n\n" +
    "GENERAL RULE: The 'User Query' is OPTIONAL. Do NOT flag the row simply because this field is empty. If absent, proceed with evaluating the row based on the attached image and other available metadata.\n\n" +
    "Comprehensive Rubric Rules to Enforce:\n" +
    "1. Fact Grounding & Intent: Extract data strictly without speculation. Transcribe literal values character-for-character, and cite sources explicitly for multi-document tasks. Avoid extraneous biographical trivia or unasked details.\n" +
    "2. Input Triage & Flawed States: Check if unreadable media is marked 'UNCLEAR' or 'ILLEGIBLE'. Truncated content must use 'TRUNCATED' with a clarification specifier. Flawed inputs require a reason and object type.\n" +
    "3. People Guidelines: Public figures require explicit identification and optional context. Private individuals MUST NOT have inferred identities or sensitive personal information—only objective visual attributes.\n" +
    "4. Spatial Positioning & Media Context: For multiple objects/individuals, ensure proper numbering and spatial positioning tags (e.g., left, right, center). For media queries, ensure both the character/object AND the source media are identified.\n" +
    "5. Shopping & Pricing Boundaries: For Multi-Object Shopping, include core apparel/footwear/bags and omit background scenery. Do NOT collect price ground truth unless explicitly requested.\n" +
    "6. Attached Documents & Receipts: Check extraction requirements for research comparisons, receipts (date, merchant, amount including tax/tips), and chronological troubleshooting steps.\n" +
    "7. Special Cases & Formatting: Check open-ended queries and multi-turn queries. Format math equations in standard LaTeX syntax (e.g., \\lim_{...}), and use single quotes instead of double quotes.\n" +
    "8. Schema & Entity Prefix Verification: Cross-reference the Category against the Expected Entities. General categories should use standard object prefixes (e.g., OBJ_NAME), while specialized categories should use specific prefixes (e.g., PROD_NAME). Mismatched prefixes must trigger a [FLAG - Review Required].\n" +
    "9. Visual Verification (Image Analysis): If an image is attached to this request, visually inspect it to verify claims about spatial positioning, verify that Expected Entities accurately reflect what is visible, and confirm there is no truncated or unreadable media.\n\n" +
    "Provide a concise QA comment (under 30 words) starting with either '[PASS]' or '[FLAG - Review Required]' followed by your reasoning.";
}

/**
 * Communicates with the Gemini API securely using Script Properties, supporting multimodal image input.
 * @param {string} promptText - The prompt instructions for the model.
 * @param {string} imageUrl - The image URL.
 * @return {string} The model's evaluation response or error string.
 */
function fetchGuidelineValidationFromGemini(promptText, imageUrl) {
  var scriptApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!scriptApiKey) {
    return "[ERROR]: GEMINI_API_KEY not set in Script Properties.";
  }

  var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + scriptApiKey;
  
  // Initialize parts array with the text prompt
  var contentParts = [{"text": promptText}];

  // If the link contains a valid image URL, fetch and attach it as multimodal inline data
  if (imageUrl && typeof imageUrl === "string" && imageUrl.trim() !== "") {
    try {
      var imageResponse = UrlFetchApp.fetch(imageUrl);
      var imageBlob = imageResponse.getBlob();
      var base64Data = Utilities.base64Encode(imageBlob.getBytes());
      var contentType = imageBlob.getContentType() || "image/jpeg";
      
      contentParts.push({
        "inlineData": {
          "mimeType": contentType,
          "data": base64Data
        }
      });
    } catch (imageError) {
      // Graceful fallback if image download fails or link is invalid
      contentParts[0].text += "\n[Note: Image could not be loaded: " + imageError.message + "]";
    }
  }

  var requestPayload = {
    "contents": [{
      "parts": contentParts
    }]
  };

  var requestOptions = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(requestPayload),
    "muteHttpExceptions": true
  };

  try {
    var apiResponse = UrlFetchApp.fetch(apiUrl, requestOptions);
    var rawResponseBody = apiResponse.getContentText();
    var parsedJsonResponse = JSON.parse(rawResponseBody);
    
    if (parsedJsonResponse.error) {
      return "[API ERROR " + parsedJsonResponse.error.code + "]: " + parsedJsonResponse.error.message;
    }
    
    if (parsedJsonResponse.candidates && 
        parsedJsonResponse.candidates[0].content && 
        parsedJsonResponse.candidates[0].content.parts && 
        parsedJsonResponse.candidates[0].content.parts[0].text) {
      return parsedJsonResponse.candidates[0].content.parts[0].text.trim();
    } else {
      return "[DEBUG PARSE ERROR]: " + rawResponseBody.substring(0, 100);
    }
  } catch (exception) {
    return "[ERROR]: Exception - " + exception.message;
  }
}
