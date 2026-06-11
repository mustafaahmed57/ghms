// =============================================================================
// AUTH MODULE — Auth.gs
// =============================================================================
// Login / logout, session management (CacheService, 6-hr TTL),
// password hashing (SHA-256 + salt), and Admin-only user CRUD.
// =============================================================================

const ROLES          = ["Admin","Manager","Front Desk","Finance","Inventory"];
const SESSION_TTL    = 21600; // 6 hours (CacheService maximum)
const SESSION_PREFIX = "ghms_sess_";

// Sections each role may visit
const ROLE_ACCESS = {
  "Admin"      : ["dashboard","rooms","guests","bookings","checkinout",
                  "room-income","room-expense","kitchen-income","kitchen-expense",
                  "payments","ledger","billing","reports",
                  "inv-items","inv-stock-in","inv-stock-out","inv-stock-ledger","inv-low-stock",
                  "settings","users"],
  "Manager"    : ["dashboard","rooms","guests","bookings","checkinout","billing","reports"],
  "Front Desk" : ["rooms","guests","bookings","checkinout","payments","billing"],
  "Finance"    : ["dashboard","payments","room-income","room-expense",
                  "kitchen-income","kitchen-expense","ledger","billing","reports"],
  "Inventory"  : ["dashboard","inv-items","inv-stock-in","inv-stock-out",
                  "inv-stock-ledger","inv-low-stock"],
};


// =============================================================================
// SETUP
// =============================================================================

/**
 * Creates the default Admin account if no users exist.
 * Called automatically at the end of setupDatabase().
 */
function setupDefaultAdmin() {
  try {
    var rows   = getSheetData(SHEETS.USERS);
    var active = rows.filter(function(r){ return trimStr(r[0]) !== ""; });
    if (active.length > 0) return successResponse(null, "Users already exist.");

    var salt   = _generateSalt();
    var hash   = _hashPassword("Admin@12345", salt);
    var userId = getNextId("USERS");
    var ts     = formatDateTime(now());
    var row    = [
      userId, "System Admin", "admin@ghms.local", "", "Admin",
      salt + ":" + hash, "Active", "", ts, ts
    ];
    appendRow(SHEETS.USERS, row);
    return successResponse({ userId: userId }, "Default admin created: admin@ghms.local / Admin@12345");
  } catch(e) {
    return handleError(e, "setupDefaultAdmin");
  }
}


// =============================================================================
// PUBLIC AUTH ENDPOINTS
// =============================================================================

function login(email, password) {
  try {
    email    = trimStr(email    || "").toLowerCase();
    password = trimStr(password || "");

    if (isBlank(email) || isBlank(password))
      return errorResponse("Email and password are required.", ERROR_CODES.MISSING_FIELD);

    var rows    = getSheetData(SHEETS.USERS);
    var userRow = null;
    for (var i = 0; i < rows.length; i++) {
      if (trimStr(rows[i][0]) !== "" && String(rows[i][2]).toLowerCase() === email) {
        userRow = rows[i]; break;
      }
    }

    if (!userRow)
      return errorResponse("Invalid email or password.", ERROR_CODES.RECORD_NOT_FOUND);
    if (String(userRow[6]) !== "Active")
      return errorResponse("Account is inactive. Contact an administrator.", ERROR_CODES.PERMISSION_DENIED);
    if (!_verifyPassword(password, String(userRow[5])))
      return errorResponse("Invalid email or password.", ERROR_CODES.PERMISSION_DENIED);

    // Record last-login timestamp
    var sheet = getSheet(SHEETS.USERS);
    var ids   = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var j = 0; j < ids.length; j++) {
      if (String(ids[j][0]) === String(userRow[0])) {
        sheet.getRange(j + 2, 8).setValue(formatDateTime(now())); break;
      }
    }

    var user  = _userRowToObj(userRow);
    var token = Utilities.getUuid();
    CacheService.getScriptCache().put(
      SESSION_PREFIX + token,
      JSON.stringify({ userId: user.userId, role: user.role, fullName: user.fullName, email: user.email }),
      SESSION_TTL
    );

    return successResponse({ token: token, user: user }, "Login successful.");
  } catch(e) {
    return handleError(e, "login");
  }
}

function logout(token) {
  try {
    if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + trimStr(token));
    return successResponse(null, "Logged out.");
  } catch(e) {
    return handleError(e, "logout");
  }
}

function validateSession(token) {
  try {
    if (!token) return errorResponse("No session token.", ERROR_CODES.PERMISSION_DENIED);
    var cached = CacheService.getScriptCache().get(SESSION_PREFIX + trimStr(token));
    if (!cached)  return errorResponse("Session expired. Please log in again.", ERROR_CODES.PERMISSION_DENIED);
    return successResponse(JSON.parse(cached));
  } catch(e) {
    return handleError(e, "validateSession");
  }
}


