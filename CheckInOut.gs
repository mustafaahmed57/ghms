// =============================================================================
// CHECK IN / CHECK OUT MODULE — CheckInOut.gs
// =============================================================================
//
// Handles one-click check-in and check-out operations.
// Each operation updates both the Booking row and the Room status.
//
//   Check In : Booking → Checked_In,  stamps CheckedInAt,  Room → Occupied
//   Check Out: Booking → Checked_Out, stamps CheckedOutAt, Room → Cleaning
//   Cancel   : handled by cancelBooking() in Bookings.gs,  Room → Available
//
// _updateRoomStatus() is shared with cancelBooking() in Bookings.gs —
// all .gs files compile into one global scope in GAS.
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function checkInBooking(bookingId) {
  return withScriptLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.BOOKINGS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.BOOKINGS.length).getValues()[0];
    var status   = String(existing[14]);

    if (status !== BOOKING_STATUS.CONFIRMED) {
      return errorResponse(
        "Only Confirmed bookings can be checked in. Current status: " + status + ".",
        ERROR_CODES.INVALID_STATUS
      );
    }

    var ts = formatDateTime(now());
    sheet.getRange(rowIdx, 15).setValue(BOOKING_STATUS.CHECKED_IN); // Status      col 15
    sheet.getRange(rowIdx, 17).setValue(ts);                          // CheckedInAt col 17
    sheet.getRange(rowIdx, 20).setValue(ts);                          // UpdatedAt   col 20

    _updateRoomStatus(String(existing[3]), ROOM_STATUS.OCCUPIED);

    return successResponse(
      { bookingId: bookingId, guestName: String(existing[2]), roomNumber: String(existing[4]) },
      "Guest " + String(existing[2]) + " checked in to Room " + String(existing[4]) + " successfully."
    );
  } catch (e) {
    return handleError(e, "checkInBooking");
  }
  }, 10000);
}

function checkOutBooking(bookingId) {
  return withScriptLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.BOOKINGS, bookingId, 1);
    if (rowIdx === -1) return errorResponse("Booking not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.BOOKINGS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.BOOKINGS.length).getValues()[0];
    var status   = String(existing[14]);

    if (status !== BOOKING_STATUS.CHECKED_IN) {
      return errorResponse(
        "Only Checked-In bookings can be checked out. Current status: " + status + ".",
        ERROR_CODES.INVALID_STATUS
      );
    }

    var ts = formatDateTime(now());
    sheet.getRange(rowIdx, 15).setValue(BOOKING_STATUS.CHECKED_OUT); // Status       col 15
    sheet.getRange(rowIdx, 18).setValue(ts);                           // CheckedOutAt col 18
    sheet.getRange(rowIdx, 20).setValue(ts);                           // UpdatedAt    col 20

    _updateRoomStatus(String(existing[3]), ROOM_STATUS.CLEANING);

    return successResponse(
      { bookingId: bookingId, guestName: String(existing[2]), roomNumber: String(existing[4]) },
      "Guest " + String(existing[2]) + " checked out of Room " + String(existing[4]) + ". Room queued for cleaning."
    );
  } catch (e) {
    return handleError(e, "checkOutBooking");
  }
  }, 10000);
}

/**
 * Returns Confirmed (pending check-in) and Checked_In (in-house) bookings
 * in one round-trip for the Check In / Check Out front-end page.
 */
function getCheckInOutData() {
  try {
    var ciRes = listBookings({ status: BOOKING_STATUS.CONFIRMED  });
    var coRes = listBookings({ status: BOOKING_STATUS.CHECKED_IN });
    return successResponse({
      pendingCheckIns : ciRes.success ? ciRes.data : [],
      pendingCheckOuts: coRes.success ? coRes.data : [],
    });
  } catch (e) {
    return handleError(e, "getCheckInOutData");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Updates a room's Status and UpdatedAt columns in-place.
 * Called from checkInBooking, checkOutBooking, and cancelBooking (Bookings.gs).
 * Fails silently — never blocks the main booking operation.
 */
function _updateRoomStatus(roomId, newStatus) {
  try {
    var rowIdx = findRowById(SHEETS.ROOMS, roomId, 1);
    if (rowIdx === -1) return;
    var sheet = getSheet(SHEETS.ROOMS);
    sheet.getRange(rowIdx, 7).setValue(newStatus);              // Status    col 7  (1-based)
    sheet.getRange(rowIdx, 10).setValue(formatDateTime(now())); // UpdatedAt col 10 (1-based)
  } catch (e) {
    console.error("[_updateRoomStatus] roomId=" + roomId + " status=" + newStatus + " err=" + e.message);
  }
}
