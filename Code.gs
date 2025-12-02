// This is the Google Apps Script code that will power your token tracker dashboard

// Global variables
let SHEET_ID = 'UPDATE WITH SHEET ID'; 
let STUDENT_SHEET = 'Students';
let TRANSACTIONS_SHEET = 'Transactions';
const GRADEBOOK_SHEET = 'Gradebook';
const ATTENDANCE_SHEET = 'Attendance';

/**
 * Creates the web app UI
 */
function doGet(e) {
  const userEmail = Session.getActiveUser().getEmail();

  if (!userEmail) {
    return HtmlService.createHtmlOutput('<h1>Please log in with your school Google account to access the token dashboard.</h1>')
      .setTitle('[UPDATE WITH COURSE TITLE] Token Dashboard - Login Required');
  }

  let htmlOutput = HtmlService.createTemplateFromFile('Index');
  htmlOutput.userEmail = userEmail;

  return htmlOutput.evaluate()
    .setTitle('UPDATE WITH COURSE TITLE')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Gets all student data (tokens, grades, attendance, check-ins) for the current user
 */
function getStudentData() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. Get student token data from the Students sheet
  const studentSheet = ss.getSheetByName(STUDENT_SHEET);
  const studentData = studentSheet.getDataRange().getValues();
  const studentHeaders = studentData.shift();

  let studentDashboardData = null;
  for (let i = 0; i < studentData.length; i++) {
    if (studentData[i][studentHeaders.indexOf('Email')] === userEmail) {
      studentDashboardData = {
        name: studentData[i][studentHeaders.indexOf('Name')],
        email: userEmail,
        totalTokens: studentData[i][studentHeaders.indexOf('TotalTokens')],
        usedTokens: studentData[i][studentHeaders.indexOf('UsedTokens')]
      };
      studentDashboardData.availableTokens = studentDashboardData.totalTokens - studentDashboardData.usedTokens;
      break;
    }
  }

  if (!studentDashboardData) {
    return null; // Student not found
  }

  // 2. Get grade data from the Gradebook sheet AND check-in count
  const gradebookSheet = ss.getSheetByName(GRADEBOOK_SHEET);
  const gradebookData = gradebookSheet.getDataRange().getValues();
  const gradebookHeaders = gradebookData.shift();
  
  const studentGrades = [];
// UPDATE WITH ASSIGNMENTS FOR YOUR COURSE 
  const hwAssignments = ['HW #1', 'HW #2', 'HW #3', 'HW #4']; 
  let totalCheckins = 0;

  for (let i = 0; i < gradebookData.length; i++) {
    if (gradebookData[i][gradebookHeaders.indexOf('Email')] === userEmail) {
      // Loop through the defined order to get grades
      hwAssignments.forEach(hwName => {
        const grade = gradebookData[i][gradebookHeaders.indexOf(hwName)] || '-';
        studentGrades.push({
          assignment: hwName,
          grade: grade
        });
      });
      
      // UPDATE WITH CHECK INS FOR COURSE (IF APPLICABLE)
      const headers = gradebookHeaders.slice(gradebookHeaders.indexOf('CheckIn#1'));
      for (let j = 0; j < headers.length; j++) {
        if (headers[j].startsWith('CheckIn#') && gradebookData[i][gradebookHeaders.indexOf(headers[j])] === 1) {
          totalCheckins++;
        }
      }
      break;
    }
  }
  studentDashboardData.grades = studentGrades;
  studentDashboardData.totalCheckins = totalCheckins; // Add the new metric
  
  // 3. Get attendance data from the Attendance sheet
  const attendanceSheet = ss.getSheetByName(ATTENDANCE_SHEET);
  const attendanceData = attendanceSheet.getDataRange().getValues();
  const attendanceHeaders = attendanceData.shift();

  let attendedCount = 0;
  for (let i = 0; i < attendanceData.length; i++) {
    if (attendanceData[i][attendanceHeaders.indexOf('Email')] === userEmail) {
      for (let j = 2; j < attendanceData[i].length; j++) {
        if (attendanceData[i][j] === 1) {
          attendedCount++;
        }
      }
      break;
    }
  }
  studentDashboardData.attendedClasses = attendedCount;

  return studentDashboardData;
}

 

/**
 * Gets transaction history for the current user
 */
function getTransactionHistory() {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const transactionSheet = ss.getSheetByName(TRANSACTIONS_SHEET);

  const transactionData = transactionSheet.getDataRange().getValues();
  const headers = transactionData.shift();

  const studentTransactions = transactionData.filter(row =>
    row[headers.indexOf('Email')] === userEmail
  ).map(row => {
    return {
      date: Utilities.formatDate(new Date(row[headers.indexOf('Date')]), Session.getScriptTimeZone(), 'MM/dd/yyyy'),
      description: row[headers.indexOf('Description')],
      amount: row[headers.indexOf('Amount')],
      type: row[headers.indexOf('Type')],
      assignment: row[headers.indexOf('Assignment')] || 'N/A'
    };
  });
  return studentTransactions;
}

/**
 * Allows students to submit a token spending request.
 */
function submitTokenRequest(requestType, assignmentName) {
  const userEmail = Session.getActiveUser().getEmail();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const transactionSheet = ss.getSheetByName(TRANSACTIONS_SHEET);
  const studentSheet = ss.getSheetByName(STUDENT_SHEET);

  let tokenCost = 0;
  let description = '';

  switch (requestType) {
    case 'extension24':
      tokenCost = 1;
      description = 'Assignment Extension (24 Hours)';
      break;
    case '1StepResubmission':
      tokenCost = 1;
      description = '1 Step Resubmission';
      break;
    case '2StepResubmission':
      tokenCost = 2;
      description = '2 Step Resubmission';
      break;
    default:
      return { success: false, message: 'Invalid request type.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  try {
    const studentData = studentSheet.getDataRange().getValues();
    const headers = studentData[0];
    const emailColIndex = headers.indexOf("Email");
    const totalTokensColIndex = headers.indexOf("TotalTokens");
    const usedTokensColIndex = headers.indexOf("UsedTokens");
    const nameColIndex = headers.indexOf("Name");

    let studentRowIndex = -1;
    for (let i = 1; i < studentData.length; i++) {
      if (studentData[i][emailColIndex] === userEmail) {
        studentRowIndex = i;
        break;
      }
    }

    if (studentRowIndex === -1) {
      return { success: false, message: '⚠️ Student not found in the Students sheet.' };
    }
    
    const studentRowData = studentSheet.getRange(studentRowIndex + 1, 1, 1, headers.length).getValues()[0];
    
    const totalTokens = studentRowData[totalTokensColIndex];
    const usedTokens = studentRowData[usedTokensColIndex];
    const availableTokens = totalTokens - usedTokens;
    const studentName = studentRowData[nameColIndex];

    if (availableTokens < tokenCost) {
      return {
        success: false,
        message: "🚫 You don't have enough tokens for this request. You need " +
          tokenCost + " token(s), but you only have " + availableTokens + "."
      };
    }

    const newTransaction = [
      new Date(),
      userEmail,
      studentName,
      -tokenCost,
      description,
      assignmentName || "",
      "spent"
    ];
    transactionSheet.appendRow(newTransaction);

    const newUsedTokens = usedTokens + tokenCost;
    studentSheet.getRange(studentRowIndex + 1, usedTokensColIndex + 1).setValue(newUsedTokens);

    return {
      success: true,
      message: '✅ Your request has been submitted and tokens have been deducted.'
    };

  } catch (e) {
    Logger.log(e.toString());
    return { success: false, message: 'An error occurred while processing your request. Please try again.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Include HTML files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