// =============================================================================
// USER MANAGEMENT — Admin only
// =============================================================================

function listUsers(token) {
  try {
    var err = _requireRole(token, ["Admin"]); if (err) return err;
    var users = getSheetData(SHEETS.USERS)
      .filter(function(r){ return trimStr(r[0]) !== ""; })
      .map(_userRowToObj);
    return successResponse(users);
  } catch(e) {
    return handleError(e, "listUsers");
  }
}

function addUser(token, data) {
  return withUserLock(function() {
    try {
      var err = _requireRole(token, ["Admin"]); if (err) return err;
      var vErr = _validateUserData(data, null); if (vErr) return vErr;

      var email = trimStr(data.email).toLowerCase();
      var rows  = getSheetData(SHEETS.USERS);
      for (var i = 0; i < rows.length; i++) {
        if (trimStr(rows[i][0]) !== "" && String(rows[i][2]).toLowerCase() === email)
          return errorResponse("Email already in use.", ERROR_CODES.DUPLICATE_ENTRY);
      }

      var salt   = _generateSalt();
      var hash   = _hashPassword(trimStr(data.password), salt);
      var userId = getNextId("USERS");
      var ts     = formatDateTime(now());
      var row    = [
        userId, trimStr(data.fullName), email, trimStr(data.phone || ""),
        trimStr(data.role), salt + ":" + hash, "Active", "", ts, ts
      ];
      appendRow(SHEETS.USERS, row);
      _addAuditLog("Users", "CREATE", userId, trimStr(data.fullName) + " <" + email + "> role=" + trimStr(data.role));
      return successResponse(_userRowToObj(row), "User created successfully.");
    } catch(e) {
      return handleError(e, "addUser");
    }
  }, 6000);
}

