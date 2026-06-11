// =============================================================================
// INVENTORY MODULE — Inventory.gs
// =============================================================================
//
// Inventory_Items columns (0-based):
//   0 ItemID  1 ItemName  2 Category  3 UOM  4 ReorderLevel
//   5 CurrentStock  6 Status  7 Notes  8 CreatedAt  9 UpdatedAt
//
// Stock_In columns (0-based):
//   0 StockInID  1 Date  2 ItemID  3 ItemName  4 Category
//   5 Quantity   6 UnitCost  7 TotalAmount  8 Vendor  9 PaymentMethod
//  10 Notes  11 CreatedAt
//
// Stock_Out columns (0-based):
//   0 StockOutID  1 Date  2 ItemID  3 ItemName  4 Category
//   5 Quantity    6 Purpose  7 Department  8 Notes  9 CreatedAt
//
// Stock_Ledger columns (0-based):
//   0 StockLedgerID  1 Date  2 ItemID  3 ItemName  4 MovementType
//   5 QuantityIn     6 QuantityOut  7 BalanceAfter  8 ReferenceID
//   9 SourceModule  10 Notes  11 CreatedAt
// =============================================================================

const INV_CATS  = ["Kitchen","Housekeeping","Room Supplies","Maintenance","Electrical","Furniture","Cleaning","General"];
const INV_UOMS  = ["PCS","KG","Gram","Liter","ML","Pack","Box","Dozen","Meter"];
const INV_DEPTS = ["Kitchen","Housekeeping","Front Desk","Maintenance","Room Service","General"];
const INV_ITEM_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" };
const INV_MOVEMENT    = { IN: "IN", OUT: "OUT" };


// =============================================================================
// ITEM MASTER — CRUD
// =============================================================================

function addInventoryItem(data) {
  return withUserLock(function() {
    try {
      var name         = trimStr(data.itemName      || "");
      var category     = trimStr(data.category      || "");
      var uom          = trimStr(data.uom           || "");
      var reorder      = toNumber(data.reorderLevel, 0);
      var openingStock = toNumber(data.currentStock, 0);
      var notes        = trimStr(data.notes         || "");

      if (isBlank(name))     return errorResponse("Item name is required.",         ERROR_CODES.MISSING_FIELD);
      if (isBlank(category)) return errorResponse("Category is required.",          ERROR_CODES.MISSING_FIELD);
      if (isBlank(uom))      return errorResponse("Unit of measure is required.",   ERROR_CODES.MISSING_FIELD);
      if (!isNonNegativeNumber(reorder))      return errorResponse("Reorder level cannot be negative.",  ERROR_CODES.VALIDATION_FAILED);
      if (!isNonNegativeNumber(openingStock)) return errorResponse("Opening stock cannot be negative.", ERROR_CODES.VALIDATION_FAILED);

      // Uniqueness check
      var allRows = getSheetData(SHEETS.INVENTORY_ITEMS);
      for (var i = 0; i < allRows.length; i++) {
        if (trimStr(allRows[i][0]) !== "" &&
            trimStr(allRows[i][1]).toLowerCase() === name.toLowerCase()) {
          return errorResponse("Item '" + name + "' already exists.", ERROR_CODES.DUPLICATE_ENTRY);
        }
      }

      var itemId = getNextId("INVENTORY_ITEMS");
      var ts     = formatDateTime(now());
      var row    = [itemId, name, category, uom, reorder, openingStock, INV_ITEM_STATUS.ACTIVE, notes, ts, ts];

      appendRow(SHEETS.INVENTORY_ITEMS, row);

      if (openingStock > 0) {
        _addStockLedgerEntry(itemId, name, INV_MOVEMENT.IN, openingStock, 0, openingStock, itemId, "Opening Stock", "Opening balance");
      }

      return successResponse(_itemRowToObj(row), itemId + " — Item added successfully.");
    } catch(e) {
      return handleError(e, "addInventoryItem");
    }
  }, 6000);
}

