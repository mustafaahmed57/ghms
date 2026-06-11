// =============================================================================
// BILLING MODULE — Billing.gs
// =============================================================================
// Manages Invoices and Invoice_Lines sheets.
//
// INVOICES columns (0-based):
//   0  InvoiceID   1  InvoiceNo   2  BookingID   3  GuestID     4  GuestName
//   5  RoomID      6  RoomNumber  7  InvoiceDate 8  CheckInDate 9  CheckOutDate
//  10  Nights     11  SubTotal   12  Discount   13  Tax        14  GrandTotal
//  15  PaidAmount 16  BalanceDue 17  Status     18  Notes      19  CreatedAt  20 UpdatedAt
//
// INVOICE_LINES columns (0-based):
//   0  LineID  1  InvoiceID  2  ServiceType  3  Description
//   4  Quantity  5  Rate  6  Amount  7  SourceModule  8  ReferenceID  9  CreatedAt
// =============================================================================


// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Create invoice from booking.
 * Prevents duplicate active invoice for the same booking.
 * Auto-adds a "Room Rent" line (Nights × RatePerNight).
 * Creates a single ledger INCOME entry for the full invoice amount.
 */
function createInvoice(token, data) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;

      var bookingId = trimStr(data.bookingId || "");
      if (isBlank(bookingId))
        return errorResponse("Booking ID is required.", ERROR_CODES.MISSING_FIELD);

      // Load booking
      var bkRow = _findBookingRow(bookingId);
      if (!bkRow)
        return errorResponse("Booking not found: " + bookingId, ERROR_CODES.RECORD_NOT_FOUND);

      var bkStatus = String(bkRow[14] || "");
      if (bkStatus === BOOKING_STATUS.CANCELLED)
        return errorResponse("Cannot create invoice for a Cancelled booking.", ERROR_CODES.INVALID_STATUS);

      // Prevent duplicate active (non-Cancelled) invoice for this booking
      var existing = _findActiveInvoiceForBooking(bookingId);
      if (existing)
        return errorResponse("An invoice (" + existing.invoiceId + ") already exists for booking " + bookingId + ".", ERROR_CODES.DUPLICATE_ENTRY);

      var invoiceId  = getNextId("INVOICES");
      var invoiceNo  = invoiceId; // same as ID for simplicity
      var today      = formatDate(now());
      var ts         = formatDateTime(now());

      var guestId    = String(bkRow[1]  || "");
      var guestName  = String(bkRow[2]  || "");
      var roomId     = String(bkRow[3]  || "");
      var roomNumber = String(bkRow[4]  || "");
      var checkIn    = bkRow[5]  ? formatDate(bkRow[5])  : "";
      var checkOut   = bkRow[6]  ? formatDate(bkRow[6])  : "";
      var nights     = toNumber(bkRow[7], 0);
      var ratePerNight = toNumber(bkRow[10], 0);
      var notes      = trimStr(data.notes || "");

      // Initial room-rent line
      var roomRentAmt = roundTo2(nights * ratePerNight);

      // Write invoice row (totals computed below)
      var invRow = [
        invoiceId, invoiceNo, bookingId, guestId, guestName,
        roomId, roomNumber, today, checkIn, checkOut,
        nights,
        roomRentAmt, // SubTotal (will be recalculated)
        0,           // Discount
        0,           // Tax
        roomRentAmt, // GrandTotal
        0,           // PaidAmount
        roomRentAmt, // BalanceDue
        INVOICE_STATUS.DRAFT,
        notes,
        ts, ts,
      ];
      appendRow(SHEETS.INVOICES, invRow);

      // Write initial room rent line
      var lineId = getNextId("INVOICE_LINES");
      appendRow(SHEETS.INVOICE_LINES, [
        lineId, invoiceId, "Room Rent",
        "Room " + roomNumber + " × " + nights + " night(s) @ PKR " + ratePerNight.toLocaleString(),
        nights, ratePerNight, roomRentAmt,
        "Bookings", bookingId, ts,
      ]);

      // Ledger: INCOME credit for the full invoice amount (once, using invoiceId as ref)
      _addLedgerEntry({
        entryDate  : today,
        entryType  : LEDGER_TYPES.INCOME,
        category   : "Invoice",
        subCategory: "Room Revenue",
        referenceId: invoiceId,
        description: "Invoice " + invoiceId + " — " + guestName + " Room " + roomNumber,
        debit      : 0,
        credit     : roomRentAmt,
      });

      _addAuditLog("Billing", "CREATE", invoiceId, "Guest: " + guestName + " Room: " + roomNumber);
      return successResponse(_buildInvoiceObj(invoiceId), "Invoice created successfully.");
    } catch (e) {
      return handleError(e, "createInvoice");
    }
  });
}