function updateUser(token, userId, data) {
  return withUserLock(function() {
    try {
      var err = _requireRole(token, ["Admin"]); if (err) return err;

      var rowIdx = findRowById(SHEETS.USERS, trimStr(userId || ""), 1);
      if (rowIdx === -1) return errorResponse("User not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var vErr = _validateUserData(data, userId); if (vErr) return vErr;

      var email = trimStr(data.email).toLowerCase();
      var rows  = getSheetData(SHEETS.USERS);
      for (var i = 0; i < rows.length; i++) {
        if (trimStr(rows[i][0]) !== "" && String(rows[i][0]) !== String(userId) &&
            String(rows[i][2]).toLowerCase() === email)
          return errorResponse("Email already in use by another user.", ERROR_CODES.DUPLICATE_ENTRY);
      }

      var sheet = getSheet(SHEETS.USERS);
      var ts    = formatDateTime(now());
      sheet.getRange(rowIdx, 2).setValue(trimStr(data.fullName));
      sheet.getRange(rowIdx, 3).setValue(email);
      sheet.getRange(rowIdx, 4).setValue(trimStr(data.phone || ""));
      sheet.getRange(rowIdx, 5).setValue(trimStr(data.role));
      sheet.getRange(rowIdx, 10).setValue(ts);

      var updated = sheet.getRange(rowIdx, 1, 1, HEADERS.USERS.length).getValues()[0];
      _addAuditLog("Users", "UPDATE", userId, trimStr(data.fullName) + " role=" + trimStr(data.role));
      return successResponse(_userRowToObj(updated), "User updated.");
    } catch(e) {
      return handleError(e, "updateUser");
    }
  }, 6000);
}

function toggleUserStatus(token, userId) {
  return withUserLock(function() {
    try {
      var err = _requireRole(token, ["Admin"]); if (err) return err;

      var rowIdx = findRowById(SHEETS.USERS, trimStr(userId || ""), 1);
      if (rowIdx === -1) return errorResponse("User not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet     = getSheet(SHEETS.USERS);
      var row       = sheet.getRange(rowIdx, 1, 1, HEADERS.USERS.length).getValues()[0];
      var curStatus = String(row[6]);
      var newStatus = curStatus === "Active" ? "Inactive" : "Active";

      if (curStatus === "Active" && String(row[4]) === "Admin") {
        var activeAdmins = getSheetData(SHEETS.USERS).filter(function(r) {
          return trimStr(r[0]) !== "" && String(r[4]) === "Admin" && String(r[6]) === "Active";
        });
        if (activeAdmins.length <= 1)
          return errorResponse("Cannot deactivate the last active Admin.", ERROR_CODES.PERMISSION_DENIED);
      }

      sheet.getRange(rowIdx, 7).setValue(newStatus);
      sheet.getRange(rowIdx, 10).setValue(formatDateTime(now()));
      _addAuditLog("Users", "STATUS_CHANGE", userId, newStatus);
      return successResponse({ userId: userId, status: newStatus }, "User " + newStatus.toLowerCase() + "d.");
    } catch(e) {
      return handleError(e, "toggleUserStatus");
    }
  }, 6000);
}

function resetPassword(token, userId, newPassword) {
  return withUserLock(function() {
    try {
      var err  = _requireRole(token, ["Admin"]); if (err) return err;
      var pwErr = _validatePassword(trimStr(newPassword || "")); if (pwErr) return pwErr;

      var rowIdx = findRowById(SHEETS.USERS, trimStr(userId || ""), 1);
      if (rowIdx === -1) return errorResponse("User not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var salt  = _generateSalt();
      var hash  = _hashPassword(trimStr(newPassword), salt);
      var sheet = getSheet(SHEETS.USERS);
      sheet.getRange(rowIdx, 6).setValue(salt + ":" + hash);
      sheet.getRange(rowIdx, 10).setValue(formatDateTime(now()));
      _addAuditLog("Users", "PASSWORD_RESET", userId, "");
      return successResponse(null, "Password reset successfully.");
    } catch(e) {
      return handleError(e, "resetPassword");
    }
  }, 6000);
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _generateSalt() {
  return Utilities.getUuid().replace(/-/g, "").substring(0, 16);
}

function _hashPassword(password, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (salt || "") + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    var h = (b < 0 ? b + 256 : b).toString(16);
    return h.length < 2 ? "0" + h : h;
  }).join("");
}

function _verifyPassword(inputPassword, storedHash) {
  var parts = String(storedHash || "").split(":");
  if (parts.length !== 2) return false;
  return _hashPassword(inputPassword, parts[0]) === parts[1];
}

function _requireRole(token, allowedRoles) {
  if (!token) return errorResponse("Authentication required.", ERROR_CODES.PERMISSION_DENIED);
  var cached = CacheService.getScriptCache().get(SESSION_PREFIX + trimStr(token));
  if (!cached) return errorResponse("Session expired.", ERROR_CODES.PERMISSION_DENIED);
  var session = JSON.parse(cached);
  if (allowedRoles && allowedRoles.indexOf(session.role) === -1)
    return errorResponse("Access denied. Insufficient permissions.", ERROR_CODES.PERMISSION_DENIED);
  return null;
}

function _validateUserData(data, excludeUserId) {
  var name  = trimStr(data.fullName || "");
  var email = trimStr(data.email    || "");
  var role  = trimStr(data.role     || "");
  var phone = trimStr(data.phone    || "");

  if (isBlank(name))  return errorResponse("Full name is required.",  ERROR_CODES.MISSING_FIELD);
  if (isBlank(email)) return errorResponse("Email is required.",      ERROR_CODES.MISSING_FIELD);
  if (ROLES.indexOf(role) === -1)
    return errorResponse("Valid role is required. Choose: " + ROLES.join(", "), ERROR_CODES.VALIDATION_FAILED);
  if (!isValidEmail(email))
    return errorResponse("Invalid email address.",                     ERROR_CODES.VALIDATION_FAILED);
  if (phone !== "" && !/^03\d{9}$/.test(phone))
    return errorResponse("Phone must be 11 digits starting with 03.", ERROR_CODES.VALIDATION_FAILED);
  if (!excludeUserId) { // only validate password on add
    var pwErr = _validatePassword(trimStr(data.password || ""));
    if (pwErr) return pwErr;
  }
  return null;
}

function _validatePassword(pw) {
  if (pw.length < 8)       return errorResponse("Password must be at least 8 characters.", ERROR_CODES.VALIDATION_FAILED);
  if (!/[A-Z]/.test(pw))  return errorResponse("Password needs an uppercase letter.",      ERROR_CODES.VALIDATION_FAILED);
  if (!/[a-z]/.test(pw))  return errorResponse("Password needs a lowercase letter.",       ERROR_CODES.VALIDATION_FAILED);
  if (!/[0-9]/.test(pw))  return errorResponse("Password needs a number.",                 ERROR_CODES.VALIDATION_FAILED);
  if (!/[^A-Za-z0-9]/.test(pw)) return errorResponse("Password needs a special character.", ERROR_CODES.VALIDATION_FAILED);
  return null;
}

function _userRowToObj(row) {
  return {
    userId     : String(row[0] || ""),
    fullName   : String(row[1] || ""),
    email      : String(row[2] || ""),
    phone      : String(row[3] || ""),
    role       : String(row[4] || ""),
    // PasswordHash (col 5) intentionally omitted
    status     : String(row[6] || ""),
    lastLoginAt: row[7] ? formatDateTime(new Date(row[7])) : "",
    createdAt  : row[8] ? formatDateTime(new Date(row[8])) : "",
  };
}
