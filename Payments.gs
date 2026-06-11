// =============================================================================
// PAYMENTS MODULE — Payments.gs
// =============================================================================
//
// Sheet columns (HEADERS.PAYMENTS, 0-based):
//   0 PaymentID   1 BookingID   2 GuestName   3 RoomNumber
//   4 Amount      5 PaymentMethod  6 PaymentType
//   7 Notes       8 PaymentDate   9 CreatedAt
//
// Booking columns updated (1-based for getRange):
//   col 10  AdvancePaid  (repurposed Children column)
//   col 14  NetAmount
//   col 20  UpdatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addPayment(data) {
  return withScriptLock(function() {
    try {
      var bookingId     = trimStr(data.bookingId     || "");
      var date          = trimStr(data.date          || "");
      var amount        = toNumber(data.amount,        0);
      var paymentMethod = trimStr(data.paymentMethod || "");
      var paymentType   = trimStr(data.paymentType   || "");
      var notes         = trimStr(data.notes         || "");

      // ── Required field validation ────────────────────────────────────────
      if (isBlank(bookingId))        return errorResponse("Booking ID is required.",          ERROR_CODES.MISSING_FIELD);
      if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
      if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",       ERROR_CODES.MISSING_FIELD);
      if (isBlank(paymentType))      return errorResponse("Payment type is required.",         ERROR_CODES.MISSING_FIELD);

      // ── Booking lookup ───────────────────────────────────────────────────
      var booking = _getBookingRow(bookingId);
      if (!booking) return errorResponse("Booking " + bookingId + " not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var netAmount   = toNumber(booking[13], 0);
      var advancePaid = toNumber(booking[9],  0);
      var balanceDue  = roundTo2(netAmount - advancePaid);
      if (balanceDue  < 0) balanceDue  = 0;
      if (advancePaid < 0) advancePaid = 0;

      var isRefund    = (paymentType === PAYMENT_TYPES.REFUND);
      var amt         = roundTo2(amount);

      // ── Balance validation ───────────────────────────────────────────────
      if (isRefund) {
        if (amt > advancePaid) {
          return errorResponse(
            "Refund amount (PKR " + amt + ") cannot exceed total amount paid (PKR " + advancePaid + ").",
            ERROR_CODES.VALIDATION_FAILED
          );
        }
      } else {
        if (amt > balanceDue) {
          return errorResponse(
            "Payment amount (PKR " + amt + ") cannot exceed due balance (PKR " + balanceDue + ").",
            ERROR_CODES.VALIDATION_FAILED
          );
        }
      }

      var guestName  = String(booking[2] || "");
      var roomNumber = String(booking[4] || "");

      var paymentId = getNextId("PAYMENTS");
      var ts        = formatDateTime(now());
      var row       = [paymentId, bookingId, guestName, roomNumber,
                       amt, paymentMethod, paymentType, notes, date, ts];

      appendRow(SHEETS.PAYMENTS, row);

      _updateBookingAdvance(bookingId, isRefund ? -amt : amt);

      _addLedgerEntry({
        entryDate  : date,
        entryType  : isRefund ? LEDGER_TYPES.EXPENSE : LEDGER_TYPES.INCOME,
        category   : "Payment",
        subCategory: paymentType,
        referenceId: paymentId,
        description: paymentType + " — " + guestName + " / Rm " + roomNumber + " (" + bookingId + ")",
        debit      : isRefund ? amt : 0,
        credit     : isRefund ? 0   : amt,
      });

      return successResponse(_payRowToObj(row), paymentId + " — Payment recorded successfully.");
    } catch (e) {
      return handleError(e, "addPayment");
    }
  }, 10000); // 10 s lock — blocks a rapid double-submit
}

