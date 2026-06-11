// =============================================================================
// ROOM EXPENSE MODULE — RoomExpense.gs
// =============================================================================
//
// Sheet columns (HEADERS.ROOM_EXPENSE, 0-based):
//   0 ExpenseID   1 RoomID   2 Category   3 Amount   4 Description
//   5 ExpenseDate  6 CreatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addRoomExpense(data) {
  return withUserLock(function() {
  try {
    var date        = trimStr(data.date        || "");
    var amount      = toNumber(data.amount,      0);
    var category    = trimStr(data.category    || "");
    var roomId      = trimStr(data.roomId      || "");
    var description = trimStr(data.description || "");

    if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(category))         return errorResponse("Category is required.",             ERROR_CODES.MISSING_FIELD);

    var expenseId = getNextId("ROOM_EXPENSE");
    var ts        = formatDateTime(now());
    var row = [expenseId, roomId, category, roundTo2(amount), description, date, ts];

    appendRow(SHEETS.ROOM_EXPENSE, row);

    _addLedgerEntry({
      entryDate  : date,
      entryType  : LEDGER_TYPES.EXPENSE,
      category   : "Room Expense",
      subCategory: category,
      referenceId: expenseId,
      description: description || category,
      debit      : roundTo2(amount),
      credit     : 0,
    });

    return successResponse(_reRowToObj(row), expenseId + " — Room expense recorded successfully.");
  } catch (e) {
    return handleError(e, "addRoomExpense");
  }
  }, 6000);
}

function updateRoomExpense(expenseId, data) {
  return withUserLock(function() {
  try {
    var date        = trimStr(data.date        || "");
    var amount      = toNumber(data.amount,      0);
    var category    = trimStr(data.category    || "");
    var roomId      = trimStr(data.roomId      || "");
    var description = trimStr(data.description || "");

    if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(category))         return errorResponse("Category is required.",             ERROR_CODES.MISSING_FIELD);

    var rowIdx = findRowById(SHEETS.ROOM_EXPENSE, expenseId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.ROOM_EXPENSE);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.ROOM_EXPENSE.length).getValues()[0];

    var row = [expenseId, roomId, category, roundTo2(amount), description, date, existing[6]];
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

    _updateLedgerEntry(expenseId, LEDGER_TYPES.EXPENSE, roundTo2(amount), 0);
    return successResponse(_reRowToObj(row), "Room expense updated.");
  } catch (e) {
    return handleError(e, "updateRoomExpense");
  }
  }, 6000);
}

function deleteRoomExpense(expenseId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.ROOM_EXPENSE, expenseId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);
    _removeLedgerEntry(expenseId);
    getSheet(SHEETS.ROOM_EXPENSE).deleteRow(rowIdx);
    return successResponse({ expenseId: expenseId }, "Room expense deleted.");
  } catch (e) {
    return handleError(e, "deleteRoomExpense");
  }
  }, 6000);
}

function listRoomExpenses(filters) {
  try {
    var rows  = getSheetData(SHEETS.ROOM_EXPENSE);
    var items = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_reRowToObj);

    if (filters) {
      if (filters.category) items = items.filter(function(i) { return i.category === filters.category; });
      if (filters.dateFrom) items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)   items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.expenseId.toLowerCase().indexOf(q)   !== -1 ||
                 i.description.toLowerCase().indexOf(q) !== -1 ||
                 i.category.toLowerCase().indexOf(q)    !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch (e) {
    return handleError(e, "listRoomExpenses");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _reRowToObj(row) {
  return {
    expenseId  : String(row[0]),
    roomId     : String(row[1] || ""),
    category   : String(row[2] || ""),
    amount     : toNumber(row[3], 0),
    description: String(row[4] || ""),
    date       : row[5] ? formatDate(row[5]) : "",
    createdAt  : row[6] ? formatDateTime(row[6]) : "",
  };
}
