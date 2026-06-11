// =============================================================================
// CANDLEWOOD HOTEL & SUITES MANAGEMENT SYSTEM
// Foundation Layer — Code.gs
// Version: 1.0.0
// =============================================================================


// =============================================================================
// SECTION 1 — CONFIGURATION & CONSTANTS
// =============================================================================

const CONFIG = {
  SYSTEM_NAME      : "Candlewood Hotel & Suites Management System",
  VERSION          : "1.0.0",
  TIMEZONE         : "Asia/Karachi",
  DATE_FORMAT      : "yyyy-MM-dd",
  DATETIME_FORMAT  : "yyyy-MM-dd HH:mm:ss",
  LOCK_TIMEOUT_MS  : 30000,
  ID_PAD_LENGTH    : 4,
  HEADER_BG_COLOR  : "#1a237e",
  HEADER_FG_COLOR  : "#ffffff",
};

// ---------------------------------------------------------------------------
// Sheet name registry — single source of truth used everywhere
// ---------------------------------------------------------------------------
const SHEETS = {
  SETTINGS         : "Settings",
  ROOMS            : "Rooms",
  GUESTS           : "Guests",
  BOOKINGS         : "Bookings",
  ROOM_INCOME      : "Room_Income",
  ROOM_EXPENSE     : "Room_Expense",
  KITCHEN_INCOME   : "Kitchen_Income",
  KITCHEN_EXPENSE  : "Kitchen_Expense",
  PAYMENTS         : "Payments",
  LEDGER           : "Ledger",
  INVENTORY_ITEMS  : "Inventory_Items",
  STOCK_IN         : "Stock_In",
  STOCK_OUT        : "Stock_Out",
  STOCK_LEDGER     : "Stock_Ledger",
  INVOICES         : "Invoices",
  INVOICE_LINES    : "Invoice_Lines",
  USERS            : "Users",
};

// ---------------------------------------------------------------------------
// Settings-sheet keys that hold each entity's last-issued ID
// ---------------------------------------------------------------------------
const ID_KEYS = {
  ROOMS            : "LAST_RM_ID",
  GUESTS           : "LAST_GST_ID",
  BOOKINGS         : "LAST_BK_ID",
  ROOM_INCOME      : "LAST_RI_ID",
  ROOM_EXPENSE     : "LAST_RE_ID",
  KITCHEN_INCOME   : "LAST_KI_ID",
  KITCHEN_EXPENSE  : "LAST_KE_ID",
  PAYMENTS         : "LAST_PAY_ID",
  LEDGER           : "LAST_LED_ID",
  INVENTORY_ITEMS  : "LAST_ITM_ID",
  STOCK_IN         : "LAST_SIN_ID",
  STOCK_OUT        : "LAST_SOUT_ID",
  STOCK_LEDGER     : "LAST_SLG_ID",
  INVOICES         : "LAST_INV_ID",
  INVOICE_LINES    : "LAST_ILN_ID",
  USERS            : "LAST_USR_ID",
};

const ID_PREFIXES = {
  ROOMS            : "RM",
  GUESTS           : "GST",
  BOOKINGS         : "BK",
  ROOM_INCOME      : "RI",
  ROOM_EXPENSE     : "RE",
  KITCHEN_INCOME   : "KI",
  KITCHEN_EXPENSE  : "KE",
  PAYMENTS         : "PAY",
  LEDGER           : "LED",
  INVENTORY_ITEMS  : "ITM",
  STOCK_IN         : "SIN",
  STOCK_OUT        : "SOUT",
  STOCK_LEDGER     : "SLG",
  INVOICES         : "INV",
  INVOICE_LINES    : "ILN",
  USERS            : "USR",
};

