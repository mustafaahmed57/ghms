// =============================================================================
// GUESTS MODULE — Guests.gs
// =============================================================================
//
// Sheet columns (HEADERS.GUESTS, 0-based):
//   0 GuestID   1 FirstName  2 LastName  3 CNIC     4 Phone
//   5 Email     6 Address    7 City      8 Nationality(=Notes)
//   9 CreatedAt 10 UpdatedAt
//
// Field mapping:
//   guestName → stored in FirstName (col 1); LastName (col 2) left blank
//   notes     → stored in Nationality (col 8)
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addGuest(data) {
  return withUserLock(function() {
  try {
    var name    = trimStr(data.guestName || "");
    var phone   = trimStr(data.phone    || "").replace(/\D/g, "");
    var cnic    = trimStr(data.cnic     || "").replace(/\D/g, "");
    var email   = trimStr(data.email    || "").toLowerCase();
    var address = trimStr(data.address  || "");
    var city    = trimStr(data.city     || "");
    var notes   = trimStr(data.notes    || "");

    if (isBlank(name))  return errorResponse("Guest name is required.",   ERROR_CODES.MISSING_FIELD);
    if (isBlank(phone)) return errorResponse("Phone number is required.", ERROR_CODES.MISSING_FIELD);
    if (isBlank(cnic))  return errorResponse("CNIC is required.",         ERROR_CODES.MISSING_FIELD);

    if (!_isPKPhone(phone)) {
      return errorResponse(
        "Phone must be exactly 11 digits and start with 03 (e.g. 03001234567).",
        ERROR_CODES.VALIDATION_FAILED
      );
    }
    if (!_isCNIC13(cnic)) {
      return errorResponse(
        "CNIC must be exactly 13 digits (e.g. 3520112345671).",
        ERROR_CODES.VALIDATION_FAILED
      );
    }
    if (email && !isValidEmail(email)) {
      return errorResponse("Invalid email address.", ERROR_CODES.VALIDATION_FAILED);
    }

    if (!_isPhoneUnique(phone, null)) {
      return errorResponse('Phone "' + phone + '" is already registered.', ERROR_CODES.DUPLICATE_ENTRY);
    }
    if (!_isCNICUnique(cnic, null)) {
      return errorResponse('CNIC "' + cnic + '" is already registered.', ERROR_CODES.DUPLICATE_ENTRY);
    }
    if (email && !_isEmailUnique(email, null)) {
      return errorResponse('Email "' + email + '" is already registered.', ERROR_CODES.DUPLICATE_ENTRY);
    }

    var guestId = getNextId("GUESTS");
    var ts      = formatDateTime(now());

    var row = [
      guestId,
      name,    // FirstName — stores full name
      "",      // LastName  — reserved
      cnic,
      phone,
      email,
      address,
      city,
      notes,   // Nationality column repurposed for notes
      ts,
      ts,
    ];

    appendRow(SHEETS.GUESTS, row);
    return successResponse(_guestRowToObj(row), "Guest " + name + " registered successfully.");
  } catch (e) {
    return handleError(e, "addGuest");
  }
  }, 6000);
}

function updateGuest(guestId, data) {
  return withUserLock(function() {
  try {
    var name    = trimStr(data.guestName || "");
    var phone   = trimStr(data.phone    || "").replace(/\D/g, "");
    var cnic    = trimStr(data.cnic     || "").replace(/\D/g, "");
    var email   = trimStr(data.email    || "").toLowerCase();
    var address = trimStr(data.address  || "");
    var city    = trimStr(data.city     || "");
    var notes   = trimStr(data.notes    || "");

    if (isBlank(name))  return errorResponse("Guest name is required.",   ERROR_CODES.MISSING_FIELD);
    if (isBlank(phone)) return errorResponse("Phone number is required.", ERROR_CODES.MISSING_FIELD);
    if (isBlank(cnic))  return errorResponse("CNIC is required.",         ERROR_CODES.MISSING_FIELD);

    if (!_isPKPhone(phone)) {
      return errorResponse(
        "Phone must be exactly 11 digits and start with 03.",
        ERROR_CODES.VALIDATION_FAILED
      );
    }
    if (!_isCNIC13(cnic)) {
      return errorResponse("CNIC must be exactly 13 digits.", ERROR_CODES.VALIDATION_FAILED);
    }
    if (email && !isValidEmail(email)) {
      return errorResponse("Invalid email address.", ERROR_CODES.VALIDATION_FAILED);
    }

    if (!_isPhoneUnique(phone, guestId)) {
      return errorResponse('Phone "' + phone + '" is already registered by another guest.', ERROR_CODES.DUPLICATE_ENTRY);
    }
    if (!_isCNICUnique(cnic, guestId)) {
      return errorResponse('CNIC "' + cnic + '" is already registered by another guest.', ERROR_CODES.DUPLICATE_ENTRY);
    }
    if (email && !_isEmailUnique(email, guestId)) {
      return errorResponse('Email "' + email + '" is already registered by another guest.', ERROR_CODES.DUPLICATE_ENTRY);
    }

    var rowIdx = findRowById(SHEETS.GUESTS, guestId, 1);
    if (rowIdx === -1) return errorResponse("Guest not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.GUESTS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.GUESTS.length).getValues()[0];

    var row = [
      guestId,
      name,
      "",
      cnic,
      phone,
      email,
      address,
      city,
      notes,
      existing[9],           // preserve CreatedAt
      formatDateTime(now()),
    ];

    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    return successResponse(_guestRowToObj(row), "Guest " + name + " updated successfully.");
  } catch (e) {
    return handleError(e, "updateGuest");
  }
  }, 6000);
}

function deleteGuest(guestId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.GUESTS, guestId, 1);
    if (rowIdx === -1) return errorResponse("Guest not found.", ERROR_CODES.RECORD_NOT_FOUND);

    if (_guestHasActiveBooking(guestId)) {
      return errorResponse(
        "Cannot delete — this guest has an active booking. Cancel or complete the booking first.",
        ERROR_CODES.VALIDATION_FAILED
      );
    }

    getSheet(SHEETS.GUESTS).deleteRow(rowIdx);
    return successResponse({ guestId: guestId }, "Guest deleted successfully.");
  } catch (e) {
    return handleError(e, "deleteGuest");
  }
  }, 6000);
}