/**
 * List all invoices with optional filters:
 * { status, dateFrom, dateTo, search }
 */
function listInvoices(token, filters) {
  try {
    var err = _requireBillingRole(token); if (err) return err;
    var rows = getSheetData(SHEETS.INVOICES)
      .filter(function(r) { return trimStr(r[0]) !== ""; })
      .map(_invRowToObj);

    filters = filters || {};
    if (filters.status)   rows = rows.filter(function(r) { return r.status === filters.status; });
    if (filters.dateFrom) rows = rows.filter(function(r) { return r.invoiceDate >= filters.dateFrom; });
    if (filters.dateTo)   rows = rows.filter(function(r) { return r.invoiceDate <= filters.dateTo; });
    if (filters.search) {
      var q = trimStr(filters.search).toLowerCase();
      rows = rows.filter(function(r) {
        return r.invoiceId.toLowerCase().indexOf(q)   !== -1 ||
               r.bookingId.toLowerCase().indexOf(q)   !== -1 ||
               r.guestName.toLowerCase().indexOf(q)   !== -1 ||
               r.roomNumber.toLowerCase().indexOf(q)  !== -1;
      });
    }

    rows.sort(function(a, b) { return b.invoiceDate.localeCompare(a.invoiceDate); });
    return successResponse(rows);
  } catch (e) {
    return handleError(e, "listInvoices");
  }
}

/**
 * Get single invoice with all its lines.
 */
function getInvoice(token, invoiceId) {
  try {
    var err = _requireBillingRole(token); if (err) return err;
    var obj = _buildInvoiceObj(trimStr(invoiceId || ""));
    if (!obj) return errorResponse("Invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);
    return successResponse(obj);
  } catch (e) {
    return handleError(e, "getInvoice");
  }
}

/**
 * Get invoice for a specific booking (if any active one exists).
 */
function getInvoiceForBooking(token, bookingId) {
  try {
    var err = _requireBillingRole(token); if (err) return err;
    var inv = _findActiveInvoiceForBooking(trimStr(bookingId || ""));
    return successResponse(inv || null);
  } catch (e) {
    return handleError(e, "getInvoiceForBooking");
  }
}

/**
 * Add an extra line to a Draft invoice.
 * data: { serviceType, description, quantity, rate }
 */
function addInvoiceLine(token, invoiceId, data) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      invoiceId = trimStr(invoiceId || "");

      var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (rowIdx === -1) return errorResponse("Invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet  = getSheet(SHEETS.INVOICES);
      var invRow = sheet.getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      var status = String(invRow[17] || "");
      if (status !== INVOICE_STATUS.DRAFT)
        return errorResponse("Lines can only be added to Draft invoices.", ERROR_CODES.INVALID_STATUS);

      var qty  = toNumber(data.quantity, 1);
      var rate = toNumber(data.rate, 0);
      if (qty <= 0)  return errorResponse("Quantity must be positive.", ERROR_CODES.VALIDATION_FAILED);
      if (rate < 0)  return errorResponse("Rate cannot be negative.", ERROR_CODES.VALIDATION_FAILED);
      var amt  = roundTo2(qty * rate);

      var lineId = getNextId("INVOICE_LINES");
      var ts     = formatDateTime(now());
      appendRow(SHEETS.INVOICE_LINES, [
        lineId, invoiceId,
        trimStr(data.serviceType || "Other"),
        trimStr(data.description || ""),
        qty, rate, amt,
        trimStr(data.sourceModule || "Manual"),
        trimStr(data.referenceId  || ""),
        ts,
      ]);

      _recalcInvoiceTotals(invoiceId);
      _syncLedgerForInvoice(invoiceId);

      return successResponse(_buildInvoiceObj(invoiceId), "Line added.");
    } catch (e) {
      return handleError(e, "addInvoiceLine");
    }
  });
}