// ---------------------------------------------------------------------------
// Column headers — keys MUST match SHEETS keys exactly
// ---------------------------------------------------------------------------
const HEADERS = {

  SETTINGS: [
    "Key", "Value", "Description", "UpdatedAt",
  ],

  ROOMS: [
    "RoomID", "RoomNumber", "RoomType", "Floor", "Capacity",
    "RatePerNight", "Status", "Description", "CreatedAt", "UpdatedAt",
  ],

  GUESTS: [
    "GuestID", "FirstName", "LastName", "CNIC", "Phone",
    "Email", "Address", "City", "Nationality", "CreatedAt", "UpdatedAt",
  ],

  BOOKINGS: [
    "BookingID", "GuestID", "GuestName", "RoomID", "RoomNumber",
    "CheckIn", "CheckOut", "Nights", "Adults", "Children",
    "RatePerNight", "TotalAmount", "Discount", "NetAmount",
    "Status", "SpecialRequests", "CheckedInAt", "CheckedOutAt",
    "CreatedAt", "UpdatedAt",
  ],

  ROOM_INCOME: [
    "IncomeID", "BookingID", "RoomID", "GuestID",
    "Category", "Amount", "PaymentMethod", "Description", "IncomeDate", "CreatedAt",
  ],

  ROOM_EXPENSE: [
    "ExpenseID", "RoomID", "Category",
    "Amount", "Description", "ExpenseDate", "CreatedAt",
  ],

  KITCHEN_INCOME: [
    "IncomeID", "BookingID", "GuestID",
    "Category", "Items", "Amount", "PaymentMethod", "IncomeDate", "CreatedAt",
  ],

  KITCHEN_EXPENSE: [
    "ExpenseID", "Category", "Items",
    "Amount", "Vendor", "ExpenseDate", "CreatedAt",
  ],

  PAYMENTS: [
    "PaymentID", "BookingID", "GuestName", "RoomNumber",
    "Amount", "PaymentMethod", "PaymentType",
    "Notes", "PaymentDate", "CreatedAt",
  ],

  LEDGER: [
    "LedgerID", "EntryDate", "EntryType", "Category", "SubCategory",
    "ReferenceID", "Description", "Debit", "Credit", "Balance", "CreatedAt",
  ],

  INVENTORY_ITEMS: [
    "ItemID", "ItemName", "Category", "UOM", "ReorderLevel",
    "CurrentStock", "Status", "Notes", "CreatedAt", "UpdatedAt",
  ],

  STOCK_IN: [
    "StockInID", "Date", "ItemID", "ItemName", "Category",
    "Quantity", "UnitCost", "TotalAmount", "Vendor", "PaymentMethod",
    "Notes", "CreatedAt",
  ],

  STOCK_OUT: [
    "StockOutID", "Date", "ItemID", "ItemName", "Category",
    "Quantity", "Purpose", "Department", "Notes", "CreatedAt",
  ],

  STOCK_LEDGER: [
    "StockLedgerID", "Date", "ItemID", "ItemName", "MovementType",
    "QuantityIn", "QuantityOut", "BalanceAfter", "ReferenceID",
    "SourceModule", "Notes", "CreatedAt",
  ],

  INVOICES: [
    "InvoiceID", "InvoiceNo", "BookingID", "GuestID", "GuestName",
    "RoomID", "RoomNumber", "InvoiceDate", "CheckInDate", "CheckOutDate",
    "Nights", "SubTotal", "Discount", "Tax", "GrandTotal",
    "PaidAmount", "BalanceDue", "Status", "Notes", "CreatedAt", "UpdatedAt",
  ],

  INVOICE_LINES: [
    "LineID", "InvoiceID", "ServiceType", "Description",
    "Quantity", "Rate", "Amount", "SourceModule", "ReferenceID", "CreatedAt",
  ],

  USERS: [
    "UserID", "FullName", "Email", "Phone", "Role",
    "PasswordHash", "Status", "LastLoginAt", "CreatedAt", "UpdatedAt",
  ],

};

// ---------------------------------------------------------------------------
// Domain enumerations
// ---------------------------------------------------------------------------
const ROOM_STATUS = {
  AVAILABLE    : "Available",
  OCCUPIED     : "Occupied",
  RESERVED     : "Reserved",
  MAINTENANCE  : "Maintenance",
  CHECKOUT     : "Checkout",
  CLEANING     : "Cleaning",
};

const BOOKING_STATUS = {
  CONFIRMED    : "Confirmed",
  CHECKED_IN   : "Checked_In",
  CHECKED_OUT  : "Checked_Out",
  CANCELLED    : "Cancelled",
  NO_SHOW      : "No_Show",
};

const PAYMENT_METHODS = {
  CASH      : "Cash",
  BANK      : "Bank Transfer",
  JAZZCASH  : "JazzCash",
  EASYPAISA : "EasyPaisa",
  CARD      : "Card",
  OTHER     : "Other",
};

const PAYMENT_TYPES = {
  ADVANCE : "Advance",
  PARTIAL : "Partial",
  FINAL   : "Final",
  REFUND  : "Refund",
};

const LEDGER_TYPES = {
  INCOME  : "Income",
  EXPENSE : "Expense",
};

const ROOM_INCOME_CATS  = ["Room Rent","Late Checkout","Extra Bed","Laundry","Minibar","Other"];
const ROOM_EXPENSE_CATS = ["Maintenance","Cleaning Supplies","Furniture & Fixtures","Utilities","Linens & Towels","Other"];
const KIT_INCOME_CATS   = ["Food","Beverages","Room Service","Catering","Other"];
const KIT_EXPENSE_CATS  = ["Groceries","Beverages Stock","Kitchen Equipment","Utilities","Staff Wages","Other"];

const ROOM_TYPES = {
  SINGLE    : "Single",
  DOUBLE    : "Double",
  TWIN      : "Twin",
  SUITE     : "Suite",
  DELUXE    : "Deluxe",
  FAMILY    : "Family",
};

const INVOICE_STATUS = {
  DRAFT          : "Draft",
  PARTIALLY_PAID : "Partially Paid",
  PAID           : "Paid",
  CANCELLED      : "Cancelled",
};

const BILLING_SERVICE_TYPES = [
  "Room Rent",
  "Kitchen Charges",
  "Laundry",
  "Extra Bed",
  "Mini Bar",
  "Room Service",
  "Other",
];


