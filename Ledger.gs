// =============================================================================
// LEDGER MODULE — Ledger.gs
// =============================================================================
//
// Sheet columns (HEADERS.LEDGER, 0-based):
//   0  LedgerID    1  EntryDate   2  EntryType   3  Category   4  SubCategory
//   5  ReferenceID 6  Description 7  Debit       8  Credit     9  Balance
//  10  CreatedAt
//
// _addLedgerEntry() is called by all four finance modules (RoomIncome, RoomExpense,
// KitchenIncome, KitchenExpense) and is reachable because all .gs files share the
// same GAS global scope.
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

/**
 * filters: { search, entryType, category, dateFrom, dateTo }  — all optional.
 * Sorted newest-first by EntryDate.
 */
function listLedgerEntries(filters) {
  try {
    var rows    = getSheetData(SHEETS.LEDGER);
    var entries = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_ledgerRowToObj);

    if (filters) {
      if (filters.entryType) {
        entries = entries.filter(function(e) { return e.entryType === filters.entryType; });
      }
      if (filters.category) {
        entries = entries.filter(function(e) { return e.category === filters.category; });
      }
      if (filters.dateFrom) {
        entries = entries.filter(function(e) { return e.entryDate >= filters.dateFrom; });
      }
      if (filters.dateTo) {
        entries = entries.filter(function(e) { return e.entryDate <= filters.dateTo; });
      }
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        entries = entries.filter(function(e) {
          return e.ledgerId.toLowerCase().indexOf(q)     !== -1 ||
                 e.category.toLowerCase().indexOf(q)     !== -1 ||
                 e.description.toLowerCase().indexOf(q)  !== -1 ||
                 e.referenceId.toLowerCase().indexOf(q)  !== -1;
        });
      }
    }

    entries.sort(function(a, b) { return (b.entryDate || "").localeCompare(a.entryDate || ""); });
    return successResponse(entries);
  } catch (e) {
    return handleError(e, "listLedgerEntries");
  }
}

function getLedgerStats() {
  try {
    var rows    = getSheetData(SHEETS.LEDGER);
    var entries = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_ledgerRowToObj);

    var totalCredit  = 0;
    var totalDebit   = 0;
    entries.forEach(function(e) {
      totalCredit += e.credit;
      totalDebit  += e.debit;
    });

    return successResponse({
      totalEntries: entries.length,
      totalCredit : roundTo2(totalCredit),
      totalDebit  : roundTo2(totalDebit),
      balance     : roundTo2(totalCredit - totalDebit),
    });
  } catch (e) {
    return handleError(e, "getLedgerStats");
  }
}


// =============================================================================
// PRIVATE HELPERS — shared with all finance modules via global scope
// =============================================================================

/**
 * Appends one entry to the Ledger sheet and maintains the running balance.
 * Called by addRoomIncome, addRoomExpense, addKitchenIncome, addKitchenExpense.
 *
 * data: { entryDate, entryType, category, subCategory, referenceId, description, debit, credit }
 */
function _addLedgerEntry(data) {
  try {
    // Guard: skip if a ledger entry for this referenceId already exists
    if (data.referenceId) {
      var existing = getSheetData(SHEETS.LEDGER);
      for (var i = 0; i < existing.length; i++) {
        if (String(existing[i][5]) === String(data.referenceId)) {
          console.warn("[_addLedgerEntry] Duplicate skipped for referenceId=" + data.referenceId);
          return;
        }
      }
    }

    var ledgerId = getNextId("LEDGER");
    var credit   = roundTo2(toNumber(data.credit, 0));
    var debit    = roundTo2(toNumber(data.debit,  0));
    var balance  = roundTo2(_getLastLedgerBalance() + credit - debit);
    var ts       = formatDateTime(now());

    appendRow(SHEETS.LEDGER, [
      ledgerId,
      data.entryDate    || formatDate(now()),
      data.entryType    || "",
      data.category     || "",
      data.subCategory  || "",
      data.referenceId  || "",
      data.description  || "",
      debit,
      credit,
      balance,
      ts,
    ]);
  } catch (e) {
    console.error("[_addLedgerEntry] ref=" + (data.referenceId || "?") + " err=" + e.message);
  }
}

function _getLastLedgerBalance() {
  try {
    var sheet   = getSheet(SHEETS.LEDGER);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    return toNumber(sheet.getRange(lastRow, 10).getValue(), 0); // Balance col 10 (1-based)
  } catch (e) {
    return 0;
  }
}

/**
 * Removes the ledger row whose ReferenceID matches referenceId.
 * Called by delete operations in all finance modules and Payments.
 */
function _removeLedgerEntry(referenceId) {
  try {
    if (!referenceId) return;
    var rowIdx = findRowById(SHEETS.LEDGER, referenceId, 6); // col 6 = ReferenceID (1-based)
    if (rowIdx === -1) return;
    getSheet(SHEETS.LEDGER).deleteRow(rowIdx);
  } catch (e) {
    console.error("[_removeLedgerEntry] ref=" + referenceId + " err=" + e.message);
  }
}

/**
 * Updates debit/credit/entryType in an existing ledger row.
 * Called by update operations in finance modules and Payments.
 * The stored Balance column becomes stale but getLedgerStats recalculates from sums.
 */
function _updateLedgerEntry(referenceId, newEntryType, newDebit, newCredit) {
  try {
    if (!referenceId) return;
    var rowIdx = findRowById(SHEETS.LEDGER, referenceId, 6);
    if (rowIdx === -1) return;
    var sheet = getSheet(SHEETS.LEDGER);
    sheet.getRange(rowIdx, 3).setValue(newEntryType);       // EntryType col 3
    sheet.getRange(rowIdx, 8).setValue(roundTo2(newDebit));  // Debit col 8
    sheet.getRange(rowIdx, 9).setValue(roundTo2(newCredit)); // Credit col 9
  } catch (e) {
    console.error("[_updateLedgerEntry] ref=" + referenceId + " err=" + e.message);
  }
}

function _ledgerRowToObj(row) {
  return {
    ledgerId   : String(row[0]),
    entryDate  : row[1] ? formatDate(row[1])     : "",
    entryType  : String(row[2] || ""),
    category   : String(row[3] || ""),
    subCategory: String(row[4] || ""),
    referenceId: String(row[5] || ""),
    description: String(row[6] || ""),
    debit      : toNumber(row[7], 0),
    credit     : toNumber(row[8], 0),
    balance    : toNumber(row[9], 0),
    createdAt  : row[10] ? formatDateTime(row[10]) : "",
  };
}