/**
 * Update an existing line (Draft only).
 * data: { serviceType, description, quantity, rate }
 */
function updateInvoiceLine(token, lineId, data) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      lineId = trimStr(lineId || "");

      var lineRowIdx = findRowById(SHEETS.INVOICE_LINES, lineId, 1);
      if (lineRowIdx === -1) return errorResponse("Line not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var lineSheet = getSheet(SHEETS.INVOICE_LINES);
      var lineRow   = lineSheet.getRange(lineRowIdx, 1, 1, HEADERS.INVOICE_LINES.length).getValues()[0];
      var invoiceId = String(lineRow[1] || "");

      var invRowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (invRowIdx === -1) return errorResponse("Parent invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var invRow = getSheet(SHEETS.INVOICES).getRange(invRowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      if (String(invRow[17]) !== INVOICE_STATUS.DRAFT)
        return errorResponse("Lines can only be edited on Draft invoices.", ERROR_CODES.INVALID_STATUS);

      var qty  = toNumber(data.quantity, 1);
      var rate = toNumber(data.rate, 0);
      if (qty <= 0)  return errorResponse("Quantity must be positive.", ERROR_CODES.VALIDATION_FAILED);
      if (rate < 0)  return errorResponse("Rate cannot be negative.", ERROR_CODES.VALIDATION_FAILED);
      var amt = roundTo2(qty * rate);

      lineSheet.getRange(lineRowIdx, 3).setValue(trimStr(data.serviceType || lineRow[2]));
      lineSheet.getRange(lineRowIdx, 4).setValue(trimStr(data.description || lineRow[3]));
      lineSheet.getRange(lineRowIdx, 5).setValue(qty);
      lineSheet.getRange(lineRowIdx, 6).setValue(rate);
      lineSheet.getRange(lineRowIdx, 7).setValue(amt);

      _recalcInvoiceTotals(invoiceId);
      _syncLedgerForInvoice(invoiceId);

      return successResponse(_buildInvoiceObj(invoiceId), "Line updated.");
    } catch (e) {
      return handleError(e, "updateInvoiceLine");
    }
  });
}

/**
 * Delete a line from a Draft invoice.
 * The first "Room Rent" line cannot be deleted if it is the only line.
 */
function deleteInvoiceLine(token, lineId) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      lineId = trimStr(lineId || "");

      var lineRowIdx = findRowById(SHEETS.INVOICE_LINES, lineId, 1);
      if (lineRowIdx === -1) return errorResponse("Line not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var lineSheet = getSheet(SHEETS.INVOICE_LINES);
      var lineRow   = lineSheet.getRange(lineRowIdx, 1, 1, HEADERS.INVOICE_LINES.length).getValues()[0];
      var invoiceId = String(lineRow[1] || "");

      var invRowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (invRowIdx === -1) return errorResponse("Parent invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var invRow = getSheet(SHEETS.INVOICES).getRange(invRowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      if (String(invRow[17]) !== INVOICE_STATUS.DRAFT)
        return errorResponse("Lines can only be deleted from Draft invoices.", ERROR_CODES.INVALID_STATUS);

      // Count lines on this invoice
      var allLines = getSheetData(SHEETS.INVOICE_LINES).filter(function(r) {
        return String(r[1]) === invoiceId && trimStr(r[0]) !== "";
      });
      if (allLines.length <= 1)
        return errorResponse("Cannot delete the only line on an invoice.", ERROR_CODES.VALIDATION_FAILED);

      lineSheet.deleteRow(lineRowIdx);
      _recalcInvoiceTotals(invoiceId);
      _syncLedgerForInvoice(invoiceId);

      return successResponse(_buildInvoiceObj(invoiceId), "Line deleted.");
    } catch (e) {
      return handleError(e, "deleteInvoiceLine");
    }
  });
}

