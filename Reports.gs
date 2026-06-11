// =============================================================================
// REPORTS MODULE — Reports.gs
// Parameterized report engine. params: { from, to, reportType }
// Each report returns: { period, reportType, title, kpis, columns, rowTypes, rows, totalsRow, meta }
// =============================================================================

function getReportData(params) {
  try {
    var from = trimStr((params && params.from) || "");
    var to   = trimStr((params && params.to)   || "");
    var type = trimStr((params && params.reportType) || "income-statement");

    if (!from || !to) {
      var d = now(); var yyyy = d.getFullYear(); var mm = d.getMonth() + 1;
      from = yyyy + "-" + _rPad(mm) + "-01";
      to   = yyyy + "-" + _rPad(mm) + "-" + new Date(yyyy, mm, 0).getDate();
    }
    if (from > to) return errorResponse("Date From cannot be after Date To.", ERROR_CODES.INVALID_DATE_RANGE);

    var period = { from: from, to: to };
    var handler = _REPORT_HANDLERS[type];
    if (!handler) return errorResponse("Unknown report type: " + type, ERROR_CODES.VALIDATION_FAILED);

    var result = handler(period);
    result.period     = period;
    result.reportType = type;
    return successResponse(result);
  } catch(e) {
    return handleError(e, "getReportData");
  }
}


// =============================================================================
// REPORT HANDLERS
// =============================================================================

var _REPORT_HANDLERS = {
  "income-statement"      : _rptIncomeStatement,
  "cash-flow"             : _rptCashFlow,
  "outstanding-receivables": _rptOutstandingReceivables,
  "invoice-aging"         : _rptInvoiceAging,
  "payment-collection"    : _rptPaymentCollection,
  "expense-summary"       : _rptExpenseSummary,
  "booking-summary"       : _rptBookingSummary,
  "occupancy-report"      : _rptOccupancyReport,
  "checkin-checkout"      : _rptCheckInCheckOut,
  "cancelled-bookings"    : _rptCancelledBookings,
  "guest-stay-history"    : _rptGuestStayHistory,
  "room-revenue"          : _rptRoomRevenue,
  "room-occupancy-type"   : _rptRoomOccupancyType,
  "room-maintenance"      : _rptRoomMaintenance,
  "kitchen-sales"         : _rptKitchenSales,
  "kitchen-expense"       : _rptKitchenExpense,
  "kitchen-profit"        : _rptKitchenProfit,
  "stock-summary"         : _rptStockSummary,
  "low-stock"             : _rptLowStock,
  "stock-movement"        : _rptStockMovement,
  "inventory-valuation"   : _rptInventoryValuation,
};

// ── 1. Income Statement ──────────────────────────────────────────────────────
function _rptIncomeStatement(p) {
  var riRows = _filteredRows(SHEETS.ROOM_INCOME,    8, p.from, p.to);
  var kiRows = _filteredRows(SHEETS.KITCHEN_INCOME, 7, p.from, p.to);
  var pyRows = _filteredRows(SHEETS.PAYMENTS, 8, p.from, p.to)
    .filter(function(r){ return String(r[6]||"") !== PAYMENT_TYPES.REFUND; });
  var rfRows = _filteredRows(SHEETS.PAYMENTS, 8, p.from, p.to)
    .filter(function(r){ return String(r[6]||"") === PAYMENT_TYPES.REFUND; });
  var reRows = _filteredRows(SHEETS.ROOM_EXPENSE,    5, p.from, p.to);
  var keRows = _filteredRows(SHEETS.KITCHEN_EXPENSE, 5, p.from, p.to);
  var siRows = _filteredRows(SHEETS.STOCK_IN,        1, p.from, p.to);
  var invBillRows = _filteredRows(SHEETS.INVOICES, 7, p.from, p.to)
    .filter(function(r){ return String(r[17]) !== INVOICE_STATUS.CANCELLED; });

  var riTotal = _sumCol(riRows, 5), kiTotal = _sumCol(kiRows, 5);
  var pyTotal = _sumCol(pyRows, 4), rfTotal = _sumCol(rfRows, 4);
  var reTotal = _sumCol(reRows, 3), keTotal = _sumCol(keRows, 3);
  var siTotal = _sumCol(siRows, 7);
  var invRevenue = roundTo2(_sumCol(invBillRows, 15)); // PaidAmount

  var totalIncome   = roundTo2(riTotal + kiTotal + pyTotal - rfTotal);
  var totalExpenses = roundTo2(reTotal + keTotal + siTotal);
  var netPL         = roundTo2(totalIncome - totalExpenses);
  var margin        = totalIncome > 0 ? roundTo2(netPL / totalIncome * 100) : 0;

  var riCat = _groupByCol(riRows, 4, 5);
  var kiCat = _groupByCol(kiRows, 3, 5);
  var reCat = _groupByCol(reRows, 2, 3);
  var keCat = _groupByCol(keRows, 1, 3);
  var siCat = _groupByCol(siRows, 4, 7);

  var rows = [];
  Object.keys(riCat).forEach(function(k){ rows.push(["Income", "Room Income", k, riCat[k], totalIncome > 0 ? roundTo2(riCat[k]/totalIncome*100) : 0]); });
  Object.keys(kiCat).forEach(function(k){ rows.push(["Income", "Kitchen Income", k, kiCat[k], totalIncome > 0 ? roundTo2(kiCat[k]/totalIncome*100) : 0]); });
  if (pyTotal > 0) rows.push(["Income", "Payments", "Guest Payments", pyTotal, totalIncome > 0 ? roundTo2(pyTotal/totalIncome*100) : 0]);
  if (rfTotal > 0) rows.push(["Deduction", "Payments", "Refunds", -rfTotal, 0]);
  Object.keys(reCat).forEach(function(k){ rows.push(["Expense", "Room Expense", k, reCat[k], totalExpenses > 0 ? roundTo2(reCat[k]/totalExpenses*100) : 0]); });
  Object.keys(keCat).forEach(function(k){ rows.push(["Expense", "Kitchen Expense", k, keCat[k], totalExpenses > 0 ? roundTo2(keCat[k]/totalExpenses*100) : 0]); });
  Object.keys(siCat).forEach(function(k){ rows.push(["Expense", "Inventory Purchase", k, siCat[k], totalExpenses > 0 ? roundTo2(siCat[k]/totalExpenses*100) : 0]); });

  return {
    title: "Income Statement",
    kpis: [
      { label: "Total Income",    value: totalIncome,   type: "currency" },
      { label: "Total Expenses",  value: totalExpenses, type: "currency" },
      { label: "Net P&L",         value: netPL,         type: "currency", highlight: netPL >= 0 ? "green" : "red" },
      { label: "Profit Margin",   value: margin,        type: "percent" },
    ],
    columns : ["Type", "Source", "Category", "Amount (PKR)", "% Share"],
    rowTypes: ["badge-type", "text", "text", "currency", "percent"],
    rows    : rows,
    totalsRow: [null, null, "NET P&L", netPL, null],
  };
}