// =============================================================================
// SECTION 2 — API RESPONSE FORMAT
// =============================================================================

/**
 * Every function that can be called from the frontend or another module
 * returns one of these two shapes so callers never have to guess on structure.
 */
function successResponse(data, message) {
  return {
    success   : true,
    data      : data    !== undefined ? data : null,
    message   : message || "Operation completed successfully.",
    errorCode : null,
    timestamp : formatDateTime(new Date()),
  };
}

function errorResponse(message, errorCode, data) {
  return {
    success   : false,
    data      : data !== undefined ? data : null,
    message   : message   || "An unexpected error occurred.",
    errorCode : errorCode || ERROR_CODES.UNEXPECTED,
    timestamp : formatDateTime(new Date()),
  };
}


// =============================================================================
// SECTION 3 — CENTRALIZED ERROR HANDLING
// =============================================================================

const ERROR_CODES = {
  // Infrastructure
  UNEXPECTED         : "ERR_UNEXPECTED",
  LOCK_UNAVAILABLE   : "ERR_LOCK_UNAVAILABLE",
  SHEET_NOT_FOUND    : "ERR_SHEET_NOT_FOUND",
  SETUP_FAILED       : "ERR_SETUP_FAILED",

  // Data
  RECORD_NOT_FOUND   : "ERR_RECORD_NOT_FOUND",
  DUPLICATE_ENTRY    : "ERR_DUPLICATE_ENTRY",
  ID_GENERATION      : "ERR_ID_GENERATION",

  // Validation
  VALIDATION_FAILED  : "ERR_VALIDATION_FAILED",
  INVALID_DATE_RANGE : "ERR_INVALID_DATE_RANGE",
  MISSING_FIELD      : "ERR_MISSING_FIELD",

  // Business logic
  ROOM_UNAVAILABLE   : "ERR_ROOM_UNAVAILABLE",
  PERMISSION_DENIED  : "ERR_PERMISSION_DENIED",
  INVALID_STATUS     : "ERR_INVALID_STATUS",
};

/**
 * Call inside every catch block.  Logs to Stackdriver and returns a
 * standardised errorResponse so callers can forward it unchanged.
 */
function handleError(err, context) {
  var label = context || "unknown";
  var msg   = (err && err.message) ? err.message : String(err);
  console.error("[GHMS][" + label + "] " + msg);
  if (err && err.stack) console.error(err.stack);
  return errorResponse(msg, ERROR_CODES.UNEXPECTED);
}


// =============================================================================
// SECTION 4 — LOCK SERVICE WRAPPERS
// =============================================================================

/**
 * Wraps any write operation that must be atomic across all concurrent users
 * (e.g., ID generation, multi-sheet transactions).
 * fn must return a value — that value is returned to the caller.
 */
function withScriptLock(fn, timeoutMs) {
  var lock    = LockService.getScriptLock();
  var timeout = timeoutMs || CONFIG.LOCK_TIMEOUT_MS;
  try {
    if (!lock.tryLock(timeout)) {
      return errorResponse(
        "System is busy. Please retry in a moment.",
        ERROR_CODES.LOCK_UNAVAILABLE
      );
    }
    return fn();
  } catch (e) {
    return handleError(e, "withScriptLock");
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/**
 * Lighter-weight lock for operations that only need per-user serialisation
 * (e.g., preventing a single user from double-submitting a form).
 */
function withUserLock(fn, timeoutMs) {
  var lock    = LockService.getUserLock();
  var timeout = timeoutMs || CONFIG.LOCK_TIMEOUT_MS;
  try {
    if (!lock.tryLock(timeout)) {
      return errorResponse(
        "Your previous request is still processing. Please wait.",
        ERROR_CODES.LOCK_UNAVAILABLE
      );
    }
    return fn();
  } catch (e) {
    return handleError(e, "withUserLock");
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}


// =============================================================================
// SECTION 5 — UTILITY FUNCTIONS
// =============================================================================

// ---------------------------------------------------------------------------
// Date & time
// ---------------------------------------------------------------------------

function now() {
  return new Date();
}

function formatDate(date) {
  if (!date) return "";
  return Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, CONFIG.DATE_FORMAT);
}

function formatDateTime(date) {
  if (!date) return "";
  return Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, CONFIG.DATETIME_FORMAT);
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(startDate, endDate) {
  var s = new Date(startDate);
  var e = new Date(endDate);
  return Math.round((e - s) / 86400000);
}

function isValidDateRange(checkIn, checkOut) {
  var s = new Date(checkIn);
  var e = new Date(checkOut);
  return !isNaN(s) && !isNaN(e) && e > s;
}

function todayStr() {
  return formatDate(now());
}

// ---------------------------------------------------------------------------
// String
// ---------------------------------------------------------------------------

function trimStr(val) {
  return (val !== null && val !== undefined) ? String(val).trim() : "";
}

function isBlank(val) {
  return trimStr(val) === "";
}

function capitalize(str) {
  var s = trimStr(str).toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function titleCase(str) {
  return trimStr(str)
    .toLowerCase()
    .split(" ")
    .map(function (w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : ""; })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Pakistani CNIC: 12345-1234567-1
function isValidCNIC(cnic) {
  return /^\d{5}-\d{7}-\d$/.test(trimStr(cnic));
}

function isValidPhone(phone) {
  return /^[0-9+\-\s]{7,15}$/.test(trimStr(phone));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimStr(email));
}

function isPositiveNumber(val) {
  var n = Number(val);
  return !isNaN(n) && n > 0;
}

function isNonNegativeNumber(val) {
  var n = Number(val);
  return !isNaN(n) && n >= 0;
}

function requireFields(obj, fields) {
  var missing = fields.filter(function (f) { return isBlank(obj[f]); });
  if (missing.length === 0) return null;
  return errorResponse(
    "Missing required fields: " + missing.join(", "),
    ERROR_CODES.MISSING_FIELD,
    { missingFields: missing }
  );
}

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

function toNumber(val, fallback) {
  var n = Number(val);
  return isNaN(n) ? (fallback !== undefined ? fallback : 0) : n;
}

function roundTo2(val) {
  return Math.round(toNumber(val) * 100) / 100;
}

function formatCurrency(amount) {
  return "PKR " + toNumber(amount).toLocaleString("en-PK", {
    minimumFractionDigits : 2,
    maximumFractionDigits : 2,
  });
}


// =============================================================================
// SECTION 6 — SPREADSHEET HELPERS
// =============================================================================

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Returns the named sheet or throws with a clear message that guides the user
 * to run setupDatabase() — callers should not need to check for null.
 */
function getSheet(sheetName) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(
      "Sheet '" + sheetName + "' not found. Run GHMS Admin → Setup Database first."
    );
  }
  return sheet;
}

function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    console.log("[GHMS] Created sheet: " + sheetName);
  }
  return sheet;
}

