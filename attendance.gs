function onEdit(e) {
  const attendanceSheetName = "EarnedTokens";
  const transactionSheetName = "Transactions";
  const studentsSheetName = "Students";

  const editedSheet = e.range.getSheet();
  const col = e.range.getColumn();
  const row = e.range.getRow();
  const value = e.range.getValue();

  if (editedSheet.getName() !== attendanceSheetName || col < 3 || typeof value !== 'number' || value <= 0) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transactionSheet = ss.getSheetByName(transactionSheetName);
  const studentsSheet = ss.getSheetByName(studentsSheetName);

  const email = editedSheet.getRange(row, 1).getValue();
  const name = editedSheet.getRange(row, 2).getValue();
  const discussionLabel = editedSheet.getRange(1, col).getValue();
  
  const description = `Attended ${discussionLabel}`;
  const amount = value;
  const type = "earned";

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  try {
    const transactionData = transactionSheet.getDataRange().getValues();
    const headers = transactionData[0];
    const emailIdx = headers.indexOf("Email");
    const descIdx = headers.indexOf("Description");
    
    const alreadyLogged = transactionData.slice(1).some(transRow =>
      transRow[emailIdx] === email && transRow[descIdx] === description
    );
    if (alreadyLogged) {
      Logger.log(`Transaction for ${email} - ${description} already exists. Skipping.`);
      return;
    }

    const studentData = studentsSheet.getDataRange().getValues();
    const studentHeaders = studentData[0];
    const sEmailCol = studentHeaders.indexOf("Email");
    const totalCol = studentHeaders.indexOf("TotalTokens");

    let studentRowIndex = -1;
    for (let i = 1; i < studentData.length; i++) {
      if (studentData[i][sEmailCol] === email) {
        studentRowIndex = i;
        break;
      }
    }

    if (studentRowIndex === -1) {
      Logger.log(`Student with email ${email} not found.`);
      return;
    }
    
    const newTransaction = [
      new Date(), email, name, amount, description, "N/A", "earned"
    ];
    transactionSheet.appendRow(newTransaction);
    
    const currentTotalTokens = studentsSheet.getRange(studentRowIndex + 1, totalCol + 1).getValue();
    
    studentsSheet.getRange(studentRowIndex + 1, totalCol + 1).setValue(Number(currentTotalTokens) + amount);

  } catch (e) {
    Logger.log("Error during attendance update: " + e.toString());
  } finally {
    lock.releaseLock();
  }
}