// ── 2. Cash Flow Statement ───────────────────────────────────────────────────
function _rptCashFlow(p) {
  var ledRows = _filteredRows(SHEETS.LEDGER, 1, p.from, p.to);
  var allRows = getSheetData(SHEETS.LEDGER).filter(function(r){ return trimStr(r[0]) !== ""; });

  var cashIn  = roundTo2(ledRows.filter(function(r){ return String(r[2]) === LEDGER_TYPES.INCOME; }).reduce(function(s,r){ return s+toNumber(r[8],0); }, 0));
  var cashOut = roundTo2(ledRows.filter(function(r){ return String(r[2]) === LEDGER_TYPES.EXPENSE; }).reduce(function(s,r){ return s+toNumber(r[7],0); }, 0));
  var netFlow = roundTo2(cashIn - cashOut);
  var closing = allRows.length > 0 ? roundTo2(toNumber(allRows[allRows.length-1][9], 0)) : 0;

  var rows = ledRows.map(function(r) {
    var isIncome = String(r[2]) === LEDGER_TYPES.INCOME;
    return [
      r[1] ? formatDate(r[1]) : "",
      String(r[5] || ""),           // ReferenceID
      String(r[3] || ""),           // Category
      String(r[6] || ""),           // Description
      isIncome ? toNumber(r[8],0) : 0,
      !isIncome ? toNumber(r[7],0) : 0,
      toNumber(r[9],0),
    ];
  });

  return {
    title: "Cash Flow Statement",
    kpis: [
      { label: "Cash In",      value: cashIn,   type: "currency" },
      { label: "Cash Out",     value: cashOut,  type: "currency" },
      { label: "Net Flow",     value: netFlow,  type: "currency", highlight: netFlow >= 0 ? "green" : "red" },
      { label: "Closing Balance", value: closing, type: "currency" },
    ],
    columns : ["Date", "Reference", "Category", "Description", "Cash In (PKR)", "Cash Out (PKR)", "Balance (PKR)"],
    rowTypes: ["date", "text", "text", "text", "currency", "currency", "currency"],
    rows    : rows,
    totalsRow: [null, null, null, "TOTALS", cashIn, cashOut, null],
  };
}

// ── 3. Outstanding Receivables ───────────────────────────────────────────────
function _rptOutstandingReceivables(p) {
  var invRows = getSheetData(SHEETS.INVOICES).filter(function(r) {
    var st = String(r[17]||"");
    return trimStr(r[0]) !== "" && st !== INVOICE_STATUS.CANCELLED && st !== INVOICE_STATUS.PAID;
  });

  var total = roundTo2(_sumCol(invRows, 16));
  var count = invRows.length;
  var oldest = "";
  invRows.forEach(function(r){ var d = r[7]?formatDate(r[7]):""; if(!oldest || d < oldest) oldest = d; });
  var avg = count > 0 ? roundTo2(total / count) : 0;

  var rows = invRows.map(function(r) {
    return [
      String(r[1]||""), String(r[4]||""), String(r[6]||""),
      r[7]?formatDate(r[7]):"",
      toNumber(r[14],0), toNumber(r[15],0), toNumber(r[16],0), String(r[17]||""),
    ];
  });
  rows.sort(function(a,b){ return (a[3]||"").localeCompare(b[3]||""); });

  return {
    title: "Outstanding Receivables",
    kpis: [
      { label: "Total Outstanding", value: total, type: "currency" },
      { label: "Invoice Count",     value: count, type: "count" },
      { label: "Oldest Invoice",    value: oldest, type: "text" },
      { label: "Average Balance",   value: avg,   type: "currency" },
    ],
    columns : ["Invoice No", "Guest", "Room", "Invoice Date", "Grand Total (PKR)", "Paid (PKR)", "Balance Due (PKR)", "Status"],
    rowTypes: ["text", "text", "text", "date", "currency", "currency", "currency-red", "badge"],
    rows    : rows,
    totalsRow: [null, null, null, "TOTAL", null, null, total, null],
  };
}

