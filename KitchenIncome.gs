// =============================================================================
// KITCHEN INCOME MODULE — KitchenIncome.gs
// =============================================================================
//
// Sheet columns (HEADERS.KITCHEN_INCOME, 0-based):
//   0 IncomeID   1 BookingID   2 GuestID   3 Category   4 Items
//   5 Amount     6 PaymentMethod  7 IncomeDate  8 CreatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addKitchenIncome(data) {
  return withUserLock(function() {
  try {
    var date          = trimStr(data.date          || "");
    var amount        = toNumber(data.amount,        0);
    var category      = trimStr(data.category      || "");
    var paymentMethod = trimStr(data.paymentMethod || "");
    var items         = trimStr(data.items         || "");
    var bookingId     = trimStr(data.bookingId     || "");

    if (isBlank(date))             return errorResponse("Date is required.",                  ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.",  ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",         ERROR_CODES.MISSING_FIELD);

    var incomeId = getNextId("KITCHEN_INCOME");
    var ts       = formatDateTime(now());
    var row = [incomeId, bookingId, "", category, items, roundTo2(amount), paymentMethod, date, ts];

    appendRow(SHEETS.KITCHEN_INCOME, row);

    _addLedgerEntry({
      entryDate  : date,
      entryType  : LEDGER_TYPES.INCOME,
      category   : "Kitchen Income",
      subCategory: category || "Kitchen Income",
      referenceId: incomeId,
      description: items || category || "Kitchen Income",
      debit      : 0,
      credit     : roundTo2(amount),
    });

    return successResponse(_kiRowToObj(row), incomeId + " — Kitchen income recorded successfully.");
  } catch (e) {
    return handleError(e, "addKitchenIncome");
  }
  }, 6000);
}

function updateKitchenIncome(incomeId, data) {
  return withUserLock(function() {
  try {
    var date          = trimStr(data.date          || "");
    var amount        = toNumber(data.amount,        0);
    var category      = trimStr(data.category      || "");
    var paymentMethod = trimStr(data.paymentMethod || "");
    var items         = trimStr(data.items         || "");
    var bookingId     = trimStr(data.bookingId     || "");

    if (isBlank(date))             return errorResponse("Date is required.",                  ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.",  ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",         ERROR_CODES.MISSING_FIELD);

    var rowIdx = findRowById(SHEETS.KITCHEN_INCOME, incomeId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.KITCHEN_INCOME);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.KITCHEN_INCOME.length).getValues()[0];

    var row = [incomeId, bookingId, existing[2], category, items, roundTo2(amount), paymentMethod, date, existing[8]];
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

    _updateLedgerEntry(incomeId, LEDGER_TYPES.INCOME, 0, roundTo2(amount));
    return successResponse(_kiRowToObj(row), "Kitchen income entry updated.");
  } catch (e) {
    return handleError(e, "updateKitchenIncome");
  }
  }, 6000);
}

function deleteKitchenIncome(incomeId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.KITCHEN_INCOME, incomeId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);
    _removeLedgerEntry(incomeId);
    getSheet(SHEETS.KITCHEN_INCOME).deleteRow(rowIdx);
    return successResponse({ incomeId: incomeId }, "Kitchen income entry deleted.");
  } catch (e) {
    return handleError(e, "deleteKitchenIncome");
  }
  }, 6000);
}

function listKitchenIncomes(filters) {
  try {
    var rows  = getSheetData(SHEETS.KITCHEN_INCOME);
    var items = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_kiRowToObj);

    if (filters) {
      if (filters.category)      items = items.filter(function(i) { return i.category      === filters.category; });
      if (filters.paymentMethod) items = items.filter(function(i) { return i.paymentMethod === filters.paymentMethod; });
      if (filters.dateFrom)      items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)        items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.incomeId.toLowerCase().indexOf(q) !== -1 ||
                 i.items.toLowerCase().indexOf(q)    !== -1 ||
                 i.category.toLowerCase().indexOf(q) !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch (e) {
    return handleError(e, "listKitchenIncomes");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _kiRowToObj(row) {
  return {
    incomeId     : String(row[0]),
    bookingId    : String(row[1] || ""),
    category     : String(row[3] || ""),
    items        : String(row[4] || ""),
    amount       : toNumber(row[5], 0),
    paymentMethod: String(row[6] || ""),
    date         : row[7] ? formatDate(row[7]) : "",
    createdAt    : row[8] ? formatDateTime(row[8]) : "",
  };
}