/**
 * Apply discount and/or tax to a Draft invoice.
 * data: { discount, tax, notes }
 */
function applyDiscountTax(token, invoiceId, data) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      invoiceId = trimStr(invoiceId || "");

      var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (rowIdx === -1) return errorResponse("Invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet  = getSheet(SHEETS.INVOICES);
      var invRow = sheet.getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      if (String(invRow[17]) !== INVOICE_STATUS.DRAFT)
        return errorResponse("Discount/Tax can only be applied to Draft invoices.", ERROR_CODES.INVALID_STATUS);

      var subTotal = toNumber(invRow[11], 0);
      var discount = toNumber(data.discount, 0);
      var tax      = toNumber(data.tax, 0);

      if (discount < 0) return errorResponse("Discount cannot be negative.", ERROR_CODES.VALIDATION_FAILED);
      if (discount > subTotal) return errorResponse("Discount cannot exceed sub-total (PKR " + subTotal + ").", ERROR_CODES.VALIDATION_FAILED);
      if (tax < 0) return errorResponse("Tax cannot be negative.", ERROR_CODES.VALIDATION_FAILED);

      sheet.getRange(rowIdx, 13).setValue(roundTo2(discount)); // col 13 = Discount (1-based)
      sheet.getRange(rowIdx, 14).setValue(roundTo2(tax));      // col 14 = Tax

      if (data.notes !== undefined) sheet.getRange(rowIdx, 19).setValue(trimStr(data.notes));
      sheet.getRange(rowIdx, 21).setValue(formatDateTime(now())); // UpdatedAt

      _recalcInvoiceTotals(invoiceId);
      _syncLedgerForInvoice(invoiceId);

      return successResponse(_buildInvoiceObj(invoiceId), "Discount/Tax applied.");
    } catch (e) {
      return handleError(e, "applyDiscountTax");
    }
  });
}

/**
 * Receive a payment against a non-Cancelled invoice.
 * data: { amount, paymentMethod, notes }
 */