// ── 4. Invoice Aging ─────────────────────────────────────────────────────────
function _rptInvoiceAging(p) {
  var today = formatDate(now());
  var invRows = getSheetData(SHEETS.INVOICES).filter(function(r) {
    var st = String(r[17]||"");
    return trimStr(r[0]) !== "" && st !== INVOICE_STATUS.CANCELLED && st !== INVOICE_STATUS.PAID && toNumber(r[16],0) > 0;
  });

  var buckets = { "0-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 };
  var rows = invRows.map(function(r) {
    var invDate = r[7] ? formatDate(r[7]) : today;
    var age = Math.max(0, Math.round((new Date(today) - new Date(invDate)) / 86400000));
    var bucket = age <= 30 ? "0-30 days" : age <= 60 ? "31-60 days" : age <= 90 ? "61-90 days" : "90+ days";
    buckets[bucket] = roundTo2(buckets[bucket] + toNumber(r[16],0));
    return [String(r[1]||""), String(r[4]||""), invDate, toNumber(r[16],0), age, bucket, String(r[17]||"")];
  });
  rows.sort(function(a,b){ return (b[4]||0) - (a[4]||0); });

  return {
    title: "Invoice Aging Report",
    kpis: [
      { label: "0-30 Days",   value: buckets["0-30 days"],   type: "currency" },
      { label: "31-60 Days",  value: buckets["31-60 days"],  type: "currency" },
      { label: "61-90 Days",  value: buckets["61-90 days"],  type: "currency" },
      { label: "90+ Days",    value: buckets["90+ days"],    type: "currency", highlight: buckets["90+ days"] > 0 ? "red" : "green" },
    ],
    columns : ["Invoice No", "Guest", "Invoice Date", "Balance Due (PKR)", "Age (Days)", "Aging Bucket", "Status"],
    rowTypes: ["text", "text", "date", "currency-red", "number", "badge-aging", "badge"],
    rows    : rows,
    totalsRow: [null, null, null, roundTo2(_sumCol(invRows, 16)), null, null, null],
  };
}

// ── 5. Payment Collection ────────────────────────────────────────────────────
function _rptPaymentCollection(p) {
  var pyRows = _filteredRows(SHEETS.PAYMENTS, 8, p.from, p.to);
  var nonRef = pyRows.filter(function(r){ return String(r[6]||"") !== PAYMENT_TYPES.REFUND; });
  var refund = pyRows.filter(function(r){ return String(r[6]||"") === PAYMENT_TYPES.REFUND; });
  var total  = roundTo2(_sumCol(nonRef, 4));
  var byMethod = _groupByCol(nonRef, 5, 4);
  var topMethod = Object.keys(byMethod).sort(function(a,b){ return byMethod[b]-byMethod[a]; })[0] || "—";

  var rows = pyRows.map(function(r) {
    return [String(r[0]||""), String(r[2]||""), String(r[3]||""), toNumber(r[4],0), String(r[5]||""), String(r[6]||""), r[8]?formatDate(r[8]):"", String(r[7]||"")];
  });

  return {
    title: "Payment Collection Report",
    kpis: [
      { label: "Total Collected",  value: total,         type: "currency" },
      { label: "Transactions",     value: nonRef.length, type: "count" },
      { label: "Refunds",          value: roundTo2(_sumCol(refund, 4)), type: "currency" },
      { label: "Top Method",       value: topMethod,     type: "text" },
    ],
    columns : ["Payment ID", "Guest", "Room", "Amount (PKR)", "Method", "Type", "Date", "Notes"],
    rowTypes: ["text", "text", "text", "currency", "badge-method", "badge", "date", "text"],
    rows    : rows,
    totalsRow: [null, null, "TOTAL", total, null, null, null, null],
    meta    : { byMethod: byMethod },
  };
}

// ── 6. Expense Summary ───────────────────────────────────────────────────────
function _rptExpenseSummary(p) {
  var reRows = _filteredRows(SHEETS.ROOM_EXPENSE,    5, p.from, p.to);
  var keRows = _filteredRows(SHEETS.KITCHEN_EXPENSE, 5, p.from, p.to);
  var siRows = _filteredRows(SHEETS.STOCK_IN,        1, p.from, p.to);
  var reTotal = _sumCol(reRows, 3), keTotal = _sumCol(keRows, 3), siTotal = _sumCol(siRows, 7);
  var grand   = roundTo2(reTotal + keTotal + siTotal);

  var rows = [];
  var reCat = _groupByCol(reRows, 2, 3);
  var keCat = _groupByCol(keRows, 1, 3);
  var siCat = _groupByCol(siRows, 4, 7);
  Object.keys(reCat).forEach(function(k){ rows.push(["Room Expense",    k, reCat[k], grand > 0 ? roundTo2(reCat[k]/grand*100):0]); });
  Object.keys(keCat).forEach(function(k){ rows.push(["Kitchen Expense", k, keCat[k], grand > 0 ? roundTo2(keCat[k]/grand*100):0]); });
  Object.keys(siCat).forEach(function(k){ rows.push(["Inventory",       k, siCat[k], grand > 0 ? roundTo2(siCat[k]/grand*100):0]); });
  rows.sort(function(a,b){ return b[2]-a[2]; });

  return {
    title: "Expense Summary",
    kpis: [
      { label: "Total Expenses",       value: grand,   type: "currency" },
      { label: "Room Expenses",        value: reTotal, type: "currency" },
      { label: "Kitchen Expenses",     value: keTotal, type: "currency" },
      { label: "Inventory Purchases",  value: siTotal, type: "currency" },
    ],
    columns : ["Type", "Category", "Amount (PKR)", "% of Total"],
    rowTypes: ["badge-type", "text", "currency", "percent"],
    rows    : rows,
    totalsRow: [null, "TOTAL", grand, null],
  };
}

// ── 7. Booking Summary ───────────────────────────────────────────────────────
function _rptBookingSummary(p) {
  var bkRows = _filteredRows(SHEETS.BOOKINGS, 18, p.from, p.to);
  var byStatus = _groupByColCount(bkRows, 14);
  var totalAmt = roundTo2(_sumCol(bkRows, 13));

  var rows = bkRows.map(function(r) {
    return [String(r[0]||""), String(r[2]||""), String(r[4]||""), r[5]?formatDate(r[5]):"", r[6]?formatDate(r[6]):"", toNumber(r[7],0), toNumber(r[13],0), String(r[14]||"")];
  });

  return {
    title: "Booking Summary",
    kpis: [
      { label: "Total Bookings",  value: bkRows.length, type: "count" },
      { label: "Confirmed",       value: byStatus[BOOKING_STATUS.CONFIRMED]   || 0, type: "count" },
      { label: "Checked Out",     value: byStatus[BOOKING_STATUS.CHECKED_OUT] || 0, type: "count" },
      { label: "Total Revenue",   value: totalAmt, type: "currency" },
    ],
    columns : ["Booking ID", "Guest", "Room", "Check-In", "Check-Out", "Nights", "Net Amount (PKR)", "Status"],
    rowTypes: ["text", "text", "text", "date", "date", "number", "currency", "badge"],
    rows    : rows,
    totalsRow: [null, null, null, null, null, _sumCol(bkRows, 7), totalAmt, null],
  };
}

// ── 8. Occupancy Report ──────────────────────────────────────────────────────
function _rptOccupancyReport(p) {
  var roomRows = getSheetData(SHEETS.ROOMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var bkRows   = _filteredRows(SHEETS.BOOKINGS, 5, p.from, p.to)
    .filter(function(r){ var s=String(r[14]||""); return s!==BOOKING_STATUS.CANCELLED && s!==BOOKING_STATUS.NO_SHOW; });
  var totalRooms = roomRows.length;

  // Build per-room booking counts/nights
  var roomNightsMap = {}, roomRevMap = {}, roomBookMap = {};
  bkRows.forEach(function(r) {
    var rn = String(r[4]||"");
    roomBookMap[rn]  = (roomBookMap[rn]  || 0) + 1;
    roomNightsMap[rn]= (roomNightsMap[rn]|| 0) + toNumber(r[7],0);
    roomRevMap[rn]   = (roomRevMap[rn]   || 0) + toNumber(r[13],0);
  });

  var totalNights = Object.keys(roomNightsMap).reduce(function(s,k){ return s+roomNightsMap[k]; }, 0);
  var periodDays  = Math.max(1, Math.round((new Date(p.to)-new Date(p.from))/86400000)+1);
  var maxNights   = totalRooms * periodDays;
  var occupancy   = maxNights > 0 ? roundTo2(totalNights / maxNights * 100) : 0;

  var rows = roomRows.map(function(r) {
    var rn = String(r[1]||"");
    var nb = roomBookMap[rn] || 0;
    var ni = roomNightsMap[rn] || 0;
    var rv = roomRevMap[rn] || 0;
    var occ = maxNights > 0 && periodDays > 0 ? roundTo2(ni/periodDays*100) : 0;
    return [rn, String(r[2]||""), String(r[3]||""), toNumber(r[5],0), nb, ni, rv, occ];
  });
  rows.sort(function(a,b){ return b[7]-a[7]; });

  return {
    title: "Occupancy Report",
    kpis: [
      { label: "Total Rooms",     value: totalRooms, type: "count" },
      { label: "Total Room-Nights", value: totalNights, type: "count" },
      { label: "Occupancy %",     value: occupancy, type: "percent" },
      { label: "Total Revenue",   value: roundTo2(_sumCol(bkRows, 13)), type: "currency" },
    ],
    columns : ["Room No", "Type", "Floor", "Rate/Night (PKR)", "Bookings", "Nights Booked", "Revenue (PKR)", "Occupancy %"],
    rowTypes: ["text", "text", "text", "currency", "number", "number", "currency", "percent"],
    rows    : rows,
    totalsRow: [null, null, null, null, bkRows.length, totalNights, roundTo2(_sumCol(bkRows, 13)), occupancy],
  };
}

// ── 9. Check-in / Check-out ──────────────────────────────────────────────────
function _rptCheckInCheckOut(p) {
  var allBk = getSheetData(SHEETS.BOOKINGS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var ciRows = allBk.filter(function(r){ return r[16] && _inDateRange(r[16], p.from, p.to); });
  var coRows = allBk.filter(function(r){ return r[17] && _inDateRange(r[17], p.from, p.to); });
  var inHouse= allBk.filter(function(r){ return String(r[14]||"") === BOOKING_STATUS.CHECKED_IN; }).length;

  var rows = [];
  ciRows.forEach(function(r){ rows.push([String(r[0]||""), String(r[2]||""), String(r[4]||""), toNumber(r[7],0), toNumber(r[13],0), r[16]?formatDate(r[16]):"", r[17]?formatDate(r[17]):"", "Check-In"]); });
  coRows.forEach(function(r){ rows.push([String(r[0]||""), String(r[2]||""), String(r[4]||""), toNumber(r[7],0), toNumber(r[13],0), r[16]?formatDate(r[16]):"", r[17]?formatDate(r[17]):"", "Check-Out"]); });
  rows.sort(function(a,b){ return (b[5]||b[6]||"").localeCompare(a[5]||a[6]||""); });

  return {
    title: "Check-In / Check-Out Report",
    kpis: [
      { label: "Check-Ins in Period",  value: ciRows.length, type: "count" },
      { label: "Check-Outs in Period", value: coRows.length, type: "count" },
      { label: "Currently In-House",   value: inHouse,       type: "count" },
      { label: "Revenue (Check-Outs)", value: roundTo2(coRows.reduce(function(s,r){ return s+toNumber(r[13],0); },0)), type: "currency" },
    ],
    columns : ["Booking ID", "Guest", "Room", "Nights", "Net Amount (PKR)", "Check-In Date", "Check-Out Date", "Event"],
    rowTypes: ["text", "text", "text", "number", "currency", "date", "date", "badge"],
    rows    : rows,
    totalsRow: null,
  };
}

// ── 10. Cancelled Bookings ───────────────────────────────────────────────────
function _rptCancelledBookings(p) {
  var bkRows  = _filteredRows(SHEETS.BOOKINGS, 18, p.from, p.to);
  var allBk   = bkRows.filter(function(r){ var s=String(r[14]||""); return s===BOOKING_STATUS.CANCELLED||s===BOOKING_STATUS.NO_SHOW; });
  var totalAll= bkRows.length;
  var revenue = roundTo2(_sumCol(allBk, 13));

  var rows = allBk.map(function(r) {
    return [String(r[0]||""), String(r[2]||""), String(r[4]||""), r[18]?formatDate(r[18]):"", r[5]?formatDate(r[5]):"", r[6]?formatDate(r[6]):"", toNumber(r[13],0), String(r[14]||"")];
  });

  return {
    title: "Cancelled Bookings Report",
    kpis: [
      { label: "Cancelled",   value: allBk.filter(function(r){ return String(r[14]||"")===BOOKING_STATUS.CANCELLED; }).length, type: "count" },
      { label: "No-Show",     value: allBk.filter(function(r){ return String(r[14]||"")===BOOKING_STATUS.NO_SHOW;   }).length, type: "count" },
      { label: "Revenue Lost", value: revenue, type: "currency", highlight: "red" },
      { label: "% of Bookings", value: totalAll > 0 ? roundTo2(allBk.length/totalAll*100) : 0, type: "percent" },
    ],
    columns : ["Booking ID", "Guest", "Room", "Created On", "Check-In", "Check-Out", "Net Amount (PKR)", "Status"],
    rowTypes: ["text", "text", "text", "date", "date", "date", "currency", "badge"],
    rows    : rows,
    totalsRow: [null, null, null, null, null, "TOTAL LOST", revenue, null],
  };
}

// ── 11. Guest Stay History ───────────────────────────────────────────────────
function _rptGuestStayHistory(p) {
  var bkRows = _filteredRows(SHEETS.BOOKINGS, 5, p.from, p.to)
    .filter(function(r){ var s=String(r[14]||""); return s!==BOOKING_STATUS.CANCELLED && s!==BOOKING_STATUS.NO_SHOW; });

  var guestMap = {};
  bkRows.forEach(function(r) {
    var gid   = String(r[1]||r[2]||"");
    var name  = String(r[2]||"");
    var ci    = r[5] ? formatDate(r[5]) : "";
    if (!guestMap[gid]) guestMap[gid] = { name: name, stays: 0, nights: 0, revenue: 0, last: "" };
    guestMap[gid].stays++;
    guestMap[gid].nights  += toNumber(r[7],0);
    guestMap[gid].revenue += toNumber(r[13],0);
    if (!guestMap[gid].last || ci > guestMap[gid].last) guestMap[gid].last = ci;
  });

  var rows = Object.keys(guestMap).map(function(k) {
    var g = guestMap[k];
    return [g.name, g.stays, g.nights, roundTo2(g.revenue), g.stays > 0 ? roundTo2(g.revenue/g.stays) : 0, g.last];
  });
  rows.sort(function(a,b){ return b[3]-a[3]; });

  var uniq   = rows.length;
  var totNights  = rows.reduce(function(s,r){ return s+r[2]; }, 0);
  var totRev     = roundTo2(rows.reduce(function(s,r){ return s+r[3]; }, 0));
  var avgRevStay = rows.reduce(function(s,r){ return s+r[1]; },0) > 0 ? roundTo2(totRev / rows.reduce(function(s,r){ return s+r[1]; },0)) : 0;

  return {
    title: "Guest Stay History",
    kpis: [
      { label: "Unique Guests",   value: uniq,        type: "count" },
      { label: "Total Stays",     value: bkRows.length, type: "count" },
      { label: "Total Nights",    value: totNights,   type: "count" },
      { label: "Avg Revenue/Stay", value: avgRevStay,  type: "currency" },
    ],
    columns : ["Guest Name", "Stays", "Total Nights", "Total Revenue (PKR)", "Avg/Stay (PKR)", "Last Check-In"],
    rowTypes: ["text", "number", "number", "currency", "currency", "date"],
    rows    : rows,
    totalsRow: [null, bkRows.length, totNights, totRev, null, null],
  };
}

// ── 12. Room Revenue ─────────────────────────────────────────────────────────
function _rptRoomRevenue(p) {
  var roomRows = getSheetData(SHEETS.ROOMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var riRows   = _filteredRows(SHEETS.ROOM_INCOME, 8, p.from, p.to);
  var bkRows   = _filteredRows(SHEETS.BOOKINGS,    5, p.from, p.to);
  var invRows  = _filteredRows(SHEETS.INVOICES,    7, p.from, p.to)
    .filter(function(r){ return String(r[17]) !== INVOICE_STATUS.CANCELLED; });

  var riMap = _groupByCol(riRows, 2, 5);  // RoomID → RI amount
  var rnMap = {};
  invRows.forEach(function(r){ var k = String(r[6]||""); rnMap[k] = (rnMap[k]||0) + toNumber(r[15],0); }); // RoomNumber → PaidAmount
  var bkMap = {};
  bkRows.forEach(function(r){ var k = String(r[4]||""); bkMap[k] = (bkMap[k]||0) + toNumber(r[13],0); }); // RoomNumber → NetAmount

  var rows = roomRows.map(function(r) {
    var rn   = String(r[1]||""), rid = String(r[0]||"");
    var ri   = toNumber(riMap[rid], 0);
    var inv  = toNumber(rnMap[rn],  0);
    var bk   = toNumber(bkMap[rn],  0);
    return [rn, String(r[2]||""), String(r[3]||""), toNumber(r[5],0), ri, inv, bk, roundTo2(ri+bk), String(r[6]||"")];
  });
  rows.sort(function(a,b){ return b[7]-a[7]; });

  var totRI = roundTo2(_sumCol(riRows, 5));
  var totInv= roundTo2(_sumCol(invRows, 15));
  var totBk = roundTo2(_sumCol(bkRows, 13));

  return {
    title: "Room Revenue Report",
    kpis: [
      { label: "Room Income",      value: totRI,  type: "currency" },
      { label: "Invoice Revenue",  value: totInv, type: "currency" },
      { label: "Booking Revenue",  value: totBk,  type: "currency" },
      { label: "Total Combined",   value: roundTo2(totRI + totBk), type: "currency" },
    ],
    columns : ["Room No", "Type", "Floor", "Rate/Night (PKR)", "Room Income (PKR)", "Invoice Revenue (PKR)", "Booking Amount (PKR)", "Total Revenue (PKR)", "Status"],
    rowTypes: ["text", "text", "text", "currency", "currency", "currency", "currency", "currency", "badge-room"],
    rows    : rows,
    totalsRow: [null, null, null, null, totRI, totInv, totBk, roundTo2(totRI+totBk), null],
  };
}

// ── 13. Room Occupancy by Type ───────────────────────────────────────────────
function _rptRoomOccupancyType(p) {
  var roomRows = getSheetData(SHEETS.ROOMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var bkRows   = _filteredRows(SHEETS.BOOKINGS, 5, p.from, p.to)
    .filter(function(r){ var s=String(r[14]||""); return s!==BOOKING_STATUS.CANCELLED&&s!==BOOKING_STATUS.NO_SHOW; });

  var typeRoomsMap = {}, typeBookMap = {}, typeNightsMap = {}, typeRevMap = {};
  var rnTypeMap = {};
  roomRows.forEach(function(r){ rnTypeMap[String(r[1]||"")] = String(r[2]||"Other"); });
  roomRows.forEach(function(r){
    var t = String(r[2]||"Other");
    typeRoomsMap[t] = (typeRoomsMap[t]||0) + 1;
  });
  bkRows.forEach(function(r){
    var t = rnTypeMap[String(r[4]||"")] || "Other";
    typeBookMap[t]  = (typeBookMap[t] ||0) + 1;
    typeNightsMap[t]= (typeNightsMap[t]||0) + toNumber(r[7],0);
    typeRevMap[t]   = (typeRevMap[t]  ||0) + toNumber(r[13],0);
  });

  var periodDays = Math.max(1, Math.round((new Date(p.to)-new Date(p.from))/86400000)+1);
  var rows = Object.keys(typeRoomsMap).map(function(t) {
    var cnt = typeRoomsMap[t]||0;
    var ni  = typeNightsMap[t]||0;
    var occ = cnt > 0 && periodDays > 0 ? roundTo2(ni/(cnt*periodDays)*100) : 0;
    return [t, cnt, typeBookMap[t]||0, ni, roundTo2(typeRevMap[t]||0), occ];
  });
  rows.sort(function(a,b){ return b[5]-a[5]; });

  return {
    title: "Room Occupancy by Type",
    kpis: [
      { label: "Room Types",       value: rows.length,        type: "count" },
      { label: "Total Rooms",      value: roomRows.length,    type: "count" },
      { label: "Total Bookings",   value: bkRows.length,      type: "count" },
      { label: "Total Revenue",    value: roundTo2(_sumCol(bkRows, 13)), type: "currency" },
    ],
    columns : ["Room Type", "Total Rooms", "Bookings", "Nights Booked", "Revenue (PKR)", "Occupancy %"],
    rowTypes: ["text", "number", "number", "number", "currency", "percent"],
    rows    : rows,
    totalsRow: [null, roomRows.length, bkRows.length, Object.keys(typeNightsMap).reduce(function(s,k){return s+(typeNightsMap[k]||0);},0), roundTo2(_sumCol(bkRows,13)), null],
  };
}

// ── 14. Room Maintenance ─────────────────────────────────────────────────────
function _rptRoomMaintenance(p) {
  var roomRows = getSheetData(SHEETS.ROOMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var reRows   = _filteredRows(SHEETS.ROOM_EXPENSE, 5, p.from, p.to);
  var reMap    = _groupByCol(reRows, 1, 3); // RoomID → expense

  var maintenance = roomRows.filter(function(r){ return String(r[6]||"") === ROOM_STATUS.MAINTENANCE; }).length;
  var cleaning    = roomRows.filter(function(r){ return String(r[6]||"") === ROOM_STATUS.CLEANING; }).length;

  var rows = roomRows.map(function(r) {
    return [String(r[1]||""), String(r[2]||""), String(r[3]||""), String(r[6]||""), toNumber(reMap[String(r[0]||"")],0), String(r[7]||"")];
  });
  rows.sort(function(a,b){ return b[4]-a[4]; });

  return {
    title: "Room Maintenance Report",
    kpis: [
      { label: "In Maintenance", value: maintenance, type: "count", highlight: maintenance > 0 ? "red" : "green" },
      { label: "In Cleaning",    value: cleaning,    type: "count" },
      { label: "Available",      value: roomRows.filter(function(r){ return String(r[6]||"")===ROOM_STATUS.AVAILABLE; }).length, type: "count" },
      { label: "Maintenance Expenses", value: roundTo2(_sumCol(reRows, 3)), type: "currency" },
    ],
    columns : ["Room No", "Type", "Floor", "Status", "Expenses in Period (PKR)", "Notes"],
    rowTypes: ["text", "text", "text", "badge-room", "currency", "text"],
    rows    : rows,
    totalsRow: [null, null, null, null, roundTo2(_sumCol(reRows, 3)), null],
  };
}

// ── 15. Kitchen Sales ────────────────────────────────────────────────────────
function _rptKitchenSales(p) {
  var kiRows  = _filteredRows(SHEETS.KITCHEN_INCOME, 7, p.from, p.to);
  var total   = roundTo2(_sumCol(kiRows, 5));
  var byCat   = _groupByCol(kiRows, 3, 5);
  var byMeth  = _groupByCol(kiRows, 6, 5);
  var topCat  = Object.keys(byCat).sort(function(a,b){ return byCat[b]-byCat[a]; })[0] || "—";

  var rows = kiRows.map(function(r) {
    return [String(r[3]||""), String(r[4]||""), String(r[6]||""), toNumber(r[5],0), r[7]?formatDate(r[7]):"", String(r[1]||"")];
  });

  return {
    title: "Kitchen Sales Report",
    kpis: [
      { label: "Total Sales",    value: total,         type: "currency" },
      { label: "Transactions",   value: kiRows.length, type: "count" },
      { label: "Avg Transaction", value: kiRows.length > 0 ? roundTo2(total/kiRows.length) : 0, type: "currency" },
      { label: "Top Category",   value: topCat,        type: "text" },
    ],
    columns : ["Category", "Items", "Payment Method", "Amount (PKR)", "Date", "Booking ID"],
    rowTypes: ["text", "text", "badge-method", "currency", "date", "text"],
    rows    : rows,
    totalsRow: [null, null, "TOTAL", total, null, null],
    meta    : { byCat: byCat, byMeth: byMeth },
  };
}

// ── 16. Kitchen Expense ──────────────────────────────────────────────────────
function _rptKitchenExpense(p) {
  var keRows = _filteredRows(SHEETS.KITCHEN_EXPENSE, 5, p.from, p.to);
  var total  = roundTo2(_sumCol(keRows, 3));
  var byCat  = _groupByCol(keRows, 1, 3);
  var topVendor = _groupByCol(keRows, 4, 3);
  var tv = Object.keys(topVendor).sort(function(a,b){ return topVendor[b]-topVendor[a]; })[0] || "—";

  var rows = keRows.map(function(r) {
    return [String(r[1]||""), String(r[2]||""), toNumber(r[3],0), String(r[4]||""), r[5]?formatDate(r[5]):""];
  });

  return {
    title: "Kitchen Expense Report",
    kpis: [
      { label: "Total Expenses",  value: total,          type: "currency" },
      { label: "Transactions",    value: keRows.length,  type: "count" },
      { label: "Avg Transaction", value: keRows.length > 0 ? roundTo2(total/keRows.length) : 0, type: "currency" },
      { label: "Top Vendor",      value: tv,             type: "text" },
    ],
    columns : ["Category", "Items", "Amount (PKR)", "Vendor", "Date"],
    rowTypes: ["text", "text", "currency", "text", "date"],
    rows    : rows,
    totalsRow: [null, "TOTAL", total, null, null],
  };
}

// ── 17. Kitchen Profit ───────────────────────────────────────────────────────
function _rptKitchenProfit(p) {
  var kiRows = _filteredRows(SHEETS.KITCHEN_INCOME,  7, p.from, p.to);
  var keRows = _filteredRows(SHEETS.KITCHEN_EXPENSE, 5, p.from, p.to);
  var kiCat  = _groupByCol(kiRows, 3, 5);
  var keCat  = _groupByCol(keRows, 1, 3);
  var allCats= {};
  Object.keys(kiCat).forEach(function(k){ allCats[k] = 1; });
  Object.keys(keCat).forEach(function(k){ allCats[k] = 1; });

  var totalSales = roundTo2(_sumCol(kiRows, 5)), totalExp = roundTo2(_sumCol(keRows, 3));
  var profit = roundTo2(totalSales - totalExp);

  var rows = Object.keys(allCats).map(function(k) {
    var s = roundTo2(kiCat[k]||0), e = roundTo2(keCat[k]||0), pr = roundTo2(s-e);
    var mg = s > 0 ? roundTo2(pr/s*100) : 0;
    return [k, s, e, pr, mg];
  });
  rows.sort(function(a,b){ return b[3]-a[3]; });

  return {
    title: "Kitchen Profit Report",
    kpis: [
      { label: "Total Sales",    value: totalSales, type: "currency" },
      { label: "Total Expenses", value: totalExp,   type: "currency" },
      { label: "Gross Profit",   value: profit,     type: "currency", highlight: profit >= 0 ? "green" : "red" },
      { label: "Profit Margin",  value: totalSales > 0 ? roundTo2(profit/totalSales*100) : 0, type: "percent" },
    ],
    columns : ["Category", "Sales (PKR)", "Expenses (PKR)", "Profit (PKR)", "Margin %"],
    rowTypes: ["text", "currency", "currency", "currency-pl", "percent"],
    rows    : rows,
    totalsRow: [null, totalSales, totalExp, profit, null],
  };
}

// ── 18. Stock Summary ────────────────────────────────────────────────────────
function _rptStockSummary(p) {
  var invRows = getSheetData(SHEETS.INVENTORY_ITEMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var active  = invRows.filter(function(r){ return String(r[6]) !== "Inactive"; });
  var low     = active.filter(function(r){ return toNumber(r[5],0) <= toNumber(r[4],0) && toNumber(r[4],0) > 0; }).length;
  var outOf   = active.filter(function(r){ return toNumber(r[5],0) === 0; }).length;

  var rows = invRows.map(function(r) {
    var stock = toNumber(r[5],0), reorder = toNumber(r[4],0);
    var st = toNumber(r[5],0) === 0 ? "Out of Stock" : (stock <= reorder && reorder > 0 ? "Low Stock" : String(r[6]||""));
    return [String(r[1]||""), String(r[2]||""), stock, String(r[3]||""), reorder, st];
  });
  rows.sort(function(a,b){ return (a[5]==="Out of Stock"?0:a[5]==="Low Stock"?1:2) - (b[5]==="Out of Stock"?0:b[5]==="Low Stock"?1:2); });

  return {
    title: "Stock Summary",
    kpis: [
      { label: "Total Items",  value: invRows.length, type: "count" },
      { label: "Active Items", value: active.length,  type: "count" },
      { label: "Low Stock",    value: low,            type: "count", highlight: low > 0 ? "amber" : "green" },
      { label: "Out of Stock", value: outOf,          type: "count", highlight: outOf > 0 ? "red" : "green" },
    ],
    columns : ["Item Name", "Category", "Current Stock", "UOM", "Reorder Level", "Status"],
    rowTypes: ["text", "text", "number", "text", "number", "badge-stock"],
    rows    : rows,
    totalsRow: null,
  };
}

// ── 19. Low Stock ────────────────────────────────────────────────────────────
function _rptLowStock(p) {
  var invRows = getSheetData(SHEETS.INVENTORY_ITEMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var sinRows = getSheetData(SHEETS.STOCK_IN).filter(function(r){ return trimStr(r[0]) !== ""; });
  var costMap = {};
  sinRows.forEach(function(r){ var id=String(r[2]||""); var c=toNumber(r[6],0); if(id&&c>0) costMap[id]=c; });

  var lowRows = invRows.filter(function(r){ return String(r[6]) !== "Inactive" && toNumber(r[5],0) <= toNumber(r[4],0); });

  var rows = lowRows.map(function(r) {
    var stock=toNumber(r[5],0), reorder=toNumber(r[4],0), deficit=Math.max(0,reorder-stock);
    var cost=toNumber(costMap[String(r[0]||"")],0);
    var risk=roundTo2(deficit*cost);
    return [String(r[1]||""), String(r[2]||""), stock, reorder, deficit, String(r[3]||""), cost, risk, toNumber(r[5],0)===0?"Out of Stock":"Low Stock"];
  });
  rows.sort(function(a,b){ return b[4]-a[4]; });

  var totalRisk = roundTo2(rows.reduce(function(s,r){ return s+r[7]; }, 0));

  return {
    title: "Low Stock Report",
    kpis: [
      { label: "Low Stock Items",   value: rows.filter(function(r){return r[8]==="Low Stock";}).length, type: "count", highlight: "amber" },
      { label: "Out of Stock",      value: rows.filter(function(r){return r[8]==="Out of Stock";}).length, type: "count", highlight: "red" },
      { label: "Total Deficit Units", value: rows.reduce(function(s,r){return s+r[4];},0), type: "count" },
      { label: "Est. Value at Risk",  value: totalRisk, type: "currency" },
    ],
    columns : ["Item Name", "Category", "Current Stock", "Reorder Level", "Deficit", "UOM", "Last Unit Cost (PKR)", "Est. Reorder Value (PKR)", "Condition"],
    rowTypes: ["text", "text", "number", "number", "number-red", "text", "currency", "currency", "badge-stock"],
    rows    : rows,
    totalsRow: [null, null, null, null, rows.reduce(function(s,r){return s+r[4];},0), null, null, totalRisk, null],
  };
}

// ── 20. Stock Movement ───────────────────────────────────────────────────────
function _rptStockMovement(p) {
  var sinRows  = _filteredRows(SHEETS.STOCK_IN,  1, p.from, p.to);
  var soutRows = _filteredRows(SHEETS.STOCK_OUT, 1, p.from, p.to);
  var totalIn  = _sumCol(sinRows,  5);
  var totalOut = _sumCol(soutRows, 5);
  var totalInVal = roundTo2(_sumCol(sinRows, 7));

  var rows = [];
  sinRows.forEach(function(r) {
    rows.push([r[1]?formatDate(r[1]):"", String(r[3]||""), String(r[4]||""), toNumber(r[5],0), roundTo2(toNumber(r[7],0)), 0, "", String(r[8]||"")]);
  });
  soutRows.forEach(function(r) {
    rows.push([r[1]?formatDate(r[1]):"", String(r[3]||""), String(r[4]||""), 0, 0, toNumber(r[5],0), String(r[6]||""), String(r[7]||"")]);
  });
  rows.sort(function(a,b){ return (b[0]||"").localeCompare(a[0]||""); });

  return {
    title: "Stock Movement Report",
    kpis: [
      { label: "Total Stock In",   value: totalIn,    type: "count" },
      { label: "Stock In Value",   value: totalInVal, type: "currency" },
      { label: "Total Stock Out",  value: totalOut,   type: "count" },
      { label: "Transactions",     value: sinRows.length + soutRows.length, type: "count" },
    ],
    columns : ["Date", "Item", "Category", "Qty In", "Value In (PKR)", "Qty Out", "Purpose", "Vendor / Dept"],
    rowTypes: ["date", "text", "text", "number", "currency", "number", "text", "text"],
    rows    : rows,
    totalsRow: [null, null, null, totalIn, totalInVal, totalOut, null, null],
  };
}

// ── 21. Inventory Valuation ──────────────────────────────────────────────────
function _rptInventoryValuation(p) {
  var invRows = getSheetData(SHEETS.INVENTORY_ITEMS).filter(function(r){ return trimStr(r[0]) !== ""; });
  var sinRows = getSheetData(SHEETS.STOCK_IN).filter(function(r){ return trimStr(r[0]) !== ""; });
  var costMap = {};
  sinRows.forEach(function(r){ var id=String(r[2]||""); var c=toNumber(r[6],0); if(id&&c>0) costMap[id]=c; });

  var rows = invRows.filter(function(r){ return String(r[6]) !== "Inactive"; }).map(function(r) {
    var stock=toNumber(r[5],0), cost=toNumber(costMap[String(r[0]||"")],0), val=roundTo2(stock*cost);
    return [String(r[1]||""), String(r[2]||""), stock, String(r[3]||""), cost, val, String(r[6]||"")];
  });
  rows.sort(function(a,b){ return b[5]-a[5]; });

  var totalVal = roundTo2(rows.reduce(function(s,r){ return s+r[5]; }, 0));
  var cats = {};
  rows.forEach(function(r){ cats[r[1]] = 1; });

  return {
    title: "Inventory Valuation Report",
    kpis: [
      { label: "Total Stock Value", value: totalVal,           type: "currency" },
      { label: "Active Items",      value: rows.length,        type: "count" },
      { label: "Categories",        value: Object.keys(cats).length, type: "count" },
      { label: "Avg Value/Item",    value: rows.length > 0 ? roundTo2(totalVal/rows.length) : 0, type: "currency" },
    ],
    columns : ["Item Name", "Category", "Current Stock", "UOM", "Unit Cost (PKR)", "Total Value (PKR)", "Status"],
    rowTypes: ["text", "text", "number", "text", "currency", "currency", "badge"],
    rows    : rows,
    totalsRow: [null, null, null, null, null, totalVal, null],
  };
}


// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function _filteredRows(sheetName, dateCol, from, to) {
  try {
    return getSheetData(sheetName).filter(function(r) {
      return trimStr(r[0]) !== "" && _inDateRange(r[dateCol], from, to);
    });
  } catch(e) { return []; }
}

function _inDateRange(cellValue, from, to) {
  if (!cellValue) return false;
  try {
    var d = formatDate(cellValue);
    return (!from || d >= from) && (!to || d <= to);
  } catch(e) { return false; }
}

function _sumCol(rows, col) {
  return roundTo2(rows.reduce(function(s, r) { return s + toNumber(r[col], 0); }, 0));
}

function _groupByCol(rows, keyCol, valCol) {
  var result = {};
  rows.forEach(function(r) {
    var k = String(r[keyCol] || "Other");
    result[k] = roundTo2((result[k] || 0) + toNumber(r[valCol], 0));
  });
  return result;
}

function _groupByColCount(rows, keyCol) {
  var result = {};
  rows.forEach(function(r) {
    var k = String(r[keyCol] || "Unknown");
    result[k] = (result[k] || 0) + 1;
  });
  return result;
}

function _rPad(n) {
  return n < 10 ? "0" + n : String(n);
}