/**
 * Writes the header row only when it doesn't already match exactly,
 * making setupDatabase() safely re-runnable.
 */
function ensureHeaders(sheet, headers) {
  var numCols   = headers.length;
  var existing  = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, numCols).getValues()[0]
    : [];
  var alreadyOk = headers.every(function (h, i) { return existing[i] === h; });
  if (alreadyOk) return;

  var range = sheet.getRange(1, 1, 1, numCols);
  range.setValues([headers]);
  range.setFontWeight("bold");
  range.setBackground(CONFIG.HEADER_BG_COLOR);
  range.setFontColor(CONFIG.HEADER_FG_COLOR);
  range.setHorizontalAlignment("center");
  range.setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 28);
  sheet.autoResizeColumns(1, numCols);
  console.log("[GHMS] Headers applied: " + sheet.getName());
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * Returns raw 2-D array of data rows (no header) from a sheet.
 * Returns [] when the sheet has no data rows.
 */
function getSheetData(sheetName) {
  var sheet   = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

/**
 * Returns data rows as an array of plain objects keyed by column header.
 * Header definition is pulled from the HEADERS constant so callers get
 * consistent property names regardless of sheet column order.
 */
function getSheetDataAsObjects(sheetName) {
  var headerKey = _sheetKeyFromName(sheetName);
  if (!headerKey) throw new Error("No HEADERS definition for sheet: " + sheetName);
  var headers = HEADERS[headerKey];
  var sheet   = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(sheetName, rowData) {
  getSheet(sheetName).appendRow(rowData);
}

/**
 * Finds the 1-based sheet row for a given ID value.
 * idColIndex is 1-based (default 1 = first column).
 * Returns -1 when not found.
 */
function findRowById(sheetName, id, idColIndex) {
  var sheet   = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var col  = idColIndex || 1;
  var vals = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/**
 * Overwrites an entire row identified by its ID column.
 * newRowData must be a flat array whose length matches the sheet's column count.
 */
function updateRowById(sheetName, id, newRowData, idColIndex) {
  var rowIdx = findRowById(sheetName, id, idColIndex);
  if (rowIdx === -1) {
    return errorResponse(
      "Record '" + id + "' not found in sheet '" + sheetName + "'.",
      ERROR_CODES.RECORD_NOT_FOUND
    );
  }
  getSheet(sheetName).getRange(rowIdx, 1, 1, newRowData.length).setValues([newRowData]);
  return successResponse({ id: id, rowIndex: rowIdx }, "Record updated.");
}

/**
 * Soft-delete by writing "Deleted" to a Status column.
 * statusColIndex is 1-based.
 */
function softDeleteById(sheetName, id, statusColIndex, idColIndex) {
  var rowIdx = findRowById(sheetName, id, idColIndex);
  if (rowIdx === -1) {
    return errorResponse(
      "Record '" + id + "' not found in sheet '" + sheetName + "'.",
      ERROR_CODES.RECORD_NOT_FOUND
    );
  }
  var colIdx = statusColIndex || 7;
  getSheet(sheetName).getRange(rowIdx, colIdx).setValue("Deleted");
  return successResponse({ id: id }, "Record marked as deleted.");
}

// ---------------------------------------------------------------------------
// Internal: reverse-lookup SHEETS key from a sheet display name
// ---------------------------------------------------------------------------
function _sheetKeyFromName(sheetName) {
  var keys = Object.keys(SHEETS);
  for (var i = 0; i < keys.length; i++) {
    if (SHEETS[keys[i]] === sheetName) return keys[i];
  }
  return null;
}


// =============================================================================
// SECTION 7 — SETTINGS SHEET HELPERS
// =============================================================================

/**
 * Returns the stored value for key, or null when the key does not exist.
 * Callers must check === null (not just falsy) since 0 / "" are valid values.
 */
function getSetting(key) {
  try {
    var sheet   = getSheet(SHEETS.SETTINGS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(key)) return rows[i][1];
    }
    return null;
  } catch (e) {
    console.error("[GHMS][getSetting] " + e.message);
    return null;
  }
}

/**
 * Upserts a key in the Settings sheet.
 * If the key exists, updates Value and UpdatedAt in place.
 * If not, appends a new row.
 */
function setSetting(key, value, description) {
  var sheet   = getSheet(SHEETS.SETTINGS);
  var lastRow = sheet.getLastRow();
  var ts      = formatDateTime(now());

  if (lastRow >= 2) {
    var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === String(key)) {
        var row = i + 2;
        sheet.getRange(row, 2).setValue(value);
        sheet.getRange(row, 4).setValue(ts);
        return;
      }
    }
  }

  sheet.appendRow([key, value, description || "", ts]);
}