function updateInventoryItem(itemId, data) {
  return withUserLock(function() {
    try {
      var name     = trimStr(data.itemName      || "");
      var category = trimStr(data.category      || "");
      var uom      = trimStr(data.uom           || "");
      var reorder  = toNumber(data.reorderLevel, 0);
      var notes    = trimStr(data.notes         || "");

      if (isBlank(name))     return errorResponse("Item name is required.",       ERROR_CODES.MISSING_FIELD);
      if (isBlank(category)) return errorResponse("Category is required.",        ERROR_CODES.MISSING_FIELD);
      if (isBlank(uom))      return errorResponse("Unit of measure is required.", ERROR_CODES.MISSING_FIELD);
      if (!isNonNegativeNumber(reorder)) return errorResponse("Reorder level cannot be negative.", ERROR_CODES.VALIDATION_FAILED);

      var rowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (rowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sheet    = getSheet(SHEETS.INVENTORY_ITEMS);
      var existing = sheet.getRange(rowIdx, 1, 1, HEADERS.INVENTORY_ITEMS.length).getValues()[0];

      // Uniqueness check (exclude self)
      var allRows = getSheetData(SHEETS.INVENTORY_ITEMS);
      for (var i = 0; i < allRows.length; i++) {
        if (trimStr(allRows[i][0]) !== "" &&
            String(allRows[i][0]) !== itemId &&
            trimStr(allRows[i][1]).toLowerCase() === name.toLowerCase()) {
          return errorResponse("Item '" + name + "' already exists.", ERROR_CODES.DUPLICATE_ENTRY);
        }
      }

      var ts  = formatDateTime(now());
      var row = [itemId, name, category, uom, reorder, existing[5], existing[6], notes, existing[8], ts];
      sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);

      return successResponse(_itemRowToObj(row), "Item updated.");
    } catch(e) {
      return handleError(e, "updateInventoryItem");
    }
  }, 6000);
}

function deleteInventoryItem(itemId) {
  return withUserLock(function() {
    try {
      var rowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (rowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);

      // Block delete if item has any stock movements
      var sinRows  = getSheetData(SHEETS.STOCK_IN).filter(function(r) {
        return trimStr(r[0]) !== "" && String(r[2]) === itemId;
      });
      var soutRows = getSheetData(SHEETS.STOCK_OUT).filter(function(r) {
        return trimStr(r[0]) !== "" && String(r[2]) === itemId;
      });
      if (sinRows.length > 0 || soutRows.length > 0) {
        return errorResponse(
          "Cannot delete an item that has stock movements. Deactivate it instead.",
          ERROR_CODES.VALIDATION_FAILED
        );
      }

      _removeStockLedgerEntry(itemId); // remove opening-balance ledger row
      getSheet(SHEETS.INVENTORY_ITEMS).deleteRow(rowIdx);
      return successResponse({ itemId: itemId }, "Item deleted.");
    } catch(e) {
      return handleError(e, "deleteInventoryItem");
    }
  }, 6000);
}

function listInventoryItems(filters) {
  try {
    var rows  = getSheetData(SHEETS.INVENTORY_ITEMS);
    var items = rows.filter(function(r) { return trimStr(r[0]) !== ""; }).map(_itemRowToObj);

    if (filters) {
      if (filters.category) items = items.filter(function(i) { return i.category === filters.category; });
      if (filters.status)   items = items.filter(function(i) { return i.status   === filters.status; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.itemId.toLowerCase().indexOf(q)   !== -1 ||
                 i.itemName.toLowerCase().indexOf(q) !== -1 ||
                 i.category.toLowerCase().indexOf(q) !== -1;
        });
      }
    }

    items.sort(function(a, b) { return a.itemName.localeCompare(b.itemName); });
    return successResponse(items);
  } catch(e) {
    return handleError(e, "listInventoryItems");
  }
}


// =============================================================================
// STOCK IN — CRUD
// =============================================================================