function receiveInvoicePayment(token, invoiceId, data) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      invoiceId = trimStr(invoiceId || "");

      var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (rowIdx === -1) return errorResponse("Invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet  = getSheet(SHEETS.INVOICES);
      var invRow = sheet.getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      var status = String(invRow[17] || "");

      if (status === INVOICE_STATUS.CANCELLED)
        return errorResponse("Cannot accept payment on a Cancelled invoice.", ERROR_CODES.INVALID_STATUS);
      if (status === INVOICE_STATUS.PAID)
        return errorResponse("Invoice is already fully paid.", ERROR_CODES.INVALID_STATUS);

      var balanceDue = toNumber(invRow[16], 0);
      var amount     = roundTo2(toNumber(data.amount, 0));

      if (amount <= 0)
        return errorResponse("Payment amount must be positive.", ERROR_CODES.VALIDATION_FAILED);
      if (amount > balanceDue)
        return errorResponse("Payment amount (PKR " + amount + ") exceeds balance due (PKR " + balanceDue + ").", ERROR_CODES.VALIDATION_FAILED);

      var payMethod = trimStr(data.paymentMethod || "Cash");
      var notes     = trimStr(data.notes || "");
      var today     = formatDate(now());
      var ts        = formatDateTime(now());

      // Record in Payments sheet
      var payId    = getNextId("PAYMENTS");
      var guestName = String(invRow[4] || "");
      var roomNum   = String(invRow[6] || "");
      appendRow(SHEETS.PAYMENTS, [
        payId, String(invRow[2]), guestName, roomNum,
        amount, payMethod, PAYMENT_TYPES.FINAL,
        notes || "Invoice " + invoiceId + " payment",
        today, ts,
      ]);

      // Update invoice PaidAmount, BalanceDue
      var newPaid    = roundTo2(toNumber(invRow[15], 0) + amount);
      var newBalance = roundTo2(toNumber(invRow[14], 0) - newPaid);
      if (newBalance < 0) newBalance = 0;

      sheet.getRange(rowIdx, 16).setValue(newPaid);    // PaidAmount
      sheet.getRange(rowIdx, 17).setValue(newBalance); // BalanceDue

      // Update status
      var newStatus = newBalance <= 0 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID;
      sheet.getRange(rowIdx, 18).setValue(newStatus); // Status
      sheet.getRange(rowIdx, 21).setValue(ts);        // UpdatedAt

      // Sync booking AdvancePaid so Payments / Check-In-Out see correct running total
      _updateBookingAdvance(String(invRow[2] || ""), amount);

      // Ledger: cash/bank credit for this payment (payId as referenceId — prevents duplicates)
      _addLedgerEntry({
        entryDate  : today,
        entryType  : LEDGER_TYPES.INCOME,
        category   : "Payment",
        subCategory: payMethod,
        referenceId: payId,
        description: "Payment for Invoice " + invoiceId + " — " + guestName,
        debit      : 0,
        credit     : amount,
      });

      _addAuditLog("Billing", "PAYMENT", invoiceId, "PKR " + amount + " via " + payMethod + " — " + guestName);
      return successResponse(_buildInvoiceObj(invoiceId), "Payment recorded. Status: " + newStatus + ".");
    } catch (e) {
      return handleError(e, "receiveInvoicePayment");
    }
  });
}

/**
 * Cancel an invoice (Draft only — cannot cancel Paid invoices).
 */