// =============================================================================
// SECTION 8 — SEQUENTIAL ID GENERATOR
// =============================================================================

function _padNumber(num, length) {
  var s = String(num);
  var l = length || CONFIG.ID_PAD_LENGTH;
  while (s.length < l) s = "0" + s;
  return s;
}

/**
 * Parses the numeric tail from an ID string like "RM-0042" → 42.
 * Returns 0 for null / unrecognised strings so the first generated ID is always -0001.
 */
function _parseIdSeq(idStr) {
  if (!idStr) return 0;
  var parts = String(idStr).split("-");
  var n     = parseInt(parts[parts.length - 1], 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Atomically increments and returns the next ID for entityKey.
 * Uses a script-level lock so concurrent executions cannot generate the same ID.
 *
 * entityKey must be a key of ID_KEYS / ID_PREFIXES (e.g., "ROOMS", "GUESTS").
 *
 * Returns successResponse({ id: "RM-0001" }) or errorResponse.
 */
function generateId(entityKey) {
  return withScriptLock(function () {
    try {
      var settingsKey = ID_KEYS[entityKey];
      var prefix      = ID_PREFIXES[entityKey];

      if (!settingsKey || !prefix) {
        return errorResponse(
          "Unknown entity key for ID generation: " + entityKey,
          ERROR_CODES.ID_GENERATION
        );
      }

      var lastId  = getSetting(settingsKey);
      var nextSeq = _parseIdSeq(lastId) + 1;
      var newId   = prefix + "-" + _padNumber(nextSeq);

      setSetting(settingsKey, newId, "Last generated " + prefix + " ID");
      return successResponse({ id: newId });
    } catch (e) {
      return handleError(e, "generateId:" + entityKey);
    }
  });
}

/**
 * Convenience wrapper — returns the new ID string directly,
 * or throws so the caller's catch block can handle it uniformly.
 */
function getNextId(entityKey) {
  var result = generateId(entityKey);
  if (!result.success) throw new Error(result.message);
  return result.data.id;
}


// =============================================================================
// SECTION 9 — DATABASE SETUP
// =============================================================================

// Seed rows written to Settings on first run.  Each entry: [key, value, description].
// ID counter seeds use the "zero" form (e.g. "RM-0000") so the first real ID
// increments to "RM-0001".
var SETTINGS_SEED = [
  // System metadata
  ["SYSTEM_NAME",          CONFIG.SYSTEM_NAME,             "Full system name"],
  ["VERSION",              CONFIG.VERSION,                 "System version"],
  ["TIMEZONE",             CONFIG.TIMEZONE,                "System timezone"],

  // Hotel profile (filled in by admin after setup)
  ["HOTEL_NAME",           "Candlewood Hotel & Suites",    "Display name"],
  ["HOTEL_ADDRESS",        "",                             "Hotel postal address"],
  ["HOTEL_PHONE",          "",                             "Hotel contact number"],
  ["HOTEL_EMAIL",          "",                             "Hotel email address"],

  // Operational defaults
  ["DEFAULT_CURRENCY",     "PKR",                          "Currency code"],
  ["CHECK_IN_TIME",        "14:00",                        "Default check-in time (24 h)"],
  ["CHECK_OUT_TIME",       "12:00",                        "Default check-out time (24 h)"],
  ["TAX_RATE_PERCENT",     0,                              "Tax applied to bookings (%)"],
  ["EXTRA_PERSON_CHARGE",  0,                              "Extra guest charge per night"],

  // Developer / branding — Neurovis
  ["DEV_NAME",      "Neurovis",                                "Developer company name"],
  ["DEV_WEBSITE",   "https://www.neurovis.site",               "Developer website"],
  ["DEV_EMAIL",     "info@neurovis.com",                       "Developer primary email"],
  ["DEV_EMAIL_ALT", "neurovis.site@gmail.com",                 "Developer secondary email"],
  ["DEV_LOCATION",  "Islamabad, Pakistan",                     "Developer location"],
  ["DEV_PHONE",     "+92 339 6800123",                         "Developer support phone"],
  ["DEV_POWERED_BY","Powered by Neurovis",                     "Powered-by attribution text"],
  ["DEV_COPYRIGHT", "© 2026 Neurovis. All rights reserved.", "Copyright notice"],

  // ID counters — "zero" seeds so first real ID increments to 0001
  [ID_KEYS.ROOMS,            "RM-0000",   "Last Room ID"],
  [ID_KEYS.GUESTS,           "GST-0000",  "Last Guest ID"],
  [ID_KEYS.BOOKINGS,         "BK-0000",   "Last Booking ID"],
  [ID_KEYS.ROOM_INCOME,      "RI-0000",   "Last Room Income ID"],
  [ID_KEYS.ROOM_EXPENSE,     "RE-0000",   "Last Room Expense ID"],
  [ID_KEYS.KITCHEN_INCOME,   "KI-0000",   "Last Kitchen Income ID"],
  [ID_KEYS.KITCHEN_EXPENSE,  "KE-0000",   "Last Kitchen Expense ID"],
  [ID_KEYS.PAYMENTS,         "PAY-0000",  "Last Payment ID"],
  [ID_KEYS.LEDGER,           "LED-0000",  "Last Ledger ID"],
  [ID_KEYS.INVENTORY_ITEMS,  "ITM-0000",  "Last Inventory Item ID"],
  [ID_KEYS.STOCK_IN,         "SIN-0000",  "Last Stock In ID"],
  [ID_KEYS.STOCK_OUT,        "SOUT-0000", "Last Stock Out ID"],
  [ID_KEYS.STOCK_LEDGER,     "SLG-0000",  "Last Stock Ledger ID"],
  [ID_KEYS.INVOICES,         "INV-0000",  "Last Invoice ID"],
  [ID_KEYS.INVOICE_LINES,    "ILN-0000",  "Last Invoice Line ID"],
  [ID_KEYS.USERS,            "USR-0000",  "Last User ID"],
];

/**
 * Idempotent database initialiser.
 * Safe to run multiple times — existing sheets and data are never overwritten.
 *
 * What it does:
 *   1. Creates any missing sheets in canonical order.
 *   2. Writes / repairs header rows on all sheets.
 *   3. Seeds the Settings sheet with defaults (skips keys that already exist).
 *   4. Removes the blank "Sheet1" that Google creates on new spreadsheets.
 */
function setupDatabase() {
  try {
    var ss = getSpreadsheet();
    console.log("[GHMS] Starting database setup...");

    // ── 1. Ensure all sheets exist in display order ─────────────────────────
    var orderedSheets = [
      SHEETS.SETTINGS,
      SHEETS.ROOMS,
      SHEETS.GUESTS,
      SHEETS.BOOKINGS,
      SHEETS.ROOM_INCOME,
      SHEETS.ROOM_EXPENSE,
      SHEETS.KITCHEN_INCOME,
      SHEETS.KITCHEN_EXPENSE,
      SHEETS.PAYMENTS,
      SHEETS.LEDGER,
      SHEETS.INVOICES,
      SHEETS.INVOICE_LINES,
      SHEETS.INVENTORY_ITEMS,
      SHEETS.STOCK_IN,
      SHEETS.STOCK_OUT,
      SHEETS.STOCK_LEDGER,
      SHEETS.USERS,
    ];

    orderedSheets.forEach(function (name) { getOrCreateSheet(ss, name); });

    // Re-order tabs so they match orderedSheets left-to-right
    orderedSheets.forEach(function (name, targetIdx) {
      var sheet = ss.getSheetByName(name);
      if (sheet) ss.setActiveSheet(sheet);
      // moveActiveSheet is 1-based
      try { ss.moveActiveSheet(targetIdx + 1); } catch (e) { /* harmless if already in position */ }
    });

    // ── 2. Apply / repair headers on every sheet ────────────────────────────
    Object.keys(SHEETS).forEach(function (key) {
      var sheet = ss.getSheetByName(SHEETS[key]);
      if (sheet && HEADERS[key]) ensureHeaders(sheet, HEADERS[key]);
    });

    // ── 3. Seed Settings (skip existing keys) ───────────────────────────────
    var ts = formatDateTime(now());
    SETTINGS_SEED.forEach(function (entry) {
      if (getSetting(entry[0]) === null) {
        ss.getSheetByName(SHEETS.SETTINGS).appendRow([entry[0], entry[1], entry[2], ts]);
      }
    });

    // ── 4. Remove the default blank sheet Google adds to new spreadsheets ───
    var defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet && ss.getSheets().length > 1) {
      ss.deleteSheet(defaultSheet);
      console.log("[GHMS] Removed default Sheet1.");
    }

    console.log("[GHMS] Database setup complete — " + orderedSheets.length + " sheets ready.");

    // Seed default admin account if no users exist
    setupDefaultAdmin();

    return successResponse(
      { sheets: orderedSheets },
      "Database setup completed successfully."
    );
  } catch (e) {
    return handleError(e, "setupDatabase");
  }
}


// =============================================================================
// SECTION 10 — WEB APP ENTRY POINT & SPREADSHEET MENU
// =============================================================================

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var appUrl = ScriptApp.getService().getUrl();

  // PWA manifest
  if (params.manifest === '1') {
    var manifest = {
      name: "Candlewood Hotel & Suites Management System",
      short_name: "GHMS",
      description: "Candlewood Hotel & Suites Management System — powered by Neurovis",
      start_url: appUrl,
      scope: appUrl,
      display: "standalone",
      orientation: "portrait-primary",
      theme_color: "#6366f1",
      background_color: "#f1f5f9",
      icons: [
        { src: appUrl + "?icon=192", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
        { src: appUrl + "?icon=512", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
      ]
    };
    return ContentService.createTextOutput(JSON.stringify(manifest))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // PWA icon (SVG, scalable — same art for 192 and 512)
  if (params.icon) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">' +
      '<rect width="192" height="192" rx="40" fill="#6366f1"/>' +
      '<polygon points="96,30 44,72 148,72" fill="white"/>' +
      '<rect x="54" y="70" width="84" height="76" rx="6" fill="white" opacity="0.95"/>' +
      '<rect x="70" y="84" width="20" height="20" rx="3" fill="#6366f1" opacity="0.35"/>' +
      '<rect x="102" y="84" width="20" height="20" rx="3" fill="#6366f1" opacity="0.35"/>' +
      '<rect x="70" y="112" width="20" height="20" rx="3" fill="#6366f1" opacity="0.35"/>' +
      '<rect x="102" y="112" width="20" height="20" rx="3" fill="#6366f1" opacity="0.35"/>' +
      '<rect x="84" y="114" width="24" height="32" rx="4" fill="#6366f1" opacity="0.45"/>' +
      '</svg>';
    return ContentService.createTextOutput(svg)
      .setMimeType(ContentService.MimeType.XML);
  }

  // Minimal service worker for PWA installability
  if (params.sw === '1') {
    var sw =
      'self.addEventListener("install",function(){self.skipWaiting();});' +
      'self.addEventListener("activate",function(e){e.waitUntil(self.clients.claim());});' +
      'self.addEventListener("fetch",function(){});';
    return ContentService.createTextOutput(sw)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Main app — pass appUrl to template for PWA manifest link
  var template = HtmlService.createTemplateFromFile('Index');
  template.appUrl = appUrl;
  return template.evaluate()
    .setTitle('Candlewood Hotel & Suites Management System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙ GHMS Admin")
    .addItem("Setup / Re-initialise Database", "setupDatabase")
    .addSeparator()
    .addItem("Seed Demo Data",   "seedDemoData")
    .addItem("Clear Demo Data",  "clearDemoData")
    .addItem("Run System Tests", "runSystemTests")
    .addSeparator()
    .addItem("About", "showAbout")
    .addToUi();
}


// =============================================================================
// SECTION 11 — PUBLIC SETTINGS API
// =============================================================================

function getHotelSettings() {
  try {
    return successResponse({
      hotelName   : trimStr(getSetting("HOTEL_NAME")    || ""),
      address     : trimStr(getSetting("HOTEL_ADDRESS") || ""),
      phone       : trimStr(getSetting("HOTEL_PHONE")   || ""),
      email       : trimStr(getSetting("HOTEL_EMAIL")   || ""),
      taxRate     : toNumber(getSetting("TAX_RATE_PERCENT"), 0),
      checkInTime : trimStr(getSetting("CHECK_IN_TIME")  || "14:00"),
      checkOutTime: trimStr(getSetting("CHECK_OUT_TIME") || "12:00"),
      devName     : trimStr(getSetting("DEV_NAME")      || "Neurovis"),
      devWebsite  : trimStr(getSetting("DEV_WEBSITE")   || "https://www.neurovis.site"),
      devEmail    : trimStr(getSetting("DEV_EMAIL")     || "info@neurovis.com"),
      devEmailAlt : trimStr(getSetting("DEV_EMAIL_ALT") || "neurovis.site@gmail.com"),
      devLocation : trimStr(getSetting("DEV_LOCATION")  || "Islamabad, Pakistan"),
      devPhone    : trimStr(getSetting("DEV_PHONE")     || "+92 339 6800123"),
      devPoweredBy: trimStr(getSetting("DEV_POWERED_BY")|| "Powered by Neurovis"),
      devCopyright: trimStr(getSetting("DEV_COPYRIGHT") || "© 2026 Neurovis. All rights reserved."),
    });
  } catch (e) {
    return handleError(e, "getHotelSettings");
  }
}

function saveHotelSettings(token, data) {
  try {
    var err = _requireRole(token, ["Admin"]); if (err) return err;
    if (!data) return errorResponse("No settings data provided.", ERROR_CODES.MISSING_FIELD);
    if (data.hotelName    !== undefined) setSetting("HOTEL_NAME",       trimStr(data.hotelName),          "Display name");
    if (data.address      !== undefined) setSetting("HOTEL_ADDRESS",    trimStr(data.address),            "Hotel postal address");
    if (data.phone        !== undefined) setSetting("HOTEL_PHONE",      trimStr(data.phone),              "Hotel contact number");
    if (data.email        !== undefined) setSetting("HOTEL_EMAIL",      trimStr(data.email),              "Hotel email address");
    if (data.taxRate      !== undefined) setSetting("TAX_RATE_PERCENT", toNumber(data.taxRate, 0),        "Tax applied to bookings (%)");
    if (data.checkInTime  !== undefined) setSetting("CHECK_IN_TIME",    trimStr(data.checkInTime),        "Default check-in time (24 h)");
    if (data.checkOutTime !== undefined) setSetting("CHECK_OUT_TIME",   trimStr(data.checkOutTime),       "Default check-out time (24 h)");
    if (data.devName     !== undefined) setSetting("DEV_NAME",         trimStr(data.devName),             "Developer company name");
    if (data.devWebsite  !== undefined) setSetting("DEV_WEBSITE",      trimStr(data.devWebsite),          "Developer website");
    if (data.devEmail    !== undefined) setSetting("DEV_EMAIL",        trimStr(data.devEmail),            "Developer primary email");
    if (data.devEmailAlt !== undefined) setSetting("DEV_EMAIL_ALT",    trimStr(data.devEmailAlt),         "Developer secondary email");
    if (data.devLocation !== undefined) setSetting("DEV_LOCATION",     trimStr(data.devLocation),         "Developer location");
    if (data.devPhone    !== undefined) setSetting("DEV_PHONE",        trimStr(data.devPhone),            "Developer support phone");
    if (data.devPoweredBy!== undefined) setSetting("DEV_POWERED_BY",   trimStr(data.devPoweredBy),        "Powered-by attribution text");
    if (data.devCopyright!== undefined) setSetting("DEV_COPYRIGHT",    trimStr(data.devCopyright),        "Copyright notice");
    _addAuditLog("Settings", "UPDATE", "HOTEL_PROFILE", "Hotel settings updated");
    return successResponse(null, "Settings saved successfully.");
  } catch (e) {
    return handleError(e, "saveHotelSettings");
  }
}

function backupDatabase() {
  try {
    var ss   = getSpreadsheet();
    var name = ss.getName() + " — Backup " + formatDate(now());
    var copy = ss.copy(name);
    _addAuditLog("System", "BACKUP", "", "Spreadsheet backed up as: " + name);
    return successResponse({ name: name, url: copy.getUrl() }, "Backup created: " + name);
  } catch (e) {
    return handleError(e, "backupDatabase");
  }
}


// =============================================================================
// SECTION 12 — AUDIT LOG
// =============================================================================

function _addAuditLog(module, action, entityId, detail) {
  try {
    var ss    = getSpreadsheet();
    var sheet = ss.getSheetByName("Audit_Log");
    if (!sheet) {
      sheet = ss.insertSheet("Audit_Log");
      var hdr = sheet.getRange(1, 1, 1, 5);
      hdr.setValues([["Timestamp", "Module", "Action", "Entity ID", "Detail"]]);
      hdr.setFontWeight("bold");
      hdr.setBackground(CONFIG.HEADER_BG_COLOR);
      hdr.setFontColor(CONFIG.HEADER_FG_COLOR);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, 5);
    }
    sheet.appendRow([formatDateTime(now()), module, action, entityId || "", detail || ""]);
  } catch (e) {
    console.warn("[_addAuditLog] " + e.message);
  }
}

function showAbout() {
  var devName     = trimStr(getSetting("DEV_NAME")      || "Neurovis");
  var devWebsite  = trimStr(getSetting("DEV_WEBSITE")   || "https://www.neurovis.site");
  var devEmail    = trimStr(getSetting("DEV_EMAIL")     || "info@neurovis.com");
  var devPhone    = trimStr(getSetting("DEV_PHONE")     || "+92 339 6800123");
  var devLocation = trimStr(getSetting("DEV_LOCATION")  || "Islamabad, Pakistan");
  var copyright   = trimStr(getSetting("DEV_COPYRIGHT") || "© 2026 Neurovis. All rights reserved.");
  SpreadsheetApp.getUi().alert(
    CONFIG.SYSTEM_NAME,
    CONFIG.SYSTEM_NAME + "\nVersion: " + CONFIG.VERSION +
      "\nTimezone: " + CONFIG.TIMEZONE +
      "\n\nDeveloper: " + devName +
      "\nWebsite:   " + devWebsite +
      "\nEmail:     " + devEmail +
      "\nPhone:     " + devPhone +
      "\nLocation:  " + devLocation +
      "\n\n" + copyright,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
