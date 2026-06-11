// =============================================================================
// BOOKINGS MODULE — Bookings.gs
// =============================================================================
//
// Sheet columns (HEADERS.BOOKINGS, 0-based):
//   0  BookingID       1  GuestID         2  GuestName      3  RoomID         4  RoomNumber
//   5  CheckIn         6  CheckOut        7  Nights         8  Adults→Tax     9  Children→Advance
//  10  RatePerNight   11  TotalAmount    12  Discount       13 NetAmount      14 Status
//  15  SpecialRequests 16 CheckedInAt   17  CheckedOutAt   18 CreatedAt      19 UpdatedAt
//
// Column repurposing (MVP — adults/children tracking not required):
//   Adults(8)   → TaxAmount   (PKR)
//   Children(9) → AdvancePaid (PKR)
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function createBooking(data) {
  return withScriptLock(function() {
  try {
    var guestId     = trimStr(data.guestId     || "");
    var roomId      = trimStr(data.roomId      || "");
    var checkIn     = trimStr(data.checkIn     || "");
    var checkOut    = trimStr(data.checkOut    || "");
    var rate        = toNumber(data.ratePerNight, 0);
    var discount    = toNumber(data.discount,     0);
    var taxAmount   = toNumber(data.taxAmount,    0);
    var advancePaid = toNumber(data.advancePaid,  0);
    var notes       = trimStr(data.notes || "");

    if (isBlank(guestId))  return errorResponse("Please select a guest.",                         ERROR_CODES.MISSING_FIELD);
    if (isBlank(roomId))   return errorResponse("Please select a room.",                           ERROR_CODES.MISSING_FIELD);
    if (isBlank(checkIn))  return errorResponse("Check-in date is required.",                      ERROR_CODES.MISSING_FIELD);
    if (isBlank(checkOut)) return errorResponse("Check-out date is required.",                     ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(rate))          return errorResponse("Rate per night must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(discount))   return errorResponse("Discount cannot be negative.",             ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(taxAmount))  return errorResponse("Tax amount cannot be negative.",           ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(advancePaid))return errorResponse("Advance paid cannot be negative.",         ERROR_CODES.VALIDATION_FAILED);

    var nights = daysBetween(checkIn, checkOut);
    if (nights <= 0) {
      return errorResponse("Check-out date must be after check-in date.", ERROR_CODES.INVALID_DATE_RANGE);
    }

    if (!_isRoomAvailable(roomId, checkIn, checkOut, null)) {
      return errorResponse(
        "This room is already booked for the selected dates. Choose different dates or another room.",
        ERROR_CODES.ROOM_UNAVAILABLE
      );
    }

    var guestName  = _getGuestName(guestId);
    var roomNumber = _getRoomNumber(roomId);
    if (!guestName)  return errorResponse("Guest not found.",  ERROR_CODES.RECORD_NOT_FOUND);
    if (!roomNumber) return errorResponse("Room not found.",   ERROR_CODES.RECORD_NOT_FOUND);

    var bookingId   = getNextId("BOOKINGS");
    var totalAmount = roundTo2(nights * rate);
    var netAmount   = roundTo2(totalAmount - discount + taxAmount);
    if (netAmount < 0) netAmount = 0;
    var ts          = formatDateTime(now());

    var row = [
      bookingId,
      guestId,
      guestName,
      roomId,
      roomNumber,
      checkIn,
      checkOut,
      nights,
      roundTo2(taxAmount),    // Adults column → TaxAmount
      roundTo2(advancePaid),  // Children column → AdvancePaid
      roundTo2(rate),
      totalAmount,
      roundTo2(discount),
      netAmount,
      BOOKING_STATUS.CONFIRMED,
      notes,
      "",   // CheckedInAt
      "",   // CheckedOutAt
      ts,
      ts,
    ];

    appendRow(SHEETS.BOOKINGS, row);
    return successResponse(_bookingRowToObj(row), "Booking " + bookingId + " created successfully.");
  } catch (e) {
    return handleError(e, "createBooking");
  }
  }, 10000);
}

function updateBooking(bookingId, data) {
  return withScriptLock(function() {
  try {
    var guestId     = trimStr(data.guestId     || "");
    var roomId      = trimStr(data.roomId      || "");
    var checkIn     = trimStr(data.checkIn     || "");
    var checkOut    = trimStr(data.checkOut    || "");
    var rate        = toNumber(data.ratePerNight, 0);
    var discount    = toNumber(data.discount,     0);
    var taxAmount   = toNumber(data.taxAmount,    0);
    var advancePaid = toNumber(data.advancePaid,  0);
    var status      = trimStr(data.status || BOOKING_STATUS.CONFIRMED);
    var notes       = trimStr(data.notes  || "");

    if (isBlank(guestId))  return errorResponse("Please select a guest.",        ERROR_CODES.MISSING_FIELD);
    if (isBlank(roomId))   return errorResponse("Please select a room.",          ERROR_CODES.MISSING_FIELD);
    if (isBlank(checkIn))  return errorResponse("Check-in date is required.",     ERROR_CODES.MISSING_FIELD);
    if (isBlank(checkOut)) return errorResponse("Check-out date is required.",    ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(rate))           return errorResponse("Rate per night must be a positive number.", ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(discount))    return errorResponse("Discount cannot be negative.",              ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(taxAmount))   return errorResponse("Tax amount cannot be negative.",            ERROR_CODES.VALIDATION_FAILED);
    if (!isNonNegativeNumber(advancePaid)) return errorResponse("Advance paid cannot be negative.",          ERROR_CODES.VALIDATION_FAILED);

    var nights = daysBetween(checkIn, checkOut);
    if (nights <= 0) {
      return errorResponse("Check-out date must be after check-in date.", ERROR_CODES.INVALID_DATE_RANGE);
    }

    if (!_isRoomAvailable(roomId, checkIn, checkOut, bookingId)) {
      return errorResponse(
        "This room is already booked for the selected dates.",
        ERROR_CODES.ROOM_UNAVAILABLE
      );
    }

    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.BOOKINGS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.BOOKINGS.length).getValues()[0];

    var guestName  = _getGuestName(guestId)   || String(existing[2]);
    var roomNumber = _getRoomNumber(roomId)   || String(existing[4]);

    var totalAmount = roundTo2(nights * rate);
    var netAmount   = roundTo2(totalAmount - discount + taxAmount);
    if (netAmount < 0) netAmount = 0;

    // Stamp check-in/out timestamps on first status transition
    var checkedInAt  = existing[16] || "";
    var checkedOutAt = existing[17] || "";
    if (status === BOOKING_STATUS.CHECKED_IN  && !checkedInAt)  checkedInAt  = formatDateTime(now());
    if (status === BOOKING_STATUS.CHECKED_OUT && !checkedOutAt) checkedOutAt = formatDateTime(now());

    var row = [
      bookingId,
      guestId,
      guestName,
      roomId,
      roomNumber,
      checkIn,
      checkOut,
      nights,
      roundTo2(taxAmount),
      roundTo2(advancePaid),
      roundTo2(rate),
      totalAmount,
      roundTo2(discount),
      netAmount,
      status,
      notes,
      checkedInAt,
      checkedOutAt,
      existing[18],          // preserve CreatedAt
      formatDateTime(now()),
    ];

    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    return successResponse(_bookingRowToObj(row), "Booking updated successfully.");
  } catch (e) {
    return handleError(e, "updateBooking");
  }
  }, 10000);
}