function cancelInvoice(token, invoiceId) {
  return withScriptLock(function() {
    try {
      var err = _requireBillingRole(token); if (err) return err;
      invoiceId = trimStr(invoiceId || "");

      var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
      if (rowIdx === -1) return errorResponse("Invoice not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet  = getSheet(SHEETS.INVOICES);
      var invRow = sheet.getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
      var status = String(invRow[17] || "");

      if (status === INVOICE_STATUS.PAID)
        return errorResponse("Cannot cancel a fully Paid invoice.", ERROR_CODES.INVALID_STATUS);
      if (status === INVOICE_STATUS.CANCELLED)
        return errorResponse("Invoice is already Cancelled.", ERROR_CODES.INVALID_STATUS);

      var ts = formatDateTime(now());
      sheet.getRange(rowIdx, 18).setValue(INVOICE_STATUS.CANCELLED);
      sheet.getRange(rowIdx, 21).setValue(ts);

      // Remove the revenue ledger entry for this invoice
      _removeLedgerEntry(invoiceId);

      _addAuditLog("Billing", "CANCEL", invoiceId, "Guest: " + String(invRow[4] || ""));
      return successResponse({ invoiceId: invoiceId, status: INVOICE_STATUS.CANCELLED }, "Invoice cancelled.");
    } catch (e) {
      return handleError(e, "cancelInvoice");
    }
  });
}

/**
 * Billing statistics for dashboard and reports.
 */
function getBillingStats() {
  try {
    var today  = formatDate(now());
    var ym     = today.substring(0, 7);
    var rows   = getSheetData(SHEETS.INVOICES).filter(function(r) { return trimStr(r[0]) !== ""; });
    var active = rows.filter(function(r) { return String(r[17]) !== INVOICE_STATUS.CANCELLED; });

    var totalInvoices  = active.length;
    var paidCount      = active.filter(function(r) { return String(r[17]) === INVOICE_STATUS.PAID; }).length;
    var unpaidBalance  = roundTo2(active.reduce(function(s, r) { return s + toNumber(r[16], 0); }, 0));
    var todayBilling   = roundTo2(active
      .filter(function(r) { return r[7] ? formatDate(r[7]) === today : false; })
      .reduce(function(s, r) { return s + toNumber(r[14], 0); }, 0));
    var monthRevenue   = roundTo2(active
      .filter(function(r) { return r[7] ? formatDate(r[7]).startsWith(ym) : false; })
      .reduce(function(s, r) { return s + toNumber(r[14], 0); }, 0));

    return successResponse({
      totalInvoices : totalInvoices,
      paidCount     : paidCount,
      unpaidBalance : unpaidBalance,
      todayBilling  : todayBilling,
      monthRevenue  : monthRevenue,
    });
  } catch (e) {
    return handleError(e, "getBillingStats");
  }
}

/**
 * Outstanding invoices list for reports.
 */
function getOutstandingInvoices(token) {
  try {
    var err = _requireBillingRole(token); if (err) return err;
    var rows = getSheetData(SHEETS.INVOICES)
      .filter(function(r) {
        var st = String(r[17] || "");
        return trimStr(r[0]) !== "" && st !== INVOICE_STATUS.CANCELLED && st !== INVOICE_STATUS.PAID;
      })
      .map(_invRowToObj);
    rows.sort(function(a, b) { return a.invoiceDate.localeCompare(b.invoiceDate); });
    return successResponse(rows);
  } catch (e) {
    return handleError(e, "getOutstandingInvoices");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _requireBillingRole(token) {
  if (!token) return errorResponse("Authentication required.", ERROR_CODES.PERMISSION_DENIED);
  var cached = CacheService.getScriptCache().get(SESSION_PREFIX + trimStr(token));
  if (!cached) return errorResponse("Session expired.", ERROR_CODES.PERMISSION_DENIED);
  return null; // all authenticated roles can access billing
}

function _findBookingRow(bookingId) {
  var rows = getSheetData(SHEETS.BOOKINGS);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === bookingId && trimStr(rows[i][0]) !== "") return rows[i];
  }
  return null;
}

function _findActiveInvoiceForBooking(bookingId) {
  var rows = getSheetData(SHEETS.INVOICES);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][2]) === bookingId &&
        String(rows[i][17]) !== INVOICE_STATUS.CANCELLED &&
        trimStr(rows[i][0]) !== "") {
      return _invRowToObj(rows[i]);
    }
  }
  return null;
}

/**
 * Recalculate SubTotal from lines, then GrandTotal and BalanceDue.
 * SubTotal = sum of all line amounts
 * GrandTotal = SubTotal - Discount + Tax (min 0)
 * BalanceDue = GrandTotal - PaidAmount (min 0)
 */
function _recalcInvoiceTotals(invoiceId) {
  var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
  if (rowIdx === -1) return;

  var sheet  = getSheet(SHEETS.INVOICES);
  var invRow = sheet.getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];

  var lines = getSheetData(SHEETS.INVOICE_LINES).filter(function(r) {
    return String(r[1]) === invoiceId && trimStr(r[0]) !== "";
  });
  var subTotal = roundTo2(lines.reduce(function(s, r) { return s + toNumber(r[6], 0); }, 0));

  var discount = toNumber(invRow[12], 0);
  var tax      = toNumber(invRow[13], 0);
  var paid     = toNumber(invRow[15], 0);

  // Clamp discount
  if (discount > subTotal) discount = subTotal;

  var grandTotal = roundTo2(subTotal - discount + tax);
  if (grandTotal < 0) grandTotal = 0;

  var balanceDue = roundTo2(grandTotal - paid);
  if (balanceDue < 0) balanceDue = 0;

  // Update status
  var status = String(invRow[17] || "");
  if (status !== INVOICE_STATUS.CANCELLED) {
    if (paid >= grandTotal && grandTotal > 0)  status = INVOICE_STATUS.PAID;
    else if (paid > 0)                          status = INVOICE_STATUS.PARTIALLY_PAID;
    else                                        status = INVOICE_STATUS.DRAFT;
  }

  sheet.getRange(rowIdx, 12).setValue(subTotal);   // SubTotal
  sheet.getRange(rowIdx, 13).setValue(roundTo2(discount)); // Discount (clamped)
  sheet.getRange(rowIdx, 15).setValue(grandTotal); // GrandTotal
  sheet.getRange(rowIdx, 17).setValue(balanceDue); // BalanceDue
  sheet.getRange(rowIdx, 18).setValue(status);     // Status
  sheet.getRange(rowIdx, 21).setValue(formatDateTime(now())); // UpdatedAt
}

