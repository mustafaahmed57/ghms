// =============================================================================
// KITCHEN EXPENSE MODULE — KitchenExpense.gs
// =============================================================================
//
// Sheet columns (HEADERS.KITCHEN_EXPENSE, 0-based):
//   0 ExpenseID   1 Category   2 Items   3 Amount   4 Vendor
//   5 ExpenseDate  6 CreatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addKitchenExpense(data) {
  return withUserLock(function() {
  try {
    var date        = trimStr(data.date        || "");
    var amount      = toNumber(data.amount,      0);
    var category    = trimStr(data.category    || "");
    var items       = trimStr(data.items       || "");
    var vendor      = trimStr(data.vendor      || "");

    if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(category))         return errorResponse("Category is required.",             ERROR_CODES.MISSING_FIELD);

    var expenseId = getNextId("KITCHEN_EXPENSE");
    var ts        = formatDateTime(now());
    var row = [expenseId, category, items, roundTo2(amount), vendor, date, ts];

    appendRow(SHEETS.KITCHEN_EXPENSE, row);

    _addLedgerEntry({
      entryDate  : date,
      entryType  : LEDGER_TYPES.EXPENSE,
      category   : "Kitchen Expense",
      subCategory: category,
      referenceId: expenseId,
      description: items || vendor || category,
      debit      : roundTo2(amount),
      credit     : 0,
    });

    return successResponse(_keRowToObj(row), expenseId + " — Kitchen expense recorded successfully.");
  } catch (e) {
    return handleError(e, "addKitchenExpense");
  }
  }, 6000);
}

function updateKitchenExpense(expenseId, data) {
  return withUserLock(function() {
  try {
    var date        = trimStr(data.date        || "");
    var amount      = toNumber(data.amount,      0);
    var category    = trimStr(data.category    || "");
    var items       = trimStr(data.items       || "");
    var vendor      = trimStr(data.vendor      || "");

    if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(category))         return errorResponse("Category is required.",             ERROR_CODES.MISSING_FIELD);

    var rowIdx = findRowById(SHEETS.KITCHEN_EXPENSE, expenseId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.KITCHEN_EXPENSE);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.KITCHEN_EXPENSE.length).getValues()[0];

    var row = [expenseId, category, items, roundTo2(amount), vendor, date, existing[6]];
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

    _updateLedgerEntry(expenseId, LEDGER_TYPES.EXPENSE, roundTo2(amount), 0);
    return successResponse(_keRowToObj(row), "Kitchen expense updated.");
  } catch (e) {
    return handleError(e, "updateKitchenExpense");
  }
  }, 6000);
}

function deleteKitchenExpense(expenseId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.KITCHEN_EXPENSE, expenseId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);
    _removeLedgerEntry(expenseId);
    getSheet(SHEETS.KITCHEN_EXPENSE).deleteRow(rowIdx);
    return successResponse({ expenseId: expenseId }, "Kitchen expense deleted.");
  } catch (e) {
    return handleError(e, "deleteKitchenExpense");
  }
  }, 6000);
}

function listKitchenExpenses(filters) {
  try {
    var rows  = getSheetData(SHEETS.KITCHEN_EXPENSE);
    var items = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_keRowToObj);

    if (filters) {
      if (filters.category) items = items.filter(function(i) { return i.category === filters.category; });
      if (filters.dateFrom) items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)   items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.expenseId.toLowerCase().indexOf(q) !== -1 ||
                 i.items.toLowerCase().indexOf(q)     !== -1 ||
                 i.category.toLowerCase().indexOf(q)  !== -1 ||
                 i.vendor.toLowerCase().indexOf(q)    !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch (e) {
    return handleError(e, "listKitchenExpenses");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _keRowToObj(row) {
  return {
    expenseId: String(row[0]),
    category : String(row[1] || ""),
    items    : String(row[2] || ""),
    amount   : toNumber(row[3], 0),
    vendor   : String(row[4] || ""),
    date     : row[5] ? formatDate(row[5]) : "",
    createdAt: row[6] ? formatDateTime(row[6]) : "",
  };
}