function addStockIn(data) {
  return withScriptLock(function() {
    try {
      var date          = trimStr(data.date          || "");
      var itemId        = trimStr(data.itemId        || "");
      var quantity      = toNumber(data.quantity,     0);
      var unitCost      = toNumber(data.unitCost,     0);
      var vendor        = trimStr(data.vendor        || "");
      var paymentMethod = trimStr(data.paymentMethod || "");
      var notes         = trimStr(data.notes         || "");

      if (isBlank(date))               return errorResponse("Date is required.",               ERROR_CODES.MISSING_FIELD);
      if (isBlank(itemId))             return errorResponse("Item is required.",               ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(quantity)) return errorResponse("Quantity must be positive.",       ERROR_CODES.VALIDATION_FAILED);
      if (!isNonNegativeNumber(unitCost)) return errorResponse("Unit cost cannot be negative.", ERROR_CODES.VALIDATION_FAILED);

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var itemSheet  = getSheet(SHEETS.INVENTORY_ITEMS);
      var itemRow    = itemSheet.getRange(itemRowIdx, 1, 1, HEADERS.INVENTORY_ITEMS.length).getValues()[0];

      var itemName    = String(itemRow[1]);
      var category    = String(itemRow[2]);
      var totalAmount = roundTo2(quantity * unitCost);
      var newStock    = roundTo2(toNumber(itemRow[5], 0) + quantity);

      var stockInId = getNextId("STOCK_IN");
      var ts        = formatDateTime(now());
      var row       = [stockInId, date, itemId, itemName, category,
                       quantity, roundTo2(unitCost), totalAmount, vendor, paymentMethod, notes, ts];

      appendRow(SHEETS.STOCK_IN, row);

      itemSheet.getRange(itemRowIdx, 6).setValue(newStock);
      itemSheet.getRange(itemRowIdx, 10).setValue(ts);

      _addStockLedgerEntry(itemId, itemName, INV_MOVEMENT.IN, quantity, 0, newStock, stockInId, "Stock In",
                           vendor || notes || "Stock purchase");

      // Accounting Ledger debit when payment info is present
      if (totalAmount > 0 && !isBlank(paymentMethod)) {
        _addLedgerEntry({
          entryDate  : date,
          entryType  : LEDGER_TYPES.EXPENSE,
          category   : "Inventory Purchase",
          subCategory: category,
          referenceId: stockInId,
          description: itemName + (vendor ? " — " + vendor : ""),
          debit      : totalAmount,
          credit     : 0,
        });
      }

      return successResponse(_sinRowToObj(row), stockInId + " — Stock received successfully.");
    } catch(e) {
      return handleError(e, "addStockIn");
    }
  }, 10000);
}