function cancelBooking(bookingId) {
  return withScriptLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.BOOKINGS);
    var existing = sheet.getRange(rowIdx, 1, 1, 15).getValues()[0];
    var status   = String(existing[14]);

    if (status === BOOKING_STATUS.CHECKED_OUT) {
      return errorResponse("Cannot cancel a booking that has already been checked out.", ERROR_CODES.INVALID_STATUS);
    }
    if (status === BOOKING_STATUS.CANCELLED) {
      return errorResponse("Booking is already cancelled.", ERROR_CODES.INVALID_STATUS);
    }

    sheet.getRange(rowIdx, 15).setValue(BOOKING_STATUS.CANCELLED);  // Status column (1-based 15)
    sheet.getRange(rowIdx, 20).setValue(formatDateTime(now()));       // UpdatedAt column (1-based 20)

    _updateRoomStatus(String(existing[3]), ROOM_STATUS.AVAILABLE);

    return successResponse({ bookingId: bookingId }, "Booking " + bookingId + " has been cancelled.");
  } catch (e) {
    return handleError(e, "cancelBooking");
  }
  }, 10000);
}

function getBookingById(bookingId) {
  try {
    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);
    var row = getSheet(SHEETS.BOOKINGS).getRange(rowIdx, 1, 1, HEADERS.BOOKINGS.length).getValues()[0];
    return successResponse(_bookingRowToObj(row));
  } catch (e) {
    return handleError(e, "getBookingById");
  }
}

/**
 * filters: { status, search, guestId }  — all optional.
 * Returns bookings sorted newest-first by CreatedAt.
 */