/**
 * Keep the single ledger entry for this invoice in sync with the current GrandTotal.
 */
function _syncLedgerForInvoice(invoiceId) {
  var rowIdx = findRowById(SHEETS.INVOICES, invoiceId, 1);
  if (rowIdx === -1) return;
  var invRow     = getSheet(SHEETS.INVOICES).getRange(rowIdx, 1, 1, HEADERS.INVOICES.length).getValues()[0];
  var grandTotal = toNumber(invRow[14], 0);
  _updateLedgerEntry(invoiceId, LEDGER_TYPES.INCOME, 0, grandTotal);
}

/**
 * Build a full invoice object with its lines for the frontend.
 */
function _buildInvoiceObj(invoiceId) {
  var rows = getSheetData(SHEETS.INVOICES);
  var invRow = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === invoiceId && trimStr(rows[i][0]) !== "") {
      invRow = rows[i]; break;
    }
  }
  if (!invRow) return null;

  var obj = _invRowToObj(invRow);
  obj.lines = getSheetData(SHEETS.INVOICE_LINES)
    .filter(function(r) { return String(r[1]) === invoiceId && trimStr(r[0]) !== ""; })
    .map(_lineRowToObj);

  return obj;
}

function _invRowToObj(row) {
  return {
    invoiceId   : String(row[0]  || ""),
    invoiceNo   : String(row[1]  || ""),
    bookingId   : String(row[2]  || ""),
    guestId     : String(row[3]  || ""),
    guestName   : String(row[4]  || ""),
    roomId      : String(row[5]  || ""),
    roomNumber  : String(row[6]  || ""),
    invoiceDate : row[7]  ? formatDate(row[7])  : "",
    checkInDate : row[8]  ? formatDate(row[8])  : "",
    checkOutDate: row[9]  ? formatDate(row[9])  : "",
    nights      : toNumber(row[10], 0),
    subTotal    : roundTo2(toNumber(row[11], 0)),
    discount    : roundTo2(toNumber(row[12], 0)),
    tax         : roundTo2(toNumber(row[13], 0)),
    grandTotal  : roundTo2(toNumber(row[14], 0)),
    paidAmount  : roundTo2(toNumber(row[15], 0)),
    balanceDue  : roundTo2(toNumber(row[16], 0)),
    status      : String(row[17] || ""),
    notes       : String(row[18] || ""),
    createdAt   : row[19] ? formatDateTime(row[19]) : "",
    updatedAt   : row[20] ? formatDateTime(row[20]) : "",
  };
}

function _lineRowToObj(row) {
  return {
    lineId      : String(row[0] || ""),
    invoiceId   : String(row[1] || ""),
    serviceType : String(row[2] || ""),
    description : String(row[3] || ""),
    quantity    : toNumber(row[4], 0),
    rate        : roundTo2(toNumber(row[5], 0)),
    amount      : roundTo2(toNumber(row[6], 0)),
    sourceModule: String(row[7] || ""),
    referenceId : String(row[8] || ""),
    createdAt   : row[9] ? formatDateTime(row[9]) : "",
  };
}