function updateStockIn(stockInId, data) {
  return withScriptLock(function() {
    try {
      var date          = trimStr(data.date          || "");
      var quantity      = toNumber(data.quantity,     0);
      var unitCost      = toNumber(data.unitCost,     0);
      var vendor        = trimStr(data.vendor        || "");
      var paymentMethod = trimStr(data.paymentMethod || "");
      var notes         = trimStr(data.notes         || "");

      if (isBlank(date))                  return errorResponse("Date is required.",               ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(quantity))    return errorResponse("Quantity must be positive.",       ERROR_CODES.VALIDATION_FAILED);
      if (!isNonNegativeNumber(unitCost)) return errorResponse("Unit cost cannot be negative.",   ERROR_CODES.VALIDATION_FAILED);

      var sinRowIdx = findRowById(SHEETS.STOCK_IN, stockInId, 1);
      if (sinRowIdx === -1) return errorResponse("Stock In record not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sinSheet  = getSheet(SHEETS.STOCK_IN);
      var existing  = sinSheet.getRange(sinRowIdx, 1, 1, HEADERS.STOCK_IN.length).getValues()[0];
      var itemId    = String(existing[2]);
      var oldQty    = toNumber(existing[5], 0);
      var oldAmt    = toNumber(existing[7], 0);
      var newAmt    = roundTo2(quantity * unitCost);
      var qtyDelta  = quantity - oldQty;

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var itemSheet  = getSheet(SHEETS.INVENTORY_ITEMS);
      var curStock   = toNumber(itemSheet.getRange(itemRowIdx, 6).getValue(), 0);
      var newStock   = roundTo2(curStock + qtyDelta);
      if (newStock < 0) return errorResponse("This edit would reduce stock below 0.", ERROR_CODES.VALIDATION_FAILED);

      var ts  = formatDateTime(now());
      var row = [stockInId, date, itemId, existing[3], existing[4],
                 quantity, roundTo2(unitCost), newAmt, vendor, paymentMethod, notes, existing[11]];
      sinSheet.getRange(sinRowIdx, 1, 1, row.length).setValues([row]);

      itemSheet.getRange(itemRowIdx, 6).setValue(newStock);
      itemSheet.getRange(itemRowIdx, 10).setValue(ts);

      if ((newAmt > 0 || oldAmt > 0) && !isBlank(paymentMethod)) {
        _updateLedgerEntry(stockInId, LEDGER_TYPES.EXPENSE, newAmt, 0);
      }

      return successResponse(_sinRowToObj(row), "Stock In updated.");
    } catch(e) {
      return handleError(e, "updateStockIn");
    }
  }, 10000);
}

function deleteStockIn(stockInId) {
  return withScriptLock(function() {
    try {
      var sinRowIdx = findRowById(SHEETS.STOCK_IN, stockInId, 1);
      if (sinRowIdx === -1) return errorResponse("Stock In record not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var sinSheet = getSheet(SHEETS.STOCK_IN);
      var existing = sinSheet.getRange(sinRowIdx, 1, 1, HEADERS.STOCK_IN.length).getValues()[0];
      var itemId   = String(existing[2]);
      var qty      = toNumber(existing[5], 0);

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx !== -1) {
        var itemSheet = getSheet(SHEETS.INVENTORY_ITEMS);
        var curStock  = toNumber(itemSheet.getRange(itemRowIdx, 6).getValue(), 0);
        var newStock  = roundTo2(curStock - qty);
        if (newStock < 0) newStock = 0;
        itemSheet.getRange(itemRowIdx, 6).setValue(newStock);
        itemSheet.getRange(itemRowIdx, 10).setValue(formatDateTime(now()));
      }

      _removeStockLedgerEntry(stockInId);
      _removeLedgerEntry(stockInId);
      sinSheet.deleteRow(sinRowIdx);

      return successResponse({ stockInId: stockInId }, "Stock In deleted.");
    } catch(e) {
      return handleError(e, "deleteStockIn");
    }
  }, 10000);
}

function listStockIns(filters) {
  try {
    var rows  = getSheetData(SHEETS.STOCK_IN);
    var items = rows.filter(function(r) { return trimStr(r[0]) !== ""; }).map(_sinRowToObj);

    if (filters) {
      if (filters.itemId)   items = items.filter(function(i) { return i.itemId   === filters.itemId; });
      if (filters.category) items = items.filter(function(i) { return i.category === filters.category; });
      if (filters.dateFrom) items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)   items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.stockInId.toLowerCase().indexOf(q) !== -1 ||
                 i.itemName.toLowerCase().indexOf(q)  !== -1 ||
                 i.vendor.toLowerCase().indexOf(q)    !== -1 ||
                 i.category.toLowerCase().indexOf(q)  !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch(e) {
    return handleError(e, "listStockIns");
  }
}


// =============================================================================
// STOCK OUT — CRUD
// =============================================================================

function addStockOut(data) {
  return withScriptLock(function() {
    try {
      var date       = trimStr(data.date       || "");
      var itemId     = trimStr(data.itemId     || "");
      var quantity   = toNumber(data.quantity,  0);
      var purpose    = trimStr(data.purpose    || "");
      var department = trimStr(data.department || "");
      var notes      = trimStr(data.notes      || "");

      if (isBlank(date))               return errorResponse("Date is required.",       ERROR_CODES.MISSING_FIELD);
      if (isBlank(itemId))             return errorResponse("Item is required.",       ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(quantity)) return errorResponse("Quantity must be positive.", ERROR_CODES.VALIDATION_FAILED);
      if (isBlank(purpose))            return errorResponse("Purpose is required.",    ERROR_CODES.MISSING_FIELD);
      if (isBlank(department))         return errorResponse("Department is required.", ERROR_CODES.MISSING_FIELD);

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var itemSheet  = getSheet(SHEETS.INVENTORY_ITEMS);
      var itemRow    = itemSheet.getRange(itemRowIdx, 1, 1, HEADERS.INVENTORY_ITEMS.length).getValues()[0];

      var itemName = String(itemRow[1]);
      var category = String(itemRow[2]);
      var uom      = String(itemRow[3]);
      var curStock = toNumber(itemRow[5], 0);

      if (quantity > curStock) {
        return errorResponse(
          "Quantity (" + quantity + " " + uom + ") exceeds available stock (" + curStock + " " + uom + ").",
          ERROR_CODES.VALIDATION_FAILED
        );
      }

      var newStock   = roundTo2(curStock - quantity);
      var stockOutId = getNextId("STOCK_OUT");
      var ts         = formatDateTime(now());
      var row        = [stockOutId, date, itemId, itemName, category, quantity, purpose, department, notes, ts];

      appendRow(SHEETS.STOCK_OUT, row);

      itemSheet.getRange(itemRowIdx, 6).setValue(newStock);
      itemSheet.getRange(itemRowIdx, 10).setValue(ts);

      _addStockLedgerEntry(itemId, itemName, INV_MOVEMENT.OUT, 0, quantity, newStock, stockOutId, "Stock Out",
                           purpose + " — " + department);

      return successResponse(_soutRowToObj(row), stockOutId + " — Stock issued successfully.");
    } catch(e) {
      return handleError(e, "addStockOut");
    }
  }, 10000);
}

function updateStockOut(stockOutId, data) {
  return withScriptLock(function() {
    try {
      var date       = trimStr(data.date       || "");
      var quantity   = toNumber(data.quantity,  0);
      var purpose    = trimStr(data.purpose    || "");
      var department = trimStr(data.department || "");
      var notes      = trimStr(data.notes      || "");

      if (isBlank(date))               return errorResponse("Date is required.",       ERROR_CODES.MISSING_FIELD);
      if (!isPositiveNumber(quantity)) return errorResponse("Quantity must be positive.", ERROR_CODES.VALIDATION_FAILED);
      if (isBlank(purpose))            return errorResponse("Purpose is required.",    ERROR_CODES.MISSING_FIELD);
      if (isBlank(department))         return errorResponse("Department is required.", ERROR_CODES.MISSING_FIELD);

      var soutRowIdx = findRowById(SHEETS.STOCK_OUT, stockOutId, 1);
      if (soutRowIdx === -1) return errorResponse("Stock Out record not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var soutSheet = getSheet(SHEETS.STOCK_OUT);
      var existing  = soutSheet.getRange(soutRowIdx, 1, 1, HEADERS.STOCK_OUT.length).getValues()[0];
      var itemId    = String(existing[2]);
      var oldQty    = toNumber(existing[5], 0);
      var qtyDelta  = quantity - oldQty;

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);
      var itemSheet  = getSheet(SHEETS.INVENTORY_ITEMS);
      var curStock   = toNumber(itemSheet.getRange(itemRowIdx, 6).getValue(), 0);
      var newStock   = roundTo2(curStock - qtyDelta);

      if (newStock < 0) {
        return errorResponse(
          "Updated quantity would exceed available stock. Available: " + (curStock + oldQty) + ".",
          ERROR_CODES.VALIDATION_FAILED
        );
      }

      var ts  = formatDateTime(now());
      var row = [stockOutId, date, itemId, existing[3], existing[4],
                 quantity, purpose, department, notes, existing[9]];
      soutSheet.getRange(soutRowIdx, 1, 1, row.length).setValues([row]);

      itemSheet.getRange(itemRowIdx, 6).setValue(newStock);
      itemSheet.getRange(itemRowIdx, 10).setValue(ts);

      return successResponse(_soutRowToObj(row), "Stock Out updated.");
    } catch(e) {
      return handleError(e, "updateStockOut");
    }
  }, 10000);
}

function deleteStockOut(stockOutId) {
  return withScriptLock(function() {
    try {
      var soutRowIdx = findRowById(SHEETS.STOCK_OUT, stockOutId, 1);
      if (soutRowIdx === -1) return errorResponse("Stock Out record not found.", ERROR_CODES.RECORD_NOT_FOUND);

      var soutSheet = getSheet(SHEETS.STOCK_OUT);
      var existing  = soutSheet.getRange(soutRowIdx, 1, 1, HEADERS.STOCK_OUT.length).getValues()[0];
      var itemId    = String(existing[2]);
      var qty       = toNumber(existing[5], 0);

      var itemRowIdx = findRowById(SHEETS.INVENTORY_ITEMS, itemId, 1);
      if (itemRowIdx !== -1) {
        var itemSheet = getSheet(SHEETS.INVENTORY_ITEMS);
        var curStock  = toNumber(itemSheet.getRange(itemRowIdx, 6).getValue(), 0);
        itemSheet.getRange(itemRowIdx, 6).setValue(roundTo2(curStock + qty));
        itemSheet.getRange(itemRowIdx, 10).setValue(formatDateTime(now()));
      }

      _removeStockLedgerEntry(stockOutId);
      soutSheet.deleteRow(soutRowIdx);

      return successResponse({ stockOutId: stockOutId }, "Stock Out deleted.");
    } catch(e) {
      return handleError(e, "deleteStockOut");
    }
  }, 10000);
}

function listStockOuts(filters) {
  try {
    var rows  = getSheetData(SHEETS.STOCK_OUT);
    var items = rows.filter(function(r) { return trimStr(r[0]) !== ""; }).map(_soutRowToObj);

    if (filters) {
      if (filters.itemId)     items = items.filter(function(i) { return i.itemId     === filters.itemId; });
      if (filters.category)   items = items.filter(function(i) { return i.category   === filters.category; });
      if (filters.department) items = items.filter(function(i) { return i.department === filters.department; });
      if (filters.dateFrom)   items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)     items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.stockOutId.toLowerCase().indexOf(q)  !== -1 ||
                 i.itemName.toLowerCase().indexOf(q)    !== -1 ||
                 i.purpose.toLowerCase().indexOf(q)     !== -1 ||
                 i.department.toLowerCase().indexOf(q)  !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch(e) {
    return handleError(e, "listStockOuts");
  }
}


// =============================================================================
// STOCK LEDGER — read-only
// =============================================================================

function listStockLedger(filters) {
  try {
    var rows  = getSheetData(SHEETS.STOCK_LEDGER);
    var items = rows.filter(function(r) { return trimStr(r[0]) !== ""; }).map(_slgRowToObj);

    if (filters) {
      if (filters.itemId)       items = items.filter(function(i) { return i.itemId       === filters.itemId; });
      if (filters.movementType) items = items.filter(function(i) { return i.movementType === filters.movementType; });
      if (filters.dateFrom)     items = items.filter(function(i) { return i.date >= filters.dateFrom; });
      if (filters.dateTo)       items = items.filter(function(i) { return i.date <= filters.dateTo; });
      if (filters.search) {
        var q = trimStr(filters.search).toLowerCase();
        items = items.filter(function(i) {
          return i.stockLedgerId.toLowerCase().indexOf(q) !== -1 ||
                 i.itemName.toLowerCase().indexOf(q)      !== -1 ||
                 i.referenceId.toLowerCase().indexOf(q)   !== -1;
        });
      }
    }

    items.sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return successResponse(items);
  } catch(e) {
    return handleError(e, "listStockLedger");
  }
}


// =============================================================================
// LOW STOCK REPORT
// =============================================================================

function getLowStockItems() {
  try {
    var rows  = getSheetData(SHEETS.INVENTORY_ITEMS);
    var items = rows
      .filter(function(r) {
        return trimStr(r[0]) !== "" && String(r[6]) !== INV_ITEM_STATUS.INACTIVE;
      })
      .map(_itemRowToObj)
      .filter(function(i) { return i.currentStock <= i.reorderLevel; });

    items.sort(function(a, b) {
      return (a.currentStock - a.reorderLevel) - (b.currentStock - b.reorderLevel);
    });

    return successResponse(items);
  } catch(e) {
    return handleError(e, "getLowStockItems");
  }
}


// =============================================================================
// INVENTORY STATS — called by getDashboardData()
// =============================================================================

function getInventoryStats() {
  try {
    var invRows    = getSheetData(SHEETS.INVENTORY_ITEMS).filter(function(r) { return trimStr(r[0]) !== ""; });
    var total      = invRows.filter(function(r) { return String(r[6]) === INV_ITEM_STATUS.ACTIVE; }).length;
    var lowStock   = invRows.filter(function(r) {
      return String(r[6]) !== INV_ITEM_STATUS.INACTIVE && toNumber(r[5], 0) <= toNumber(r[4], 0);
    }).length;
    var outOfStock = invRows.filter(function(r) {
      return String(r[6]) !== INV_ITEM_STATUS.INACTIVE && toNumber(r[5], 0) === 0;
    }).length;
    var sinRows    = getSheetData(SHEETS.STOCK_IN).filter(function(r) { return trimStr(r[0]) !== ""; });
    var stockValue = roundTo2(sinRows.reduce(function(s, r) { return s + toNumber(r[7], 0); }, 0));

    return successResponse({ total: total, lowStock: lowStock, outOfStock: outOfStock, stockValue: stockValue });
  } catch(e) {
    return handleError(e, "getInventoryStats");
  }
}


// =============================================================================
// ITEM LOOKUP — used by Stock In / Stock Out forms
// =============================================================================

function getInventoryItemById(itemId) {
  try {
    var rowIdx = findRowById(SHEETS.INVENTORY_ITEMS, trimStr(itemId || ""), 1);
    if (rowIdx === -1) return errorResponse("Item not found.", ERROR_CODES.RECORD_NOT_FOUND);
    var row = getSheet(SHEETS.INVENTORY_ITEMS)
                .getRange(rowIdx, 1, 1, HEADERS.INVENTORY_ITEMS.length).getValues()[0];
    return successResponse(_itemRowToObj(row));
  } catch(e) {
    return handleError(e, "getInventoryItemById");
  }
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _addStockLedgerEntry(itemId, itemName, movementType, qtyIn, qtyOut, balanceAfter, referenceId, sourceModule, notes) {
  try {
    // Duplicate guard — same referenceId + same movementType
    var existing = getSheetData(SHEETS.STOCK_LEDGER);
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][8]) === String(referenceId) &&
          String(existing[i][4]) === String(movementType)) {
        console.warn("[_addStockLedgerEntry] Duplicate skipped ref=" + referenceId);
        return;
      }
    }
    var slgId = getNextId("STOCK_LEDGER");
    var ts    = formatDateTime(now());
    appendRow(SHEETS.STOCK_LEDGER, [
      slgId, formatDate(now()), itemId, itemName, movementType,
      qtyIn, qtyOut, roundTo2(balanceAfter),
      referenceId, sourceModule || "", notes || "", ts,
    ]);
  } catch(e) {
    console.error("[_addStockLedgerEntry] ref=" + referenceId + " err=" + e.message);
  }
}