function listBookings(filters) {
  try {
    var rows     = getSheetData(SHEETS.BOOKINGS);
    var bookings = rows
      .filter(function (r) { return trimStr(r[0]) !== ""; })
      .map(_bookingRowToObj);

    if (filters) {
      if (filters.status) {
        bookings = bookings.filter(function (b) { return b.status === filters.status; });
      }
      if (filters.guestId) {
        bookings = bookings.filter(function (b) { return b.guestId === filters.guestId; });
      }
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        bookings = bookings.filter(function (b) {
          return b.bookingId.toLowerCase().indexOf(q)  !== -1 ||
                 b.guestName.toLowerCase().indexOf(q)  !== -1 ||
                 b.roomNumber.toLowerCase().indexOf(q) !== -1;
        });
      }
    }

    bookings.sort(function (a, b) {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

    return successResponse(bookings);
  } catch (e) {
    return handleError(e, "listBookings");
  }
}

/**
 * Returns guests + rooms in one round-trip for the booking form dropdowns.
 */
function getBookingFormData() {
  try {
    var guestsRes = listGuests(null);
    var roomsRes  = listRooms(null);
    return successResponse({
      guests: guestsRes.success ? guestsRes.data : [],
      rooms : roomsRes.success  ? roomsRes.data  : [],
    });
  } catch (e) {
    return handleError(e, "getBookingFormData");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _bookingRowToObj(row) {
  var taxAmount   = toNumber(row[8],  0);
  var advancePaid = toNumber(row[9],  0);
  var totalAmount = toNumber(row[11], 0);
  var netAmount   = toNumber(row[13], 0);
  var balance     = roundTo2(netAmount - advancePaid);

  return {
    bookingId   : String(row[0]),
    guestId     : String(row[1]),
    guestName   : String(row[2]),
    roomId      : String(row[3]),
    roomNumber  : String(row[4]),
    checkIn     : row[5]  ? formatDate(row[5])     : "",
    checkOut    : row[6]  ? formatDate(row[6])     : "",
    nights      : toNumber(row[7], 0),
    taxAmount   : taxAmount,
    advancePaid : advancePaid,
    ratePerNight: toNumber(row[10], 0),
    totalAmount : totalAmount,
    discount    : toNumber(row[12], 0),
    netAmount   : netAmount,
    balance     : balance < 0 ? 0 : balance,
    status      : String(row[14]),
    notes       : String(row[15] || ""),
    checkedInAt : row[16] ? formatDateTime(row[16]) : "",
    checkedOutAt: row[17] ? formatDateTime(row[17]) : "",
    createdAt   : row[18] ? formatDateTime(row[18]) : "",
    updatedAt   : row[19] ? formatDateTime(row[19]) : "",
  };
}

/**
 * Returns true when no active (Confirmed/Checked_In) booking for roomId
 * overlaps with [checkInStr, checkOutStr).
 * excludeBookingId skips a specific row (used when editing).
 */
function _isRoomAvailable(roomId, checkInStr, checkOutStr, excludeBookingId) {
  var sheet   = getSheet(SHEETS.BOOKINGS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;

  // Read 15 cols: indices 0-14 map to BookingID…Status
  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();

  for (var i = 0; i < data.length; i++) {
    var bId     = String(data[i][0]);
    var bRoomId = String(data[i][3]);
    var bStatus = String(data[i][14]);

    if (bRoomId !== String(roomId)) continue;
    if (bStatus !== BOOKING_STATUS.CONFIRMED && bStatus !== BOOKING_STATUS.CHECKED_IN) continue;
    if (excludeBookingId && bId === String(excludeBookingId)) continue;

    if (_datesOverlap(checkInStr, checkOutStr, data[i][5], data[i][6])) return false;
  }
  return true;
}

/**
 * Two date ranges [aIn,aOut) and [bIn,bOut) overlap when aIn < bOut AND aOut > bIn.
 */
function _datesOverlap(aIn, aOut, bIn, bOut) {
  var ai = _parseBookingDate(aIn);
  var ao = _parseBookingDate(aOut);
  var bi = _parseBookingDate(bIn);
  var bo = _parseBookingDate(bOut);
  if (!ai || !ao || !bi || !bo) return false;
  return ai.getTime() < bo.getTime() && ao.getTime() > bi.getTime();
}

function _parseBookingDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  var d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function _getGuestName(guestId) {
  try {
    var sheet   = getSheet(SHEETS.GUESTS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(guestId)) {
        var fn = trimStr(String(data[i][1]));
        var ln = trimStr(String(data[i][2]));
        return ln ? fn + " " + ln : fn;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function _getRoomNumber(roomId) {
  try {
    var sheet   = getSheet(SHEETS.ROOMS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === String(roomId)) return String(data[i][1]);
    }
    return null;
  } catch (e) {
    return null;
  }
}
