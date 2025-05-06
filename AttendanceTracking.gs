function onEdit(e) {
  const attendanceSheetName = "EarnedTokens";
  const transactionSheetName = "Transactions";
  const studentsSheetName = "Students";

  const editedSheet = e.range.getSheet();
  const col = e.range.getColumn();
  const row = e.range.getRow();
  const value = e.range.getValue();

  if (editedSheet.getName() !== attendanceSheetName) return;
  if (col < 3) return;
  if (value !== 1) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transactionSheet = ss.getSheetByName(transactionSheetName);
  const studentsSheet = ss.getSheetByName(studentsSheetName);

  const email = editedSheet.getRange(row, 1).getValue();
  const name = editedSheet.getRange(row, 2).getValue();
  const discussionLabel = editedSheet.getRange(1, col).getValue();
  const today = new Date();
  const description = `Attended ${discussionLabel}`;
  const amount = 1;
  const type = "earned";

  // Prevent duplicate entries
  const allTransactions = transactionSheet.getDataRange().getValues();
  const headers = allTransactions[0];
  const emailIdx = headers.indexOf("Email");
  const descIdx = headers.indexOf("Description");

  const alreadyLogged = allTransactions.some(row =>
    row[emailIdx] === email && row[descIdx] === description
  );
  if (alreadyLogged) return;

  // Prepare transaction row with "N/A" for Assignment column
  const newRow = [today, email, name, amount, description, type, ""];
  
  // Add N/A to Assignment column if it exists
  const assignmentIdx = headers.indexOf("Assignment");
  if (assignmentIdx !== -1) {
    // Make sure the row has enough elements
    while (newRow.length <= assignmentIdx) {
      newRow.push("");
    }
    newRow[assignmentIdx] = "N/A"; // For earned tokens, we use N/A
  }

  // Add transaction 
  transactionSheet.appendRow(newRow);

  // Recalculate from updated transaction list
  const updatedTrans = transactionSheet.getDataRange().getValues();
  const emailCol = updatedTrans[0].indexOf("Email");
  const amountCol = updatedTrans[0].indexOf("Amount");
  const typeCol = updatedTrans[0].indexOf("Type");

  const studentTransactions = updatedTrans.slice(1).filter(row => row[emailCol] === email);

  const totalEarned = studentTransactions
    .filter(row => row[typeCol] === "earned")
    .reduce((sum, row) => sum + Number(row[amountCol]), 0);

  const totalUsed = studentTransactions
    .filter(row => row[typeCol] === "spent")
    .reduce((sum, row) => sum + Math.abs(Number(row[amountCol])), 0);

  const available = totalEarned - totalUsed;

  // Update Students sheet
  const studentData = studentsSheet.getDataRange().getValues();
  const studentHeader = studentData[0];
  const sEmailCol = studentHeader.indexOf("Email");
  const totalCol = studentHeader.indexOf("TotalTokens");
  const usedCol = studentHeader.indexOf("UsedTokens");
  const availCol = studentHeader.indexOf("Available Tokens");

  for (let i = 1; i < studentData.length; i++) {
    if (studentData[i][sEmailCol] === email) {
      studentsSheet.getRange(i + 1, totalCol + 1).setValue(totalEarned);
      studentsSheet.getRange(i + 1, usedCol + 1).setValue(totalUsed);
      studentsSheet.getRange(i + 1, availCol + 1).setValue(available);
      break;
    }
  }
}