function _removeStockLedgerEntry(referenceId) {
  try {
    if (!referenceId) return;
    var rows  = getSheetData(SHEETS.STOCK_LEDGER);
    var sheet = getSheet(SHEETS.STOCK_LEDGER);
    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][8]) === String(referenceId)) {
        sheet.deleteRow(i + 2); // +1 for header, +1 for 1-based
      }
    }
  } catch(e) {
    console.error("[_removeStockLedgerEntry] ref=" + referenceId + " err=" + e.message);
  }
}

function _itemRowToObj(row) {
  var cur   = toNumber(row[5], 0);
  var reord = toNumber(row[4], 0);
  var ss    = cur === 0 ? "Out of Stock" : (cur <= reord ? "Low Stock" : "In Stock");
  return {
    itemId       : String(row[0]),
    itemName     : String(row[1] || ""),
    category     : String(row[2] || ""),
    uom          : String(row[3] || ""),
    reorderLevel : reord,
    currentStock : cur,
    status       : String(row[6] || "Active"),
    stockStatus  : ss,
    notes        : String(row[7] || ""),
    createdAt    : row[8] ? formatDateTime(row[8]) : "",
    updatedAt    : row[9] ? formatDateTime(row[9]) : "",
  };
}

function _sinRowToObj(row) {
  return {
    stockInId    : String(row[0]),
    date         : row[1]  ? formatDate(row[1])     : "",
    itemId       : String(row[2]  || ""),
    itemName     : String(row[3]  || ""),
    category     : String(row[4]  || ""),
    quantity     : toNumber(row[5],  0),
    unitCost     : toNumber(row[6],  0),
    totalAmount  : toNumber(row[7],  0),
    vendor       : String(row[8]  || ""),
    paymentMethod: String(row[9]  || ""),
    notes        : String(row[10] || ""),
    createdAt    : row[11] ? formatDateTime(row[11]) : "",
  };
}

function _soutRowToObj(row) {
  return {
    stockOutId : String(row[0]),
    date       : row[1] ? formatDate(row[1]) : "",
    itemId     : String(row[2] || ""),
    itemName   : String(row[3] || ""),
    category   : String(row[4] || ""),
    quantity   : toNumber(row[5], 0),
    purpose    : String(row[6] || ""),
    department : String(row[7] || ""),
    notes      : String(row[8] || ""),
    createdAt  : row[9] ? formatDateTime(row[9]) : "",
  };
}

function _slgRowToObj(row) {
  return {
    stockLedgerId: String(row[0]),
    date         : row[1] ? formatDate(row[1]) : "",
    itemId       : String(row[2]  || ""),
    itemName     : String(row[3]  || ""),
    movementType : String(row[4]  || ""),
    quantityIn   : toNumber(row[5],  0),
    quantityOut  : toNumber(row[6],  0),
    balanceAfter : toNumber(row[7],  0),
    referenceId  : String(row[8]  || ""),
    sourceModule : String(row[9]  || ""),
    notes        : String(row[10] || ""),
    createdAt    : row[11] ? formatDateTime(row[11]) : "",
  };
}
