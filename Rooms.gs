// =============================================================================
// ROOMS MODULE — Rooms.gs
// =============================================================================
//
// Sheet columns (HEADERS.ROOMS, 0-based):
//   0 RoomID  1 RoomNumber  2 RoomType  3 Floor  4 Capacity
//   5 RatePerNight  6 Status  7 Description  8 CreatedAt  9 UpdatedAt
// =============================================================================


// =============================================================================
// PUBLIC API — callable via google.script.run
// =============================================================================

function addRoom(data) {
  return withUserLock(function() {
  try {
    var roomNumber = trimStr(data.roomNumber || "");
    var roomType   = trimStr(data.roomType   || "");
    var status     = trimStr(data.status     || ROOM_STATUS.AVAILABLE);
    var price      = toNumber(data.pricePerNight, 0);
    var floor      = toNumber(data.floor, 0);
    var notes      = trimStr(data.notes || "");

    if (isBlank(roomNumber))       return errorResponse("Room number is required.",                      ERROR_CODES.MISSING_FIELD);
    if (isBlank(roomType))         return errorResponse("Room type is required.",                        ERROR_CODES.MISSING_FIELD);
    if (isBlank(status))           return errorResponse("Status is required.",                           ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(price))  return errorResponse("Price per night must be a positive number.",    ERROR_CODES.VALIDATION_FAILED);
    if (!_isRoomNumberUnique(roomNumber, null)) {
      return errorResponse('Room number "' + roomNumber + '" is already in use.', ERROR_CODES.DUPLICATE_ENTRY);
    }

    var roomId = getNextId("ROOMS");
    var ts     = formatDateTime(now());

    var row = [
      roomId,
      roomNumber,
      roomType,
      floor,
      1,              // Capacity — reserved for future use
      roundTo2(price),
      status,
      notes,
      ts,
      ts,
    ];

    appendRow(SHEETS.ROOMS, row);
    return successResponse(_roomRowToObj(row), "Room " + roomNumber + " added successfully.");
  } catch (e) {
    return handleError(e, "addRoom");
  }
  }, 6000);
}

function updateRoom(roomId, data) {
  return withUserLock(function() {
  try {
    var roomNumber = trimStr(data.roomNumber || "");
    var roomType   = trimStr(data.roomType   || "");
    var status     = trimStr(data.status     || "");
    var price      = toNumber(data.pricePerNight, 0);
    var floor      = toNumber(data.floor, 0);
    var notes      = trimStr(data.notes || "");

    if (isBlank(roomNumber))       return errorResponse("Room number is required.",                     ERROR_CODES.MISSING_FIELD);
    if (isBlank(roomType))         return errorResponse("Room type is required.",                       ERROR_CODES.MISSING_FIELD);
    if (isBlank(status))           return errorResponse("Status is required.",                          ERROR_CODES.MISSING_FIELD);
    if (!isPositiveNumber(price))  return errorResponse("Price per night must be a positive number.",   ERROR_CODES.VALIDATION_FAILED);
    if (!_isRoomNumberUnique(roomNumber, roomId)) {
      return errorResponse('Room number "' + roomNumber + '" is already in use by another room.', ERROR_CODES.DUPLICATE_ENTRY);
    }

    var rowIdx = findRowById(SHEETS.ROOMS, roomId, 1);
    if (rowIdx === -1) return errorResponse("Room not found.", ERROR_CODES.RECORD_NOT_FOUND);

    var sheet    = getSheet(SHEETS.ROOMS);
    var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.ROOMS.length).getValues()[0];

    var row = [
      roomId,
      roomNumber,
      roomType,
      floor,
      existing[4] || 1,     // preserve Capacity
      roundTo2(price),
      status,
      notes,
      existing[8],          // preserve CreatedAt
      formatDateTime(now()),
    ];

    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    return successResponse(_roomRowToObj(row), "Room " + roomNumber + " updated successfully.");
  } catch (e) {
    return handleError(e, "updateRoom");
  }
  }, 6000);
}

