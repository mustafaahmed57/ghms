// =============================================================================
// DASHBOARD MODULE — Dashboard.gs
// =============================================================================
// Returns a comprehensive single-round-trip payload for the executive
// analytics dashboard: KPIs, trend data, occupancy, financial summary,
// alerts, cash flow, inventory analytics, and recent activities.
// =============================================================================

function getDashboardData() {
  try {
    var t0 = new Date().getTime();
    var cached = _cGet('dashboard');
    if (cached) { Logger.log('[getDashboardData] cache hit'); return successResponse(cached); }

    var today    = formatDate(now());
    var ym       = today.substring(0, 7); // "yyyy-MM"
    var thisYear = today.substring(0, 4); // "yyyy"

    // ── ROOMS ────────────────────────────────────────────────────────────────
    var roomRows = getSheetData(SHEETS.ROOMS).filter(function(r) { return trimStr(r[0]) !== ""; });
    var rooms    = { total: roomRows.length, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 };
    var roomTypeMap = {}; // roomNumber → roomType
    roomRows.forEach(function(r) {
      var s = String(r[6] || "");
      if      (s === ROOM_STATUS.AVAILABLE)   rooms.available++;
      else if (s === ROOM_STATUS.OCCUPIED)    rooms.occupied++;
      else if (s === ROOM_STATUS.RESERVED)    rooms.reserved++;
      else if (s === ROOM_STATUS.CLEANING)    rooms.cleaning++;
      else if (s === ROOM_STATUS.MAINTENANCE) rooms.maintenance++;
      roomTypeMap[String(r[1])] = String(r[2] || "Other");
    });

    // ── BOOKINGS ─────────────────────────────────────────────────────────────
    var bkRows = getSheetData(SHEETS.BOOKINGS).filter(function(r) { return trimStr(r[0]) !== ""; });

    var recentBookings = bkRows
      .slice()
      .sort(function(a, b) { return String(b[18] || "").localeCompare(String(a[18] || "")); })
      .slice(0, 10)
      .map(function(r) {
        return {
          bookingId  : String(r[0]),
          guestName  : String(r[2] || ""),
          roomNumber : String(r[4] || ""),
          checkIn    : r[5]  ? formatDate(r[5])  : "",
          checkOut   : r[6]  ? formatDate(r[6])  : "",
          status     : String(r[14] || ""),
          netAmount  : roundTo2(toNumber(r[13], 0)),
          advancePaid: roundTo2(toNumber(r[9],  0)),
        };
      });

    var todayCheckIns    = bkRows.filter(function(r) { return r[5]  ? formatDate(r[5])  === today : false; }).length;
    var todayCheckOuts   = bkRows.filter(function(r) { return r[6]  ? formatDate(r[6])  === today : false; }).length;
    var newBookingsToday = bkRows.filter(function(r) { return r[18] ? formatDate(r[18]) === today : false; }).length;
    var pendingPayments  = bkRows.filter(function(r) {
      var st  = String(r[14] || "");
      var net = toNumber(r[13], 0);
      var adv = toNumber(r[9],  0);
      return (st === BOOKING_STATUS.CONFIRMED || st === BOOKING_STATUS.CHECKED_IN) && net > adv;
    }).length;

    // Upcoming confirmed check-ins in next 7 days
    var nowMs  = now().getTime();
    var day7Ms = 7 * 24 * 3600 * 1000;
    var upcoming = bkRows.filter(function(r) {
      if (!r[5] || String(r[14]) !== BOOKING_STATUS.CONFIRMED) return false;
      var diff = new Date(r[5]).getTime() - nowMs;
      return diff > 0 && diff <= day7Ms;
    }).length;

    // Room type revenue breakdown (month, from booking NetAmount)
    var typeRevMap = {};
    bkRows.forEach(function(r) {
      if (!r[18] || !formatDate(r[18]).startsWith(ym)) return;
      var rt = roomTypeMap[String(r[4] || "")] || "Other";
      typeRevMap[rt] = (typeRevMap[rt] || 0) + toNumber(r[13], 0);
    });
    var pieLabels = Object.keys(typeRevMap);
    var pieValues = pieLabels.map(function(k) { return roundTo2(typeRevMap[k]); });

    // ── ROOM INCOME ──────────────────────────────────────────────────────────
    // Columns: 0=IncomeID,1=BookingID,2=RoomID,3=GuestID,4=Category,5=Amount,8=IncomeDate
    var riRows      = getSheetData(SHEETS.ROOM_INCOME).filter(function(r) { return trimStr(r[0]) !== ""; });
    var monthRI     = _sumByPeriod(riRows, 8, 5, ym);
    var yearRI      = _sumByPeriod(riRows, 8, 5, thisYear);
    var todayRI     = _sumByPeriod(riRows, 8, 5, today);

    // ── ROOM EXPENSE ─────────────────────────────────────────────────────────
    // Columns: 0=ExpenseID,1=RoomID,2=Category,3=Amount,5=ExpenseDate
    var reRows      = getSheetData(SHEETS.ROOM_EXPENSE).filter(function(r) { return trimStr(r[0]) !== ""; });
    var monthRE     = _sumByPeriod(reRows, 5, 3, ym);
    var yearRE      = _sumByPeriod(reRows, 5, 3, thisYear);
    var todayRE     = _sumByPeriod(reRows, 5, 3, today);

    // ── KITCHEN INCOME ───────────────────────────────────────────────────────
    // Columns: 0=IncomeID,1=BookingID,2=GuestID,3=Category,4=Items,5=Amount,7=IncomeDate
    var kiRows      = getSheetData(SHEETS.KITCHEN_INCOME).filter(function(r) { return trimStr(r[0]) !== ""; });
    var monthKI     = _sumByPeriod(kiRows, 7, 5, ym);
    var yearKI      = _sumByPeriod(kiRows, 7, 5, thisYear);
    var todayKI     = _sumByPeriod(kiRows, 7, 5, today);

    // ── KITCHEN EXPENSE ──────────────────────────────────────────────────────
    // Columns: 0=ExpenseID,1=Category,2=Items,3=Amount,5=ExpenseDate
    var keRows      = getSheetData(SHEETS.KITCHEN_EXPENSE).filter(function(r) { return trimStr(r[0]) !== ""; });
    var monthKE     = _sumByPeriod(keRows, 5, 3, ym);
    var yearKE      = _sumByPeriod(keRows, 5, 3, thisYear);
    var todayKE     = _sumByPeriod(keRows, 5, 3, today);

    // ── PAYMENTS ─────────────────────────────────────────────────────────────
    var payRows   = getSheetData(SHEETS.PAYMENTS).filter(function(r) { return trimStr(r[0]) !== ""; });
    var nonRefund = payRows.filter(function(r) { return String(r[6] || "") !== PAYMENT_TYPES.REFUND; });

    // Week start (Monday of current week)
    var ws = new Date(now()); ws.setHours(0, 0, 0, 0);
    var wd = ws.getDay(); ws.setDate(ws.getDate() - (wd === 0 ? 6 : wd - 1));
    var weekStartStr = formatDate(ws);

    var todayPayRev = nonRefund.filter(function(r) { return r[8] ? formatDate(r[8]) === today        : false; }).reduce(function(s,r){ return s+toNumber(r[4],0); }, 0);
    var weekPayRev  = nonRefund.filter(function(r) { return r[8] ? formatDate(r[8]) >= weekStartStr  : false; }).reduce(function(s,r){ return s+toNumber(r[4],0); }, 0);
    var monthPayRev = nonRefund.filter(function(r) { return r[8] ? formatDate(r[8]).startsWith(ym)   : false; }).reduce(function(s,r){ return s+toNumber(r[4],0); }, 0);
    var yearPayRev  = nonRefund.filter(function(r) { return r[8] ? formatDate(r[8]).startsWith(thisYear) : false; }).reduce(function(s,r){ return s+toNumber(r[4],0); }, 0);

    // ── LEDGER ───────────────────────────────────────────────────────────────
    // Columns: 0=LedgerID,1=EntryDate,2=EntryType,7=Debit,8=Credit,9=Balance
    var ledgerRows = getSheetData(SHEETS.LEDGER).filter(function(r) { return trimStr(r[0]) !== ""; });
    var cashBalance = ledgerRows.length > 0 ? toNumber(ledgerRows[ledgerRows.length - 1][9], 0) : 0;
    var monthLedger = ledgerRows.filter(function(r) { return r[1] ? formatDate(r[1]).startsWith(ym) : false; });
    var monthCashIn  = monthLedger.filter(function(r){ return String(r[2]) === LEDGER_TYPES.INCOME;  }).reduce(function(s,r){ return s+toNumber(r[8],0); }, 0);
    var monthCashOut = monthLedger.filter(function(r){ return String(r[2]) === LEDGER_TYPES.EXPENSE; }).reduce(function(s,r){ return s+toNumber(r[7],0); }, 0);

    // ── INVENTORY ────────────────────────────────────────────────────────────
    var invRows  = getSheetData(SHEETS.INVENTORY_ITEMS).filter(function(r) { return trimStr(r[0]) !== ""; });
    var invTotal = invRows.filter(function(r) { return String(r[6]) === "Active"; }).length;
    var invLow   = invRows.filter(function(r) {
      return String(r[6]) !== "Inactive" && toNumber(r[5], 0) > 0 && toNumber(r[5], 0) <= toNumber(r[4], 0);
    }).length;
    var invOut   = invRows.filter(function(r) {
      return String(r[6]) !== "Inactive" && toNumber(r[5], 0) === 0;
    }).length;

    // Inventory value = currentStock × latest unit cost per item (from Stock_In)
    var sinRows     = getSheetData(SHEETS.STOCK_IN).filter(function(r) { return trimStr(r[0]) !== ""; });
    var itemCostMap = {};
    sinRows.forEach(function(r) {
      var itemId = String(r[2] || "");
      var cost   = toNumber(r[6], 0);
      if (itemId && cost > 0) itemCostMap[itemId] = cost; // last row wins (append-ordered)
    });
    var invValue = roundTo2(invRows.reduce(function(s, r) {
      return s + toNumber(r[5], 0) * (itemCostMap[String(r[0] || "")] || 0);
    }, 0));

    // ── TREND DATA (last 6 months) ───────────────────────────────────────────
    var trendLabels = [], trendRI = [], trendKI = [], trendRE = [], trendKE = [];
    for (var i = 5; i >= 0; i--) {
      var dm = new Date(now()); dm.setDate(1); dm.setMonth(dm.getMonth() - i);
      var mo = Utilities.formatDate(dm, CONFIG.TIMEZONE, "yyyy-MM");
      var lb = Utilities.formatDate(dm, CONFIG.TIMEZONE, "MMM yy");
      trendLabels.push(lb);
      trendRI.push(_sumByPeriod(riRows, 8, 5, mo));
      trendKI.push(_sumByPeriod(kiRows, 7, 5, mo));
      trendRE.push(_sumByPeriod(reRows, 5, 3, mo));
      trendKE.push(_sumByPeriod(keRows, 5, 3, mo));
    }

    // ── RECENT ACTIVITIES ────────────────────────────────────────────────────
    var acts = [];
    bkRows.slice()
      .sort(function(a,b){ return String(b[18]||"").localeCompare(String(a[18]||"")); })
      .slice(0,5)
      .forEach(function(r){ acts.push({ type:'booking', desc:String(r[2]||'')+' — Room '+String(r[4]||''), sub:String(r[0]), time:r[18]?formatDate(r[18]):'' }); });

    bkRows.filter(function(r){ return r[16]; })
      .sort(function(a,b){ return String(b[16]).localeCompare(String(a[16])); })
      .slice(0,5)
      .forEach(function(r){ acts.push({ type:'checkin', desc:String(r[2]||'')+' checked in', sub:'Room '+String(r[4]||''), time:r[16]?formatDate(r[16]):'' }); });

    bkRows.filter(function(r){ return r[17]; })
      .sort(function(a,b){ return String(b[17]).localeCompare(String(a[17])); })
      .slice(0,5)
      .forEach(function(r){ acts.push({ type:'checkout', desc:String(r[2]||'')+' checked out', sub:'Room '+String(r[4]||''), time:r[17]?formatDate(r[17]):'' }); });

    payRows.slice()
      .sort(function(a,b){ return String(b[8]||"").localeCompare(String(a[8]||"")); })
      .slice(0,5)
      .forEach(function(r){ acts.push({ type:'payment', desc:'PKR '+toNumber(r[4],0).toLocaleString()+' received', sub:String(r[2]||''), time:r[8]?formatDate(r[8]):'' }); });

    sinRows.slice()
      .sort(function(a,b){ return String(b[1]||"").localeCompare(String(a[1]||"")); })
      .slice(0,5)
      .forEach(function(r){ acts.push({ type:'inventory', desc:String(r[3]||'')+' stocked in', sub:toNumber(r[5],0)+' '+String(r[4]||''), time:r[1]?formatDate(r[1]):'' }); });

    acts.sort(function(a,b){ return String(b.time).localeCompare(String(a.time)); });
    acts = acts.slice(0, 15);

    // ── DERIVED KPIs ─────────────────────────────────────────────────────────
    var totalMonthRevenue = roundTo2(monthRI + monthKI);
    var totalMonthExpense = roundTo2(monthRE + monthKE);
    var netProfit         = roundTo2(totalMonthRevenue - totalMonthExpense);
    var occupancyRate     = rooms.total > 0 ? roundTo2((rooms.occupied + rooms.reserved) / rooms.total * 100) : 0;

    // ── BILLING STATS ────────────────────────────────────────────────────────
    var invRows    = getSheetData(SHEETS.INVOICES).filter(function(r) { return trimStr(r[0]) !== ""; });
    var activeInv  = invRows.filter(function(r) { return String(r[17]) !== INVOICE_STATUS.CANCELLED; });
    var billingTotal     = activeInv.length;
    var billingPaid      = activeInv.filter(function(r) { return String(r[17]) === INVOICE_STATUS.PAID; }).length;
    var billingUnpaid    = roundTo2(activeInv.reduce(function(s, r) { return s + toNumber(r[16], 0); }, 0));
    var billingToday     = roundTo2(activeInv
      .filter(function(r) { return r[7] ? formatDate(r[7]) === today : false; })
      .reduce(function(s, r) { return s + toNumber(r[14], 0); }, 0));

    var result = {
      rooms          : rooms,
      recentBookings : recentBookings,
      snapshot: {
        todayCheckIns   : todayCheckIns,
        todayCheckOuts  : todayCheckOuts,
        newBookingsToday: newBookingsToday,
        pendingPayments : pendingPayments,
        maintenanceRooms: rooms.maintenance + rooms.cleaning,
      },
      kpis: {
        monthRevenue  : totalMonthRevenue,
        netProfit     : netProfit,
        occupancyRate : occupancyRate,
        pendingPayments: pendingPayments,
        cashBalance   : roundTo2(cashBalance),
        inventoryValue: invValue,
      },
      finance: {
        todayRevenue  : roundTo2(todayRI + todayKI),
        weekRevenue   : roundTo2(weekPayRev),
        monthRevenue  : roundTo2(monthPayRev),
        yearRevenue   : roundTo2(yearPayRev),
        roomIncome    : roundTo2(monthRI),
        kitchenIncome : roundTo2(monthKI),
        roomExpense   : roundTo2(monthRE),
        kitchenExpense: roundTo2(monthKE),
      },
      cashflow: {
        cashIn  : roundTo2(monthCashIn),
        cashOut : roundTo2(monthCashOut),
        balance : roundTo2(cashBalance),
      },
      trend: {
        labels        : trendLabels,
        roomIncome    : trendRI,
        kitchenIncome : trendKI,
        roomExpense   : trendRE,
        kitchenExpense: trendKE,
      },
      roomTypePie: {
        labels: pieLabels,
        values: pieValues,
      },
      inventory: {
        total     : invTotal,
        lowStock  : invLow,
        outOfStock: invOut,
        stockValue: invValue,
      },
      alerts: {
        pendingPayments : pendingPayments,
        checkoutsToday  : todayCheckOuts,
        lowStockItems   : invLow + invOut,
        maintenanceRooms: rooms.maintenance,
        upcomingBookings: upcoming,
      },
      activities: acts,
      billing: {
        totalInvoices: billingTotal,
        paidCount    : billingPaid,
        unpaidBalance: billingUnpaid,
        todayBilling : billingToday,
      },
    };
    _cSet('dashboard', result, 60);
    Logger.log('[getDashboardData] ' + (new Date().getTime() - t0) + 'ms');
    return successResponse(result);
  } catch(e) {
    return handleError(e, "getDashboardData");
  }
}

// Sum column valIdx for rows where column dateIdx starts with period prefix
function _sumByPeriod(rows, dateIdx, valIdx, period) {
  return roundTo2(rows
    .filter(function(r) {
      var dv = r[dateIdx]; if (!dv) return false;
      try { return formatDate(dv).startsWith(period); } catch(e) { return false; }
    })
    .reduce(function(s, r) { return s + toNumber(r[valIdx], 0); }, 0));
}
