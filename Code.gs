// This is the Google Apps Script code that will power your token tracker dashboard

// Global variables
let SHEET_ID = '1NN8VhxDp7kxuS7M46Yg_bu-DvTydzgQlTJyyg7E3EPI'; 
let STUDENT_SHEET = 'Students';
let TRANSACTIONS_SHEET = 'Transactions';

/**
 * Creates the web app UI
 */
function doGet(e) {
  const userEmail = Session.getActiveUser().getEmail();
  
  // Check if user is authenticated
  if (!userEmail) {
    return HtmlService.createHtmlOutput('<h1>Please log in with your school Google account to access the token dashboard.</h1>')
      .setTitle('EDS 223 Token Dashboard - Login Required');
  }
  
  // Create the main UI
  let htmlOutput = HtmlService.createTemplateFromFile('Index');
  htmlOutput.userEmail = userEmail;
  
  return htmlOutput.evaluate()
    .setTitle('EDS 223 Token Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Gets student data for the current user
 */
function getStudentData() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const studentSheet = ss.getSheetByName(STUDENT_SHEET);
  
  const studentData = studentSheet.getDataRange().getValues();
  const headers = studentData.shift(); // Get headers and remove from data
  
  // Find the current student's row
  for (let i = 0; i < studentData.length; i++) {
    if (studentData[i][headers.indexOf('Email')] === userEmail) {
      return {
        name: studentData[i][headers.indexOf('Name')],
        email: userEmail,
        totalTokens: studentData[i][headers.indexOf('TotalTokens')],
        usedTokens: studentData[i][headers.indexOf('UsedTokens')],
        availableTokens: studentData[i][headers.indexOf('TotalTokens')] - studentData[i][headers.indexOf('UsedTokens')]
      };
    }
  }
  
  return null; // Student not found
}

/**
 * Gets transaction history for the current user
 */
function getTransactionHistory() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const transactionSheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  
  const transactionData = transactionSheet.getDataRange().getValues();
  const headers = transactionData.shift(); // Get headers and remove from data
  
  // Find assignment column index
  const assignmentColIndex = headers.indexOf('Assignment');
  
  // Filter transactions for current student
  const studentTransactions = transactionData.filter(row => 
    row[headers.indexOf('Email')] === userEmail
  ).map(row => {
    return {
      date: Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'MM/dd/yyyy'),
      description: row[headers.indexOf('Description')],
      amount: row[headers.indexOf('Amount')],
      type: row[headers.indexOf('Type')], // 'earned' or 'spent'
      assignment: assignmentColIndex !== -1 ? row[assignmentColIndex] : 'N/A'
    };
  });
  
  return studentTransactions;
}

/**
 * Allows students to submit a token spending request
 */
function submitTokenRequest(requestType, assignmentName) {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const transactionSheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  const studentSheet = ss.getSheetByName(STUDENT_SHEET);

  const studentSheetData = studentSheet.getDataRange().getValues();
  const studentHeaders = studentSheetData[0];
  const emailCol = studentHeaders.indexOf("Email");
  const totalCol = studentHeaders.indexOf("TotalTokens");
  const usedCol = studentHeaders.indexOf("UsedTokens");
  const availCol = studentHeaders.indexOf("Available Tokens");

  const transData = transactionSheet.getDataRange().getValues();
  const transHeaders = transData[0];
  const transEmailCol = transHeaders.indexOf("Email");
  const transAmountCol = transHeaders.indexOf("Amount");
  const transTypeCol = transHeaders.indexOf("Type");
  const assignmentCol = transHeaders.indexOf("Assignment");

  const userTransactions = transData.filter(row => row[transEmailCol] === userEmail);

  const totalEarned = userTransactions
    .filter(row => row[transTypeCol] === "earned")
    .reduce((sum, row) => sum + Number(row[transAmountCol]), 0);

  const totalUsed = userTransactions
    .filter(row => row[transTypeCol] === "spent")
    .reduce((sum, row) => sum + Math.abs(Number(row[transAmountCol])), 0);

  const available = totalEarned - totalUsed;

  // Determine request cost
  let tokenCost = 0;
  let description = '';

  if (requestType === 'extension24') {
    tokenCost = 1;
    description = 'Assignment Extension (24 Hours)';
  } else if (requestType === '1StepResubmission') {
    tokenCost = 1;
    description = '1 Step Resubmission';
  } else if (requestType === '2StepResubmission') {
    tokenCost = 2;
    description = '2 Step Resubmission';
  } else {
    return { success: false, message: 'Invalid request type' };
  }

  // Final token check
  if (available < tokenCost) {
    return { success: false, message:"🚫 You don't have enough tokens for this request. You need " + tokenCost +
             " token" + (tokenCost > 1 ? "s" : "") + ", but you  have " + available + "." };
  }

  // Get the student name
  let studentName = "";
  for (let i = 1; i < studentSheetData.length; i++) {
    if (studentSheetData[i][emailCol] === userEmail) {
      studentName = studentSheetData[i][studentHeaders.indexOf("Name")];
      break;
    }
  }

  // Prepare transaction row
  const newRow = [new Date(), userEmail, studentName, -tokenCost, description, "spent", ""];
  
  // Add assignment name if the column exists
  if (assignmentCol !== -1) {
    // Make sure the row has enough elements
    while (newRow.length <= assignmentCol) {
      newRow.push("");
    }
    newRow[assignmentCol] = assignmentName;
  }

  // Append transaction
  transactionSheet.appendRow(newRow);

  // Update Students sheet
  for (let i = 1; i < studentSheetData.length; i++) {
    if (studentSheetData[i][emailCol] === userEmail) {
      studentSheet.getRange(i + 1, totalCol + 1).setValue(totalEarned);
      studentSheet.getRange(i + 1, usedCol + 1).setValue(totalUsed + tokenCost);
      studentSheet.getRange(i + 1, availCol + 1).setValue(totalEarned - (totalUsed + tokenCost));
      break;
    }
  }

  return {
    success: true,
    message: 'Your request has been submitted and tokens have been deducted.'
  };
}

/**
 * Include HTML files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