function deleteRoom(roomId) {
  return withUserLock(function() {
  try {
    var rowIdx = findRowById(SHEETS.ROOMS, roomId, 1);
    if (rowIdx === -1) return errorResponse("Room not found.", ERROR_CODES.RECORD_NOT_FOUND);

    if (_hasActiveBooking(roomId)) {
      return errorResponse(
        "Cannot delete — this room has an active booking. Cancel or complete the booking first.",
        ERROR_CODES.ROOM_UNAVAILABLE
      );
    }

    getSheet(SHEETS.ROOMS).deleteRow(rowIdx);
    return successResponse({ roomId: roomId }, "Room deleted successfully.");
  } catch (e) {
    return handleError(e, "deleteRoom");
  }
  }, 6000);
}

function getRoomById(roomId) {
  try {
    var rowIdx = findRowById(SHEETS.ROOMS, roomId, 1);
    if (rowIdx === -1) return errorResponse("Room not found.", ERROR_CODES.RECORD_NOT_FOUND);
    var row = getSheet(SHEETS.ROOMS).getRange(rowIdx, 1, 1, HEADERS.ROOMS.length).getValues()[0];
    return successResponse(_roomRowToObj(row));
  } catch (e) {
    return handleError(e, "getRoomById");
  }
}

/**
 * filters: { status, roomType, search }  — all optional.
 * Filtering is done server-side to keep payloads small.
 */
function listRooms(filters) {
  try {
    var rows  = getSheetData(SHEETS.ROOMS);
    var rooms = rows
      .filter(function (r) { return trimStr(r[0]) !== ""; })
      .map(_roomRowToObj);

    if (filters) {
      if (filters.status) {
        rooms = rooms.filter(function (r) { return r.status === filters.status; });
      }
      if (filters.roomType) {
        rooms = rooms.filter(function (r) { return r.roomType === filters.roomType; });
      }
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        rooms = rooms.filter(function (r) {
          return r.roomNumber.toLowerCase().indexOf(q) !== -1 ||
                 r.roomType.toLowerCase().indexOf(q)   !== -1 ||
                 r.notes.toLowerCase().indexOf(q)      !== -1;
        });
      }
    }

    return successResponse(rooms);
  } catch (e) {
    return handleError(e, "listRooms");
  }
}

function getRoomStats() {
  try {
    var res = listRooms(null);
    if (!res.success) return res;
    var stats = { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
    res.data.forEach(function (r) {
      stats.total++;
      switch (r.status) {
        case ROOM_STATUS.AVAILABLE:    stats.available++;   break;
        case ROOM_STATUS.OCCUPIED:     stats.occupied++;    break;
        case ROOM_STATUS.RESERVED:     stats.reserved++;    break;
        case "Cleaning":               stats.cleaning++;    break;
        case ROOM_STATUS.MAINTENANCE:  stats.maintenance++; break;
      }
    });
    return successResponse(stats);
  } catch (e) {
    return handleError(e, "getRoomStats");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _roomRowToObj(row) {
  return {
    roomId        : String(row[0]),
    roomNumber    : String(row[1]),
    roomType      : String(row[2]),
    floor         : toNumber(row[3], 0),
    capacity      : toNumber(row[4], 1),
    pricePerNight : toNumber(row[5], 0),
    status        : String(row[6]),
    notes         : String(row[7] !== undefined ? row[7] : ""),
    createdAt     : row[8] ? formatDateTime(row[8]) : "",
    updatedAt     : row[9] ? formatDateTime(row[9]) : "",
  };
}

function _isRoomNumberUnique(roomNumber, excludeRoomId) {
  var sheet   = getSheet(SHEETS.ROOMS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;
  var data   = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // [RoomID, RoomNumber]
  var target = trimStr(roomNumber).toLowerCase();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === target) {
      if (excludeRoomId && String(data[i][0]) === String(excludeRoomId)) continue;
      return false;
    }
  }
  return true;
}

/**
 * Returns true if roomId has a Confirmed or Checked_In booking.
 * Reads columns 1-15 → indices 0-14:  RoomID=3, Status=14
 */
function _hasActiveBooking(roomId) {
  try {
    var sheet   = getSheet(SHEETS.BOOKINGS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    var data   = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    var active = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN];
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][3]) === String(roomId) &&
          active.indexOf(String(data[i][14])) !== -1) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("[_hasActiveBooking] " + e.message);
    return false; // fail open — Bookings sheet may not exist yet
  }
}