function getGuestById(guestId) {
  try {
    var rowIdx = findRowById(SHEETS.GUESTS, guestId, 1);
    if (rowIdx === -1) return errorResponse("Guest not found.", ERROR_CODES.RECORD_NOT_FOUND);
    var row = getSheet(SHEETS.GUESTS).getRange(rowIdx, 1, 1, HEADERS.GUESTS.length).getValues()[0];
    return successResponse(_guestRowToObj(row));
  } catch (e) {
    return handleError(e, "getGuestById");
  }
}

/**
 * filters: { search, city }  — all optional.
 */
function listGuests(filters) {
  try {
    var rows   = getSheetData(SHEETS.GUESTS);
    var guests = rows
      .filter(function (r) { return trimStr(r[0]) !== ""; })
      .map(_guestRowToObj);

    if (filters) {
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        guests = guests.filter(function (g) {
          return g.guestName.toLowerCase().indexOf(q) !== -1 ||
                 g.phone.toLowerCase().indexOf(q)     !== -1 ||
                 g.cnic.toLowerCase().indexOf(q)      !== -1 ||
                 g.city.toLowerCase().indexOf(q)      !== -1 ||
                 g.email.toLowerCase().indexOf(q)     !== -1;
        });
      }
      if (filters.city) {
        guests = guests.filter(function (g) { return g.city === filters.city; });
      }
    }

    return successResponse(guests);
  } catch (e) {
    return handleError(e, "listGuests");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _guestRowToObj(row) {
  var firstName = trimStr(row[1]);
  var lastName  = trimStr(row[2]);
  return {
    guestId   : String(row[0]),
    guestName : lastName ? firstName + " " + lastName : firstName,
    cnic      : String(row[3] || ""),
    phone     : String(row[4] || ""),
    email     : String(row[5] || ""),
    address   : String(row[6] || ""),
    city      : String(row[7] || ""),
    notes     : String(row[8] || ""),
    createdAt : row[9]  ? formatDateTime(row[9])  : "",
    updatedAt : row[10] ? formatDateTime(row[10]) : "",
  };
}

function _isPKPhone(phone) {
  var digits = String(phone).replace(/\D/g, "");
  return digits.length === 11 && digits.slice(0, 2) === "03";
}

function _isCNIC13(cnic) {
  var digits = String(cnic).replace(/\D/g, "");
  return digits.length === 13;
}

function _isPhoneUnique(phone, excludeGuestId) {
  var sheet   = getSheet(SHEETS.GUESTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var data   = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var target = trimStr(phone).replace(/\D/g, "");
  for (var i = 0; i < data.length; i++) {
    if (trimStr(String(data[i][4])).replace(/\D/g, "") === target) {
      if (excludeGuestId && String(data[i][0]) === String(excludeGuestId)) continue;
      return false;
    }
  }
  return true;
}

function _isCNICUnique(cnic, excludeGuestId) {
  var sheet   = getSheet(SHEETS.GUESTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var data   = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var target = trimStr(cnic).replace(/\D/g, "");
  for (var i = 0; i < data.length; i++) {
    if (trimStr(String(data[i][3])).replace(/\D/g, "") === target) {
      if (excludeGuestId && String(data[i][0]) === String(excludeGuestId)) continue;
      return false;
    }
  }
  return true;
}

function _isEmailUnique(email, excludeGuestId) {
  if (!email) return true;
  var sheet   = getSheet(SHEETS.GUESTS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var data   = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var target = trimStr(email).toLowerCase();
  for (var i = 0; i < data.length; i++) {
    var stored = trimStr(String(data[i][5])).toLowerCase();
    if (stored && stored === target) {
      if (excludeGuestId && String(data[i][0]) === String(excludeGuestId)) continue;
      return false;
    }
  }
  return true;
}

/**
 * Returns true if guestId has a Confirmed or Checked_In booking.
 * Bookings columns: GuestID=1, Status=14 (0-based, reading 15 cols)
 */
function _guestHasActiveBooking(guestId) {
  try {
    var sheet   = getSheet(SHEETS.BOOKINGS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    var data   = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    var active = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1]) === String(guestId) &&
          active.indexOf(String(data[i][14])) !== -1) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("[_guestHasActiveBooking] " + e.message);
    return false;
  }
}