function updatePayment(paymentId, data) {
  return withScriptLock(function() {
    try {
      var date          = trimStr(data.date          || "");
      var amount        = toNumber(data.amount,        0);
      var paymentMethod = trimStr(data.paymentMethod || "");
      var paymentType   = trimStr(data.paymentType   || "");
      var notes         = trimStr(data.notes         || "");

      if (isBlank(date))             return errorResponse("Date is required.",                 ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(amount)) return errorResponse("Amount must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
      if (isBlank(paymentMethod))    return errorResponse("Payment method is required.",       ERROR_CODES.MISSING_FIELD);
      if (isBlank(paymentType))      return errorResponse("Payment type is required.",         ERROR_CODES.MISSING_FIELD);

      var rowIdx = findRowById(SHEETS.PAYMENTS, paymentId, 1);
      if (rowIdx === -1) return errorResponse("Payment not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet    = getSheet(SHEETS.PAYMENTS);
      var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.PAYMENTS.length).getValues()[0];

      var bookingId   = String(existing[1]);
      var oldAmount   = toNumber(existing[4], 0);
      var oldType     = String(existing[6] || "");
      var oldIsRefund = (oldType    === PAYMENT_TYPES.REFUND);
      var newIsRefund = (paymentType === PAYMENT_TYPES.REFUND);
      var newAmt      = roundTo2(amount);

      // ── Compute base balance (booking state without this payment) ────────
      var booking = _getBookingRow(bookingId);
      if (!booking) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var netAmount      = toNumber(booking[13], 0);
      var advancePaid    = toNumber(booking[9],  0);
      var baseAdvance    = roundTo2(advancePaid + (oldIsRefund ? oldAmount : -oldAmount));
      if (baseAdvance < 0) baseAdvance = 0;
      var baseBalance    = roundTo2(netAmount - baseAdvance);
      if (baseBalance < 0) baseBalance = 0;

      // ── Balance validation against base state ────────────────────────────
      if (newIsRefund) {
        if (newAmt > baseAdvance) {
          return errorResponse(
            "Refund amount (PKR " + newAmt + ") cannot exceed total amount paid (PKR " + baseAdvance + ").",
            ERROR_CODES.VALIDATION_FAILED
          );
        }
      } else {
        if (newAmt > baseBalance) {
          return errorResponse(
            "Payment amount (PKR " + newAmt + ") cannot exceed due balance (PKR " + baseBalance + ").",
            ERROR_CODES.VALIDATION_FAILED
          );
        }
      }

      // ── Reverse old booking effect, apply new one ─────────────────────
      _updateBookingAdvance(bookingId, oldIsRefund ?  oldAmount : -oldAmount); // undo old
      _updateBookingAdvance(bookingId, newIsRefund ? -newAmt    :  newAmt);    // apply new

      var row = [paymentId, bookingId, existing[2], existing[3],
                 newAmt, paymentMethod, paymentType, notes, date, existing[9]];
      sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

      _updateLedgerEntry(
        paymentId,
        newIsRefund ? LEDGER_TYPES.EXPENSE : LEDGER_TYPES.INCOME,
        newIsRefund ? newAmt : 0,
        newIsRefund ? 0      : newAmt
      );
      return successResponse(_payRowToObj(row), "Payment updated.");
    } catch (e) {
      return handleError(e, "updatePayment");
    }
  }, 10000);
}

function deletePayment(paymentId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.PAYMENTS, paymentId, 1);
    if (rowIdx === -1) return errorResponse("Payment not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.PAYMENTS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.PAYMENTS.length).getValues()[0];

    var bookingId = String(existing[1]);
    var amount    = toNumber(existing[4], 0);
    var type      = String(existing[6] || "");
    var isRefund  = (type === PAYMENT_TYPES.REFUND);

    _updateBookingAdvance(bookingId, isRefund ? amount : -amount);

    _removeLedgerEntry(paymentId);
    sheet.deleteRow(rowIdx);
    return successResponse({ paymentId: paymentId }, "Payment deleted.");
  } catch (e) {
    return handleError(e, "deletePayment");
  }
  }, 6000);
}

function listPayments(filters) {
  try {
    var rows  = getSheetData(SHEETS.PAYMENTS);
    var items = rows
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_payRowToObj);

    if (filters) {
      if (filters.paymentMethod) items = items.filter(function(i) { return i.paymentMethod === filters.paymentMethod; });
      if (filters.paymentType)   items = items.filter(function(i) { return i.paymentType   === filters.paymentType; });
      if (filters.bookingId)     items = items.filter(function(i) { return i.bookingId     === filters.bookingId; });
      if (filters.dateFrom)      items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)        items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.paymentId.toLowerCase().indexOf(q)   !== -1 ||
                 i.bookingId.toLowerCase().indexOf(q)   !== -1 ||
                 i.guestName.toLowerCase().indexOf(q)   !== -1 ||
                 i.roomNumber.toLowerCase().indexOf(q)  !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch (e) {
    return handleError(e, "listPayments");
  }
}

function getBookingForPayment(bookingId) {
  try {
    var row = _getBookingRow(trimStr(bookingId || ""));
    if (!row) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);
    var netAmount   = toNumber(row[13], 0);
    var advancePaid = toNumber(row[9],  0);
    var balanceDue  = roundTo2(netAmount - advancePaid);
    return successResponse({
      bookingId  : String(row[0]),
      guestName  : String(row[2] || ""),
      roomNumber : String(row[4] || ""),
      status     : String(row[14] || ""),
      netAmount  : roundTo2(netAmount),
      advancePaid: roundTo2(advancePaid < 0 ? 0 : advancePaid),
      balanceDue : roundTo2(balanceDue  < 0 ? 0 : balanceDue),
    });
  } catch (e) {
    return handleError(e, "getBookingForPayment");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _getBookingRow(bookingId) {
  if (isBlank(bookingId)) return null;
  var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
  if (rowIdx === -1) return null;
  return getSheet(SHEETS.BOOKINGS).getRange(rowIdx, 1, 1, HEADERS.BOOKINGS.length).getValues()[0];
}

function _updateBookingAdvance(bookingId, delta) {
  try {
    if (!delta) return;
    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return;
    var sheet       = getSheet(SHEETS.BOOKINGS);
    var advancePaid = toNumber(sheet.getRange(rowIdx, 10).getValue(), 0);
    var newAdvance  = roundTo2(advancePaid + delta);
    if (newAdvance < 0) newAdvance = 0; // never go negative
    sheet.getRange(rowIdx, 10).setValue(newAdvance);
    sheet.getRange(rowIdx, 20).setValue(formatDateTime(now()));
  } catch (e) {
    console.error("[_updateBookingAdvance] booking=" + bookingId + " err=" + e.message);
  }
}

function _payRowToObj(row) {
  return {
    paymentId    : String(row[0]),
    bookingId    : String(row[1] || ""),
    guestName    : String(row[2] || ""),
    roomNumber   : String(row[3] || ""),
    amount       : toNumber(row[4], 0),
    paymentMethod: String(row[5] || ""),
    paymentType  : String(row[6] || ""),
    notes        : String(row[7] || ""),
    date         : row[8] ? formatDate(row[8]) : "",
    createdAt    : row[9] ? formatDateTime(row[9]) : "",
  };
}
