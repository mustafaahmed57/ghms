// =============================================================================
// ROOM INCOME MODULE — RoomIncome.gs
// =============================================================================
//
// Sheet columns (HEADERS.ROOM_INCOME, 0-based):
//   0 IncomeID   1 BookingID   2 RoomID    3 GuestID   4 Category
//   5 Amount     6 PaymentMethod  7 Description  8 IncomeDate  9 CreatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addRoomIncome(data) {
  return withUserLock(function() {
  try {
    var date          = trimStr(data.date          || "");
    var amount        = toNumber(data.amount,        0);
    var category      = trimStr(data.category      || "");
    var paymentMethod = trimStr(data.paymentMethod || "");
    var bookingId     = trimStr(data.bookingId     || "");
    var description   = trimStr(data.description   || "");

    if (isBlank(date))             return errorResponse("Date is required.",                  ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.",  ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",         ERROR_CODES.MISSING_FIELD);

    var incomeId = getNextId("ROOM_INCOME");
    var ts       = formatDateTime(now());
    var row = [incomeId, bookingId, "", "", category, roundTo2(amount), paymentMethod, description, date, ts];

    appendRow(SHEETS.ROOM_INCOME, row);

    _addLedgerEntry({
      entryDate  : date,
      entryType  : LEDGER_TYPES.INCOME,
      category   : "Room Income",
      subCategory: category || "Room Income",
      referenceId: incomeId,
      description: description || category || "Room Income",
      debit      : 0,
      credit     : roundTo2(amount),
    });

    return successResponse(_riRowToObj(row), incomeId + " — Room income recorded successfully.");
  } catch (e) {
    return handleError(e, "addRoomIncome");
  }
  }, 6000);
}

function updateRoomIncome(incomeId, data) {
  return withUserLock(function() {
  try {
    var date          = trimStr(data.date          || "");
    var amount        = toNumber(data.amount,        0);
    var category      = trimStr(data.category      || "");
    var paymentMethod = trimStr(data.paymentMethod || "");
    var bookingId     = trimStr(data.bookingId     || "");
    var description   = trimStr(data.description   || "");

    if (isBlank(date))             return errorResponse("Date is required.",                  ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.",  ERROR_CODES.VALIDATION_FAILED);
    if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",         ERROR_CODES.MISSING_FIELD);

    var rowIdx = findRowById(SHEETS.ROOM_INCOME, incomeId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.ROOM_INCOME);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.ROOM_INCOME.length).getValues()[0];

    var row = [incomeId, bookingId, existing[2], existing[3], category, roundTo2(amount), paymentMethod, description, date, existing[9]];
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

    _updateLedgerEntry(incomeId, LEDGER_TYPES.INCOME, 0, roundTo2(amount));
    return successResponse(_riRowToObj(row), "Room income entry updated.");
  } catch (e) {
    return handleError(e, "updateRoomIncome");
  }
  }, 6000);
}

function deleteRoomIncome(incomeId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.ROOM_INCOME, incomeId, 1);
    if (rowIdx === -1) return errorResponse("Entry not found.", ERROR_CODES.RECORD_NOT_FOUND);
    _removeLedgerEntry(incomeId);
    getSheet(SHEETS.ROOM_INCOME).deleteRow(rowIdx);
    return successResponse({ incomeId: incomeId }, "Room income entry deleted.");
  } catch (e) {
    return handleError(e, "deleteRoomIncome");
  }
  }, 6000);
}

/**
 * filters: { search, category, paymentMethod, dateFrom, dateTo } — all optional.
 * Client-side filtering is preferred; server-side filters applied only when provided.
 */
function listRoomIncomes(filters) {
  try {
    var rows  = getSheetData(SHEETS.ROOM_INCOME);
    var items = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_riRowToObj);

    if (filters) {
      if (filters.category)      items = items.filter(function(i) { return i.category      === filters.category; });
      if (filters.paymentMethod) items = items.filter(function(i) { return i.paymentMethod === filters.paymentMethod; });
      if (filters.dateFrom)      items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)        items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.incomeId.toLowerCase().indexOf(q)    !== -1 ||
                 i.description.toLowerCase().indexOf(q) !== -1 ||
                 i.category.toLowerCase().indexOf(q)    !== -1 ||
                 i.bookingId.toLowerCase().indexOf(q)   !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch (e) {
    return handleError(e, "listRoomIncomes");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _riRowToObj(row) {
  return {
    incomeId     : String(row[0]),
    bookingId    : String(row[1] || ""),
    category     : String(row[4] || ""),
    amount       : toNumber(row[5], 0),
    paymentMethod: String(row[6] || ""),
    description  : String(row[7] || ""),
    date         : row[8] ? formatDate(row[8]) : "",
    createdAt    : row[9] ? formatDateTime(row[9]) : "",
  };
}
