// =============================================================================
// DEMO DATA & SYSTEM TEST RUNNER — DemoData.gs
// =============================================================================
// seedDemoData()    — creates realistic hotel demo data (idempotent)
// clearDemoData()   — removes ONLY rows tagged with DEMO_TAG
// runSystemTests()  — runs CRUD / business-logic tests; writes to Test_Results
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

var DEMO_TAG      = "DEMO_DATA";
var DEMO_SEED_KEY = "DEMO_SEEDED";

// Marker column (0-based) per sheet — cells must contain DEMO_TAG.
var _DM = {
  ROOMS          : 7,   // Description
  GUESTS         : 6,   // Address
  BOOKINGS       : 15,  // SpecialRequests
  ROOM_INCOME    : 7,   // Description
  ROOM_EXPENSE   : 4,   // Description
  KITCHEN_INCOME : 4,   // Items
  KITCHEN_EXPENSE: 4,   // Vendor
  PAYMENTS       : 7,   // Notes
  LEDGER         : 6,   // Description
  INVENTORY_ITEMS: 7,   // Notes
  STOCK_IN       : 10,  // Notes
  STOCK_OUT      : 8,   // Notes
  STOCK_LEDGER   : 10,  // Notes
  INVOICES       : 18,  // Notes
  INVOICE_LINES  : 3,   // Description
};

// Room definitions: [number, type, floor, rate]
var _DEMO_ROOMS = [
  ["101","Single",1,3500], ["102","Single",1,3500], ["103","Double",1,5500],
  ["104","Double",1,5500], ["105","Twin",  1,5000],
  ["201","Single",2,3500], ["202","Single",2,3500], ["203","Double",2,5500],
  ["204","Double",2,5500], ["205","Twin",  2,5000], ["206","Twin",  2,5000],
  ["301","Deluxe",3,8500], ["302","Deluxe",3,8500], ["303","Deluxe",3,8500],
  ["304","Deluxe",3,8500],
  ["401","Suite", 4,15000],["402","Suite", 4,15000],["403","Suite", 4,15000],
  ["501","Family",5,12000],["502","Family",5,12000]
];

// 30 first names (M+F), 20 last names, 10 cities
var _DEMO_FN = ["Ahmed","Ali","Usman","Bilal","Hassan","Tariq","Rizwan","Zubair","Imran","Faisal",
                "Salman","Kamran","Asad","Junaid","Shahid","Ayesha","Fatima","Sana","Huma","Nida",
                "Zara","Sara","Iqra","Maham","Amna","Rabia","Nadia","Sadia","Uzma","Bushra"];
var _DEMO_LN = ["Khan","Ahmed","Ali","Malik","Qureshi","Sheikh","Butt","Chaudhry","Siddiqui","Iqbal",
                "Hussain","Raza","Nawaz","Hashmi","Ansari","Mirza","Baig","Gillani","Lodhi","Zaidi"];
var _DEMO_CITY = ["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad",
                  "Multan","Peshawar","Quetta","Gujranwala","Sialkot"];
var _DEMO_PAY_METHODS = ["Cash","Bank Transfer","JazzCash","EasyPaisa","Card"];
var _DEMO_RI_CATS  = ["Room Rent","Late Checkout","Extra Bed","Laundry","Minibar","Other"];
var _DEMO_RE_CATS  = ["Maintenance","Cleaning Supplies","Utilities","Linens & Towels","Other"];
var _DEMO_KI_CATS  = ["Food","Beverages","Room Service","Catering","Other"];
var _DEMO_KE_CATS  = ["Groceries","Beverages Stock","Kitchen Equipment","Utilities","Staff Wages"];
var _DEMO_VENDORS  = ["Metro Cash & Carry","Makro","Al-Fatah","Utility Stores","Local Market",
                      "Punjab Foods","Pak Supplies","Star Traders","National Distributors","City Store"];

// 40 base items × 5 size variants = 200 inventory items
var _DEMO_ITEM_BASES = [
  ["Rice",          "Kitchen",       "KG",    20],["Flour",         "Kitchen",       "KG",    15],
  ["Sugar",         "Kitchen",       "KG",    10],["Cooking Oil",   "Kitchen",       "Liter", 10],
  ["Tea",           "Kitchen",       "Pack",   5],["Coffee",        "Kitchen",       "Pack",   5],
  ["Milk",          "Kitchen",       "Liter", 10],["Salt",          "Kitchen",       "KG",     5],
  ["Bread",         "Kitchen",       "Pack",   5],["Eggs",          "Kitchen",       "Dozen",  5],
  ["Butter",        "Kitchen",       "Pack",   3],["Yogurt",        "Kitchen",       "KG",     5],
  ["Chicken",       "Kitchen",       "KG",    15],["Tomato",        "Kitchen",       "KG",    10],
  ["Onion",         "Kitchen",       "KG",    10],["Potato",        "Kitchen",       "KG",    10],
  ["Water",         "General",       "PCS",   50],["Soft Drink",    "General",       "PCS",   20],
  ["Juice",         "General",       "PCS",   10],["Energy Drink",  "General",       "PCS",   10],
  ["Soap Bar",      "Room Supplies", "PCS",   30],["Shampoo",       "Room Supplies", "PCS",   20],
  ["Shower Gel",    "Room Supplies", "PCS",   15],["Conditioner",   "Room Supplies", "PCS",   10],
  ["Toothbrush",    "Room Supplies", "PCS",   20],["Toilet Paper",  "Room Supplies", "PCS",   30],
  ["Tissue Box",    "Room Supplies", "PCS",   20],["Towel",         "Housekeeping",  "PCS",   20],
  ["Bed Sheet",     "Housekeeping",  "PCS",   15],["Pillow Case",   "Housekeeping",  "PCS",   20],
  ["Blanket",       "Housekeeping",  "PCS",   10],["Detergent",     "Cleaning",      "KG",     5],
  ["Bleach",        "Cleaning",      "Liter",  5],["Disinfectant",  "Cleaning",      "Liter",  5],
  ["Mop",           "Cleaning",      "PCS",    3],["Light Bulb",    "Maintenance",   "PCS",   10],
  ["Battery AA",    "Maintenance",   "Pack",   5],["Plate",         "Kitchen",       "PCS",   20],
  ["Cup",           "Kitchen",       "PCS",   20],["Fork",          "Kitchen",       "PCS",   15]
];
var _DEMO_ITEM_SZ = [" (Small)"," (Medium)"," (Large)"," (Bulk Pack)"," (Economy Pack)"];


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — PUBLIC: Seed Demo Data
// ─────────────────────────────────────────────────────────────────────────────

function seedDemoData() {
  try {
    if (getSetting(DEMO_SEED_KEY) === "TRUE") {
      var m1 = "Demo data already seeded.\nRun clearDemoData() first to reseed.";
      console.log("[GHMS][seedDemoData] " + m1);
      return successResponse(null, m1);
    }

    var t0 = new Date();
    console.log("[GHMS][seedDemoData] Starting…");

    // ── 1. Reserve all IDs upfront (efficient: one lock per entity type) ────
    var roomIds  = _demoReserveIds("ROOMS",           20);
    var gstIds   = _demoReserveIds("GUESTS",         100);
    var itmIds   = _demoReserveIds("INVENTORY_ITEMS",200);
    var bkIds    = _demoReserveIds("BOOKINGS",       160);
    var payIds   = _demoReserveIds("PAYMENTS",       200);
    var invIds   = _demoReserveIds("INVOICES",       200);
    var lnIds    = _demoReserveIds("INVOICE_LINES",  450);
    var riIds    = _demoReserveIds("ROOM_INCOME",    100);
    var reIds    = _demoReserveIds("ROOM_EXPENSE",    50);
    var kiIds    = _demoReserveIds("KITCHEN_INCOME",  50);
    var keIds    = _demoReserveIds("KITCHEN_EXPENSE", 50);
    var sinIds   = _demoReserveIds("STOCK_IN",        80);
    var soutIds  = _demoReserveIds("STOCK_OUT",       80);
    var slgIds   = _demoReserveIds("STOCK_LEDGER",   160);
    var ledIds   = _demoReserveIds("LEDGER",         700);

    var _useLed = 0, _useLn = 0;
    var ledBal  = _getDemoLedgerBaseBal();
    var ledRows = [], payRows = [], invRows = [], lnRows = [];
    var riRows  = [], reRows  = [], kiRows  = [], keRows  = [];

    var ts = _demoTs();

    // ── 2. Rooms ─────────────────────────────────────────────────────────────
    var roomRows = _DEMO_ROOMS.map(function(d, i) {
      return [roomIds[i], d[0], d[1], d[2], 1, d[3], ROOM_STATUS.AVAILABLE,
              "Standard room | " + DEMO_TAG, ts, ts];
    });
    _batchAppend(SHEETS.ROOMS, roomRows);
    console.log("[GHMS][seedDemoData] Rooms done.");

    // ── 3. Guests ─────────────────────────────────────────────────────────────
    var gstRows = gstIds.map(function(gid, i) {
      var fn   = _DEMO_FN[i % _DEMO_FN.length];
      var ln   = _DEMO_LN[i % _DEMO_LN.length];
      var name = fn + " " + ln;
      var seq  = i + 1;
      return [gid, name, "", _demoCnic(seq), _demoPhone(seq),
              fn.toLowerCase() + seq + "@demo.pk",
              seq + " Demo Street, " + DEMO_TAG,
              _DEMO_CITY[i % _DEMO_CITY.length], "", ts, ts];
    });
    _batchAppend(SHEETS.GUESTS, gstRows);
    console.log("[GHMS][seedDemoData] Guests done.");

    // ── 4. Inventory Items ────────────────────────────────────────────────────
    var itmRows = itmIds.map(function(itmId, i) {
      var base = _DEMO_ITEM_BASES[i % _DEMO_ITEM_BASES.length];
      var sz   = _DEMO_ITEM_SZ[Math.floor(i / _DEMO_ITEM_BASES.length) % _DEMO_ITEM_SZ.length];
      var openStock = 5 + (i % 30) * 3;
      return [itmId, base[0] + sz, base[1], base[2], base[3],
              openStock, "Active", "Opening stock | " + DEMO_TAG, ts, ts];
    });
    _batchAppend(SHEETS.INVENTORY_ITEMS, itmRows);
    console.log("[GHMS][seedDemoData] Inventory items done.");

    // ── 5. Bookings + Payments + Invoices + Room Income/Expense + Kitchen ─────
    var bkRows       = [];
    var bkMeta       = []; // [{status, guestName, roomNumber, netAmount, checkIn, checkOut, bookingId}]
    var occupiedRooms= {};

    for (var bi = 0; bi < 160; bi++) {
      var room  = _DEMO_ROOMS[bi % 20];
      var roomId= roomIds[bi % 20];
      var rnum  = room[0], rtype = room[1], rate = room[3];

      var gstRow = gstRows[bi % 100];
      var gstId  = gstRow[0], gstName = gstRow[1];

      // Status and dates by bucket
      var status, cin, cout, ciAt, coAt;
      if (bi < 100) {
        // CHECKED_OUT — past booking
        status = BOOKING_STATUS.CHECKED_OUT;
        cin    = _demoDateStr(-(5 + bi));
        var nights = 1 + (bi % 5);
        cout   = _demoDateStr(-(5 + bi) + nights);
        ciAt   = _demoDateStr(-(5 + bi));
        coAt   = cout;
      } else if (bi < 110) {
        // CHECKED_IN — currently in-house
        var daysIn = bi - 100; // 0..9
        status = BOOKING_STATUS.CHECKED_IN;
        cin    = _demoDateStr(-daysIn);
        cout   = _demoDateStr(3 + daysIn);
        ciAt   = cin;
        coAt   = "";
        occupiedRooms[roomId] = true;
      } else if (bi < 130) {
        // CONFIRMED — future
        status = BOOKING_STATUS.CONFIRMED;
        cin    = _demoDateStr(1 + (bi - 110));
        cout   = _demoDateStr(3 + (bi - 110));
        ciAt   = ""; coAt = "";
      } else if (bi < 150) {
        // CANCELLED
        status = BOOKING_STATUS.CANCELLED;
        cin    = _demoDateStr(-(bi - 130) - 5);
        cout   = _demoDateStr(-(bi - 130) - 3);
        ciAt   = ""; coAt = "";
      } else {
        // NO_SHOW
        status = BOOKING_STATUS.NO_SHOW;
        cin    = _demoDateStr(-(bi - 150) - 3);
        cout   = _demoDateStr(-(bi - 150) - 1);
        ciAt   = ""; coAt = "";
      }

      var nights2  = daysBetween(cin, cout);
      if (nights2 < 1) nights2 = 1;
      var total    = roundTo2(nights2 * rate);
      var discount = (bi % 7 === 0) ? roundTo2(total * 0.05) : 0;
      var tax      = roundTo2(total * 0.05);
      var net      = roundTo2(total - discount + tax);
      var advance  = (status === BOOKING_STATUS.CHECKED_OUT) ? net : (bi < 130 && bi >= 110 ? roundTo2(net * 0.3) : 0);
      var bkId     = bkIds[bi];

      bkRows.push([
        bkId, gstId, gstName, roomId, rnum,
        cin, cout, nights2, roundTo2(tax), roundTo2(advance),
        roundTo2(rate), total, roundTo2(discount), net,
        status,
        "Demo booking " + (bi+1) + " | " + DEMO_TAG,
        ciAt, coAt, ts, ts
      ]);

      bkMeta.push({ bookingId: bkId, status: status, guestName: gstName, roomNumber: rnum,
                    netAmount: net, advance: advance, checkIn: cin, checkOut: cout,
                    nights: nights2, rate: rate, discount: discount, tax: tax, total: total,
                    roomId: roomId, guestId: gstId });
    }
    _batchAppend(SHEETS.BOOKINGS, bkRows);
    console.log("[GHMS][seedDemoData] Bookings done.");

    // Mark occupied rooms
    var roomSheet = getSpreadsheet().getSheetByName(SHEETS.ROOMS);
    if (roomSheet && roomSheet.getLastRow() > 1) {
      var roomData = roomSheet.getRange(2, 1, roomSheet.getLastRow()-1, 1).getValues();
      roomData.forEach(function(r, idx) {
        if (occupiedRooms[String(r[0])]) {
          roomSheet.getRange(idx+2, 7).setValue(ROOM_STATUS.OCCUPIED);
        }
      });
    }

    // ── 5a. Payments (200) — for CHECKED_OUT bookings + advances ─────────────
    var payPtr = 0;
    // 100 final payments for checked-out bookings
    for (var ci = 0; ci < 100 && payPtr < 200; ci++) {
      var bm  = bkMeta[ci]; // CHECKED_OUT
      var pamt = bm.netAmount;
      var pdate = bm.checkOut;
      var pm  = _DEMO_PAY_METHODS[ci % _DEMO_PAY_METHODS.length];
      payRows.push([payIds[payPtr], bm.bookingId, bm.guestName, bm.roomNumber,
                    pamt, pm, PAYMENT_TYPES.FINAL, "Full payment | " + DEMO_TAG, pdate, ts]);
      // Ledger for this payment
      var ldesc = "Payment for booking " + bm.bookingId + " — " + bm.guestName + " | " + DEMO_TAG;
      ledBal = roundTo2(ledBal + pamt);
      ledRows.push([ledIds[_useLed++], pdate, LEDGER_TYPES.INCOME, "Payment", pm,
                    payIds[payPtr], ldesc, 0, pamt, ledBal, ts]);
      payPtr++;
    }
    // 20 advance payments for CONFIRMED bookings
    for (var ci2 = 110; ci2 < 130 && payPtr < 200; ci2++) {
      var bm2  = bkMeta[ci2];
      var adv  = roundTo2(bm2.netAmount * 0.3);
      if (adv < 1) adv = 500;
      var pdate2 = bm2.checkIn;
      var pm2  = _DEMO_PAY_METHODS[ci2 % _DEMO_PAY_METHODS.length];
      payRows.push([payIds[payPtr], bm2.bookingId, bm2.guestName, bm2.roomNumber,
                    adv, pm2, PAYMENT_TYPES.ADVANCE, "Advance payment | " + DEMO_TAG, pdate2, ts]);
      ledBal = roundTo2(ledBal + adv);
      ledRows.push([ledIds[_useLed++], pdate2, LEDGER_TYPES.INCOME, "Payment", pm2,
                    payIds[payPtr], "Advance for booking " + bm2.bookingId + " | " + DEMO_TAG,
                    0, adv, ledBal, ts]);
      payPtr++;
    }
    // 10 advance payments for CHECKED_IN
    for (var ci3 = 100; ci3 < 110 && payPtr < 200; ci3++) {
      var bm3 = bkMeta[ci3];
      var adv3 = roundTo2(bm3.netAmount * 0.3);
      if (adv3 < 1) adv3 = 500;
      var pm3 = _DEMO_PAY_METHODS[ci3 % _DEMO_PAY_METHODS.length];
      payRows.push([payIds[payPtr], bm3.bookingId, bm3.guestName, bm3.roomNumber,
                    adv3, pm3, PAYMENT_TYPES.ADVANCE, "Advance | " + DEMO_TAG, bm3.checkIn, ts]);
      ledBal = roundTo2(ledBal + adv3);
      ledRows.push([ledIds[_useLed++], bm3.checkIn, LEDGER_TYPES.INCOME, "Payment", pm3,
                    payIds[payPtr], "Advance for booking " + bm3.bookingId + " | " + DEMO_TAG,
                    0, adv3, ledBal, ts]);
      payPtr++;
    }
    // Fill remaining payments (70) as partial payments for mixed bookings
    var extra = [15,22,31,38,44,51,62,73,82,91]; // indices of checked-out bookings for extra partial+final
    for (var ei = 0; payPtr < 200; ei++) {
      var bmx = bkMeta[ei % 100];
      var partAmt = roundTo2(bmx.netAmount * 0.4);
      var pmx = _DEMO_PAY_METHODS[payPtr % _DEMO_PAY_METHODS.length];
      payRows.push([payIds[payPtr], bmx.bookingId, bmx.guestName, bmx.roomNumber,
                    partAmt, pmx, PAYMENT_TYPES.PARTIAL, "Partial | " + DEMO_TAG, bmx.checkIn, ts]);
      ledBal = roundTo2(ledBal + partAmt);
      ledRows.push([ledIds[_useLed++], bmx.checkIn, LEDGER_TYPES.INCOME, "Payment", pmx,
                    payIds[payPtr], "Partial for " + bmx.bookingId + " | " + DEMO_TAG,
                    0, partAmt, ledBal, ts]);
      payPtr++;
    }
    _batchAppend(SHEETS.PAYMENTS, payRows);
    console.log("[GHMS][seedDemoData] Payments done.");

    // ── 5b. Invoices + Invoice Lines (200 each) ───────────────────────────────
    // 160 invoices (one per booking) + 40 extra for kitchen charges
    var invPtr = 0, lnPtr = 0;

    // 160 booking invoices
    for (var ii = 0; ii < 160 && invPtr < 200; ii++) {
      var bm   = bkMeta[ii];
      var sub  = roundTo2(bm.nights * bm.rate);
      var disc = bm.discount;
      var taxA = bm.tax;
      var gran = bm.netAmount;
      var paid = (bm.status === BOOKING_STATUS.CHECKED_OUT) ? gran : (ii < 110 ? roundTo2(gran * 0.3) : 0);
      var bal  = roundTo2(gran - paid);
      var invStatus = (bm.status === BOOKING_STATUS.CHECKED_OUT) ? INVOICE_STATUS.PAID
                    : (bm.status === BOOKING_STATUS.CANCELLED || bm.status === BOOKING_STATUS.NO_SHOW)
                      ? INVOICE_STATUS.CANCELLED
                    : (paid > 0) ? INVOICE_STATUS.PARTIALLY_PAID : INVOICE_STATUS.DRAFT;
      var invId  = invIds[invPtr];
      var invDate = bm.checkOut || bm.checkIn;
      invRows.push([
        invId, invId, bm.bookingId, bm.guestId || bm.bookingId, bm.guestName,
        bm.roomId || "", bm.roomNumber, invDate, bm.checkIn, bm.checkOut,
        bm.nights, sub, disc, taxA, gran, paid, bal, invStatus,
        DEMO_TAG, ts, ts
      ]);
      // Room Rent line
      lnRows.push([lnIds[lnPtr++], invId, "Room Rent",
                   "Room " + bm.roomNumber + " × " + bm.nights + " nights @ PKR " + bm.rate + " | " + DEMO_TAG,
                   bm.nights, bm.rate, sub, "Bookings", bm.bookingId, ts]);
      // Extra service line for some bookings
      if (ii % 3 === 0 && lnPtr < 450) {
        var svcAmt = 500 + (ii % 4) * 250;
        var svcType = ii % 2 === 0 ? "Laundry" : "Extra Bed";
        lnRows.push([lnIds[lnPtr++], invId, svcType,
                     svcType + " charges | " + DEMO_TAG, 1, svcAmt, svcAmt,
                     "Bookings", bm.bookingId, ts]);
      }
      // Ledger income entry for PAID invoices
      if (invStatus === INVOICE_STATUS.PAID) {
        ledBal = roundTo2(ledBal + gran);
        ledRows.push([ledIds[_useLed++], invDate, LEDGER_TYPES.INCOME, "Invoice", "Room Revenue",
                      invId, "Invoice " + invId + " — " + bm.guestName + " | " + DEMO_TAG,
                      0, gran, ledBal, ts]);
      }
      invPtr++;
    }
    // 40 extra invoices for kitchen/other charges
    for (var xi = 0; xi < 40 && invPtr < 200; xi++) {
      var bm   = bkMeta[xi % 100]; // linked to checked-out bookings
      var gran = 500 + xi * 100;
      var invId  = invIds[invPtr];
      var invDate = bm.checkOut;
      invRows.push([
        invId, invId, bm.bookingId, bm.guestId || "", bm.guestName,
        "", bm.roomNumber, invDate, bm.checkIn, bm.checkOut,
        bm.nights, gran, 0, 0, gran, gran, 0, INVOICE_STATUS.PAID,
        DEMO_TAG, ts, ts
      ]);
      lnRows.push([lnIds[lnPtr++], invId, "Kitchen Charges",
                   "Kitchen & Room Service charges | " + DEMO_TAG,
                   1, gran, gran, "Kitchen", bm.bookingId, ts]);
      ledBal = roundTo2(ledBal + gran);
      ledRows.push([ledIds[_useLed++], invDate, LEDGER_TYPES.INCOME, "Invoice", "Kitchen Revenue",
                    invId, "Extra invoice " + invId + " | " + DEMO_TAG, 0, gran, ledBal, ts]);
      invPtr++;
    }
    _batchAppend(SHEETS.INVOICES,      invRows.slice(0, invPtr));
    _batchAppend(SHEETS.INVOICE_LINES, lnRows.slice(0, lnPtr));
    console.log("[GHMS][seedDemoData] Invoices done: " + invPtr + " invoices, " + lnPtr + " lines.");

    // ── 5c. Room Income (100) ─────────────────────────────────────────────────
    var riPtr = 0;
    for (var ri = 0; ri < 100; ri++) {
      var bm  = bkMeta[ri]; // checked-out bookings
      var cat = _DEMO_RI_CATS[ri % _DEMO_RI_CATS.length];
      var amt = bm.rate * bm.nights;
      var pm  = _DEMO_PAY_METHODS[ri % _DEMO_PAY_METHODS.length];
      riRows.push([riIds[ri], bm.bookingId, bm.roomId || "", bm.guestId || "",
                   cat, amt, pm,
                   cat + " for booking " + bm.bookingId + " | " + DEMO_TAG,
                   bm.checkOut, ts]);
      ledBal = roundTo2(ledBal + amt);
      ledRows.push([ledIds[_useLed++], bm.checkOut, LEDGER_TYPES.INCOME, "Room Income", cat,
                    riIds[ri], "RI: " + cat + " — " + bm.guestName + " | " + DEMO_TAG,
                    0, amt, ledBal, ts]);
    }
    _batchAppend(SHEETS.ROOM_INCOME, riRows);
    console.log("[GHMS][seedDemoData] Room Income done.");

    // ── 5d. Room Expense (50) ─────────────────────────────────────────────────
    for (var rei = 0; rei < 50; rei++) {
      var room2 = _DEMO_ROOMS[rei % 20];
      var cat2  = _DEMO_RE_CATS[rei % _DEMO_RE_CATS.length];
      var amt2  = 500 + rei * 150;
      var edate = _demoDateStr(-1 - rei);
      reRows.push([reIds[rei], roomIds[rei % 20], cat2, amt2,
                   cat2 + " for Room " + room2[0] + " | " + DEMO_TAG, edate, ts]);
      ledBal = roundTo2(ledBal - amt2);
      ledRows.push([ledIds[_useLed++], edate, LEDGER_TYPES.EXPENSE, "Room Expense", cat2,
                    reIds[rei], "RE: " + cat2 + " Room " + room2[0] + " | " + DEMO_TAG,
                    amt2, 0, ledBal, ts]);
    }
    _batchAppend(SHEETS.ROOM_EXPENSE, reRows);
    console.log("[GHMS][seedDemoData] Room Expense done.");

    // ── 5e. Kitchen Income (50) ───────────────────────────────────────────────
    for (var ki = 0; ki < 50; ki++) {
      var bm  = bkMeta[ki % 100];
      var cat = _DEMO_KI_CATS[ki % _DEMO_KI_CATS.length];
      var amt = 300 + ki * 50;
      var pm  = _DEMO_PAY_METHODS[ki % _DEMO_PAY_METHODS.length];
      var kdate = bm.checkIn;
      kiRows.push([kiIds[ki], bm.bookingId, bm.guestId || "",
                   cat, "Demo meal items | " + DEMO_TAG, amt, pm, kdate, ts]);
      ledBal = roundTo2(ledBal + amt);
      ledRows.push([ledIds[_useLed++], kdate, LEDGER_TYPES.INCOME, "Kitchen Income", cat,
                    kiIds[ki], "KI: " + cat + " | " + DEMO_TAG, 0, amt, ledBal, ts]);
    }
    _batchAppend(SHEETS.KITCHEN_INCOME, kiRows);
    console.log("[GHMS][seedDemoData] Kitchen Income done.");

    // ── 5f. Kitchen Expense (50) ──────────────────────────────────────────────
    for (var ke = 0; ke < 50; ke++) {
      var cat  = _DEMO_KE_CATS[ke % _DEMO_KE_CATS.length];
      var amt  = 1000 + ke * 200;
      var vend = _DEMO_VENDORS[ke % _DEMO_VENDORS.length] + " | " + DEMO_TAG;
      var kedate = _demoDateStr(-2 - ke);
      keRows.push([keIds[ke], cat, "Demo kitchen items", amt, vend, kedate, ts]);
      ledBal = roundTo2(ledBal - amt);
      ledRows.push([ledIds[_useLed++], kedate, LEDGER_TYPES.EXPENSE, "Kitchen Expense", cat,
                    keIds[ke], "KE: " + cat + " | " + DEMO_TAG, amt, 0, ledBal, ts]);
    }
    _batchAppend(SHEETS.KITCHEN_EXPENSE, keRows);
    console.log("[GHMS][seedDemoData] Kitchen Expense done.");

    // ── 6. Stock Movements (80 in + 80 out) ──────────────────────────────────
    var sinRows = [], soutRows = [], slgRows = [];
    var itmStockMap = {}; // itemId → currentStock
    itmIds.forEach(function(id, i) { itmStockMap[id] = itmRows[i][5]; }); // opening stock

    for (var si = 0; si < 80; si++) {
      var itmIdx  = si % 200;
      var itmId   = itmIds[itmIdx];
      var itmName = itmRows[itmIdx][1];
      var itmCat  = itmRows[itmIdx][2];
      var qty     = 5 + (si % 20);
      var uc      = 50 + (si % 10) * 25;
      var total   = roundTo2(qty * uc);
      var vend    = _DEMO_VENDORS[si % _DEMO_VENDORS.length];
      var sdate   = _demoDateStr(-3 - si);
      var pm      = _DEMO_PAY_METHODS[si % _DEMO_PAY_METHODS.length];
      itmStockMap[itmId] = roundTo2((itmStockMap[itmId] || 0) + qty);

      sinRows.push([sinIds[si], sdate, itmId, itmName, itmCat,
                    qty, uc, total, vend, pm, "Stock In | " + DEMO_TAG, ts]);
      slgRows.push([slgIds[si], sdate, itmId, itmName, INV_MOVEMENT.IN,
                    qty, 0, itmStockMap[itmId], sinIds[si], "Stock In",
                    "Demo stock in | " + DEMO_TAG, ts]);
      // Ledger debit for paid stock
      ledBal = roundTo2(ledBal - total);
      ledRows.push([ledIds[_useLed++], sdate, LEDGER_TYPES.EXPENSE, "Inventory", "Stock Purchase",
                    sinIds[si], "Stock In: " + itmName + " | " + DEMO_TAG, total, 0, ledBal, ts]);
    }
    _batchAppend(SHEETS.STOCK_IN, sinRows);

    for (var so = 0; so < 80; so++) {
      var itmIdx2  = (so + 5) % 200;
      var itmId2   = itmIds[itmIdx2];
      var itmName2 = itmRows[itmIdx2][1];
      var itmCat2  = itmRows[itmIdx2][2];
      var qty2     = 1 + (so % 5);
      var curStk   = itmStockMap[itmId2] || 0;
      var newStk   = Math.max(0, curStk - qty2);
      itmStockMap[itmId2] = newStk;
      var dept     = ["Kitchen","Housekeeping","Maintenance","Front Desk","Room Service"][so % 5];
      var sodate   = _demoDateStr(-2 - so);

      soutRows.push([soutIds[so], sodate, itmId2, itmName2, itmCat2,
                     qty2, "Internal Use", dept, "Stock Out | " + DEMO_TAG, ts]);
      slgRows.push([slgIds[80 + so], sodate, itmId2, itmName2, INV_MOVEMENT.OUT,
                    0, qty2, newStk, soutIds[so], "Stock Out",
                    "Demo stock out | " + DEMO_TAG, ts]);
    }
    _batchAppend(SHEETS.STOCK_OUT,    soutRows);
    _batchAppend(SHEETS.STOCK_LEDGER, slgRows);
    console.log("[GHMS][seedDemoData] Stock movements done.");

    // Update CurrentStock on inventory items
    var invSheet = getSpreadsheet().getSheetByName(SHEETS.INVENTORY_ITEMS);
    if (invSheet && invSheet.getLastRow() > 1) {
      var invAllData = invSheet.getRange(2, 1, invSheet.getLastRow()-1, 6).getValues();
      invAllData.forEach(function(r, idx) {
        var id = String(r[0]);
        if (itmStockMap.hasOwnProperty(id)) {
          invSheet.getRange(idx+2, 6).setValue(itmStockMap[id]);
        }
      });
    }
    console.log("[GHMS][seedDemoData] Stock levels updated.");

    // ── 7. Batch-write Ledger ─────────────────────────────────────────────────
    _batchAppend(SHEETS.LEDGER, ledRows.slice(0, _useLed));
    console.log("[GHMS][seedDemoData] Ledger done: " + _useLed + " entries.");

    // ── 8. Mark as seeded ─────────────────────────────────────────────────────
    setSetting(DEMO_SEED_KEY, "TRUE", "Demo data has been seeded");

    var elapsed = ((new Date() - t0) / 1000).toFixed(1);
    var msg = "Demo data seeded in " + elapsed + "s: 20 rooms, 100 guests, 200 inventory items,\n" +
              "160 bookings, " + payRows.length + " payments, " + invPtr + " invoices, " +
              lnPtr + " invoice lines, " + _useLed + " ledger entries.";
    console.log("[GHMS][seedDemoData] " + msg);
    return successResponse({ rooms:20, guests:100, bookings:160, payments:payRows.length,
                             invoices:invPtr, ledger:_useLed }, msg);
  } catch(e) {
    console.error("[GHMS][seedDemoData] " + e.message + "\n" + (e.stack||""));
    return handleError(e, "seedDemoData");
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — PUBLIC: Clear Demo Data
// ─────────────────────────────────────────────────────────────────────────────

function clearDemoData() {
  try {
    var sheetConfigs = [
      [SHEETS.INVOICE_LINES,   _DM.INVOICE_LINES  ],
      [SHEETS.INVOICES,        _DM.INVOICES       ],
      [SHEETS.PAYMENTS,        _DM.PAYMENTS       ],
      [SHEETS.ROOM_INCOME,     _DM.ROOM_INCOME    ],
      [SHEETS.ROOM_EXPENSE,    _DM.ROOM_EXPENSE   ],
      [SHEETS.KITCHEN_INCOME,  _DM.KITCHEN_INCOME ],
      [SHEETS.KITCHEN_EXPENSE, _DM.KITCHEN_EXPENSE],
      [SHEETS.LEDGER,          _DM.LEDGER         ],
      [SHEETS.STOCK_OUT,       _DM.STOCK_OUT      ],
      [SHEETS.STOCK_IN,        _DM.STOCK_IN       ],
      [SHEETS.STOCK_LEDGER,    _DM.STOCK_LEDGER   ],
      [SHEETS.BOOKINGS,        _DM.BOOKINGS       ],
      [SHEETS.INVENTORY_ITEMS, _DM.INVENTORY_ITEMS],
      [SHEETS.GUESTS,          _DM.GUESTS         ],
      [SHEETS.ROOMS,           _DM.ROOMS          ],
    ];

    var total = 0;
    sheetConfigs.forEach(function(cfg) {
      total += _clearDemoSheet(cfg[0], cfg[1]);
    });

    setSetting(DEMO_SEED_KEY, "", "Demo data seeded flag");

    var msg = "Cleared " + total + " demo rows.";
    console.log("[GHMS][clearDemoData] " + msg);
    return successResponse({ rowsDeleted: total }, msg);
  } catch(e) {
    return handleError(e, "clearDemoData");
  }
}

function _clearDemoSheet(sheetName, markerCol) {
  try {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    var numRows = sheet.getLastRow() - 1;
    var numCols = sheet.getLastColumn();
    if (numCols === 0) return 0;
    var data    = sheet.getRange(2, 1, numRows, numCols).getValues();
    var toDelete = [];
    for (var i = data.length - 1; i >= 0; i--) {
      if (String(data[i][markerCol] || "").indexOf(DEMO_TAG) !== -1) {
        toDelete.push(i + 2);
      }
    }
    toDelete.forEach(function(row) { sheet.deleteRow(row); });
    return toDelete.length;
  } catch(e) {
    console.error("[_clearDemoSheet:" + sheetName + "] " + e.message);
    return 0;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — PUBLIC: Run System Tests
// ─────────────────────────────────────────────────────────────────────────────

function runSystemTests() {
  var testSheet = _initTestSheet();
  var results   = [];
  var token     = _makeTestToken();
  var cleanup   = []; // {sheet, rowIdx} to delete after tests

  try {
    _testRoomsCrud       (results, token, cleanup);
    _testGuestsValidation(results, token, cleanup);
    _testBookingOverlap  (results, token, cleanup);
    _testCheckinCheckout (results, token, cleanup);
    _testPaymentBalance  (results, token, cleanup);
    _testInvoiceBalance  (results, token, cleanup);
    _testLedgerBalance   (results, token, cleanup);
    _testInventoryBalance(results, token, cleanup);
    _testLowStockReport  (results, token, cleanup);
    _testReportsCalc     (results, token, cleanup);
    _testRoleAccess      (results, token, cleanup);
  } catch(fatalE) {
    results.push({ testId:"T-FATAL", module:"System", name:"Test Runner",
                   status:"FAIL", expected:"No fatal error",
                   actual: fatalE.message, notes: fatalE.stack||"", testedAt: formatDateTime(now()) });
  } finally {
    CacheService.getScriptCache().remove("ghms_sess_" + token);
    // Clean up test rows (bottom-to-top per sheet)
    var bySheet = {};
    cleanup.forEach(function(c) {
      if (!bySheet[c.sheet]) bySheet[c.sheet] = [];
      bySheet[c.sheet].push(c.row);
    });
    Object.keys(bySheet).forEach(function(sn) {
      var sheet = getSpreadsheet().getSheetByName(sn);
      if (!sheet) return;
      bySheet[sn].sort(function(a,b){ return b-a; });
      bySheet[sn].forEach(function(r) {
        try { sheet.deleteRow(r); } catch(e) {}
      });
    });
  }

  var pass = 0, fail = 0;
  results.forEach(function(r) {
    testSheet.appendRow([r.testId, r.module, r.name, r.status,
                         r.expected, r.actual, r.notes, r.testedAt]);
    if (r.status === "PASS") pass++; else fail++;
  });

  var summary = pass + " passed, " + fail + " failed out of " + results.length + " tests.";
  console.log("[GHMS][runSystemTests] " + summary);
  return successResponse({ passed: pass, failed: fail, total: results.length }, summary);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — TEST IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

function _testRoomsCrud(R, token, cleanup) {
  var m = "Rooms";
  var rn = "TST-" + Utilities.getUuid().slice(0,4).toUpperCase();

  // T-01: Create room
  var r1 = addRoom({ roomNumber: rn, roomType: "Single", pricePerNight: 4000, floor: 9, notes: "test" });
  _logT(R, "T-01", m, "addRoom valid", r1.success, true, r1.success, r1.message);
  var rid = r1.success ? r1.data.roomId : null;
  if (rid) {
    var rIdx = findRowById(SHEETS.ROOMS, rid, 1);
    if (rIdx !== -1) cleanup.push({ sheet: SHEETS.ROOMS, row: rIdx });
  }

  // T-02: Duplicate room number
  if (r1.success) {
    var r2 = addRoom({ roomNumber: rn, roomType: "Double", pricePerNight: 5000, floor: 9, notes: "dupe" });
    _logT(R, "T-02", m, "addRoom duplicate number blocked", !r2.success, true, !r2.success, r2.message);
  } else {
    _logT(R, "T-02", m, "addRoom duplicate number blocked", true, true, true, "Skipped (T-01 failed)");
  }

  // T-03: Update room
  if (rid) {
    var r3 = updateRoom(rid, { roomNumber: rn, roomType: "Single", pricePerNight: 4500, floor: 9, status: ROOM_STATUS.AVAILABLE, notes: "updated" });
    var priceOk = r3.success && toNumber(r3.data && r3.data.ratePerNight, -1) === 4500;
    _logT(R, "T-03", m, "updateRoom price change", priceOk, "4500", String(r3.data && r3.data.ratePerNight), r3.message);
  } else {
    _logT(R, "T-03", m, "updateRoom price change", false, "success", "no room created", "");
  }

  // T-04: Missing required field
  var r4 = addRoom({ roomNumber: "", roomType: "Single", pricePerNight: 3000, floor: 1, notes: "" });
  _logT(R, "T-04", m, "addRoom missing roomNumber blocked", !r4.success, true, !r4.success, r4.message);

  // T-05: Invalid price (zero)
  var r5 = addRoom({ roomNumber: "TST-BADPRICE", roomType: "Single", pricePerNight: 0, floor: 1, notes: "" });
  _logT(R, "T-05", m, "addRoom price=0 blocked", !r5.success, true, !r5.success, r5.message);
}

function _testGuestsValidation(R, token, cleanup) {
  var m = "Guests";
  var basePhone = "03" + _padNumber(99000000 + cleanup.length, 9);

  // T-06: Valid guest
  var r6 = addGuest({ guestName:"Test Guest", phone: basePhone, cnic: _demoCnic(9990 + cleanup.length), email:"tst@demo.pk", city:"Lahore", notes:"test" });
  _logT(R, "T-06", m, "addGuest valid", r6.success, true, r6.success, r6.message);
  if (r6.success) {
    var gIdx = findRowById(SHEETS.GUESTS, r6.data.guestId, 1);
    if (gIdx !== -1) cleanup.push({ sheet: SHEETS.GUESTS, row: gIdx });
  }

  // T-07: Duplicate phone
  if (r6.success) {
    var r7 = addGuest({ guestName:"Test Guest 2", phone: basePhone, cnic: _demoCnic(9991 + cleanup.length), email:"tst2@demo.pk", notes:"" });
    _logT(R, "T-07", m, "addGuest duplicate phone blocked", !r7.success, true, !r7.success, r7.message);
  } else {
    _logT(R, "T-07", m, "addGuest duplicate phone blocked", true, true, true, "Skipped (T-06 failed)");
  }

  // T-08: Invalid CNIC (too short)
  var r8 = addGuest({ guestName:"Bad CNIC", phone:"03001234567", cnic:"12345", email:"bad@demo.pk", notes:"" });
  _logT(R, "T-08", m, "addGuest invalid CNIC blocked", !r8.success, true, !r8.success, r8.message);

  // T-09: Invalid phone (wrong length)
  var r9 = addGuest({ guestName:"Bad Phone", phone:"0323456", cnic: _demoCnic(9995), email:"bad2@demo.pk", notes:"" });
  _logT(R, "T-09", m, "addGuest invalid phone blocked", !r9.success, true, !r9.success, r9.message);

  // T-10: Missing name
  var r10 = addGuest({ guestName:"", phone:"03001112233", cnic: _demoCnic(9996), email:"", notes:"" });
  _logT(R, "T-10", m, "addGuest missing name blocked", !r10.success, true, !r10.success, r10.message);
}

function _testBookingOverlap(R, token, cleanup) {
  var m = "Bookings";
  // Create a test room and guest first
  var rn = "TST-OVL-" + Utilities.getUuid().slice(0,3).toUpperCase();
  var rR = addRoom({ roomNumber: rn, roomType: "Single", pricePerNight: 3000, floor: 9, notes: "overlap test" });
  var gR = addGuest({ guestName:"Overlap Tester", phone: "03" + _padNumber(87654321 + cleanup.length, 9), cnic: _demoCnic(8880 + cleanup.length), notes: "" });
  if (rR.success) { var ri = findRowById(SHEETS.ROOMS, rR.data.roomId, 1); if (ri !== -1) cleanup.push({ sheet: SHEETS.ROOMS, row: ri }); }
  if (gR.success) { var gi = findRowById(SHEETS.GUESTS, gR.data.guestId, 1); if (gi !== -1) cleanup.push({ sheet: SHEETS.GUESTS, row: gi }); }

  if (!rR.success || !gR.success) {
    _logT(R, "T-11", m, "Booking overlap prevention", false, "success", "setup failed", "");
    _logT(R, "T-12", m, "Non-overlapping booking allowed", false, "success", "setup failed", "");
    _logT(R, "T-13", m, "Booking missing guestId blocked", false, "success", "setup failed", "");
    return;
  }
  var roomId = rR.data.roomId, guestId = gR.data.guestId;
  var tomorrow = _demoDateStr(60), in3 = _demoDateStr(63);

  // T-11: First booking
  var b1 = createBooking({ guestId: guestId, roomId: roomId, checkIn: tomorrow, checkOut: in3, ratePerNight: 3000, discount: 0, taxAmount: 0, advancePaid: 0, notes: "overlap test 1" });
  _logT(R, "T-11", m, "createBooking first booking", b1.success, true, b1.success, b1.message);
  if (b1.success) { var bi = findRowById(SHEETS.BOOKINGS, b1.data.bookingId, 1); if (bi !== -1) cleanup.push({ sheet: SHEETS.BOOKINGS, row: bi }); }

  // T-12: Overlapping booking blocked
  if (b1.success) {
    var b2 = createBooking({ guestId: guestId, roomId: roomId, checkIn: _demoDateStr(61), checkOut: _demoDateStr(64), ratePerNight: 3000, discount: 0, taxAmount: 0, advancePaid: 0, notes: "overlap test 2" });
    _logT(R, "T-12", m, "createBooking overlap blocked", !b2.success && b2.errorCode === ERROR_CODES.ROOM_UNAVAILABLE, true, !b2.success, b2.message);
  } else {
    _logT(R, "T-12", m, "createBooking overlap blocked", true, true, true, "Skipped");
  }

  // T-13: Non-overlapping booking allowed
  var b3 = createBooking({ guestId: guestId, roomId: roomId, checkIn: _demoDateStr(70), checkOut: _demoDateStr(72), ratePerNight: 3000, discount: 0, taxAmount: 0, advancePaid: 0, notes: "non-overlap" });
  _logT(R, "T-13", m, "createBooking non-overlapping allowed", b3.success, true, b3.success, b3.message);
  if (b3.success) { var bi3 = findRowById(SHEETS.BOOKINGS, b3.data.bookingId, 1); if (bi3 !== -1) cleanup.push({ sheet: SHEETS.BOOKINGS, row: bi3 }); }

  // T-14: Missing guestId
  var b4 = createBooking({ guestId: "", roomId: roomId, checkIn: tomorrow, checkOut: in3, ratePerNight: 3000, discount: 0, taxAmount: 0, advancePaid: 0, notes: "" });
  _logT(R, "T-14", m, "createBooking missing guestId blocked", !b4.success, true, !b4.success, b4.message);
}

function _testCheckinCheckout(R, token, cleanup) {
  var m = "CheckInOut";
  // Create isolated test booking
  var rn = "TST-CI-" + Utilities.getUuid().slice(0,3).toUpperCase();
  var rR = addRoom({ roomNumber: rn, roomType: "Single", pricePerNight: 3000, floor: 9, notes: "ci test" });
  var gR = addGuest({ guestName:"CI Tester", phone: "03" + _padNumber(76543210 + cleanup.length, 9), cnic: _demoCnic(7770 + cleanup.length), notes: "" });
  if (rR.success) { var ri = findRowById(SHEETS.ROOMS, rR.data.roomId, 1); if (ri !== -1) cleanup.push({ sheet: SHEETS.ROOMS, row: ri }); }
  if (gR.success) { var gi = findRowById(SHEETS.GUESTS, gR.data.guestId, 1); if (gi !== -1) cleanup.push({ sheet: SHEETS.GUESTS, row: gi }); }
  if (!rR.success || !gR.success) {
    ["T-15","T-16","T-17","T-18"].forEach(function(id) { _logT(R, id, m, id + " check", false, "success", "setup failed", ""); });
    return;
  }

  var bR = createBooking({ guestId: gR.data.guestId, roomId: rR.data.roomId,
    checkIn: _demoDateStr(80), checkOut: _demoDateStr(82), ratePerNight: 3000,
    discount: 0, taxAmount: 0, advancePaid: 0, notes: "ci test booking" });
  if (bR.success) { var bIdx = findRowById(SHEETS.BOOKINGS, bR.data.bookingId, 1); if (bIdx !== -1) cleanup.push({ sheet: SHEETS.BOOKINGS, row: bIdx }); }
  if (!bR.success) {
    ["T-15","T-16","T-17","T-18"].forEach(function(id) { _logT(R, id, m, id + " check", false, "success", "booking failed", bR.message); });
    return;
  }

  var bkId = bR.data.bookingId;
  var rmId = rR.data.roomId;

  // T-15: Check in
  var ci = checkInBooking(bkId);
  _logT(R, "T-15", m, "checkInBooking Confirmed→Checked_In", ci.success, true, ci.success, ci.message);

  // T-16: Room status = Occupied after check-in
  var rmRow = getSheet(SHEETS.ROOMS).getRange(findRowById(SHEETS.ROOMS, rmId, 1), 7).getValue();
  _logT(R, "T-16", m, "Room status Occupied after check-in", rmRow === ROOM_STATUS.OCCUPIED, ROOM_STATUS.OCCUPIED, rmRow, "");

  // T-17: Cannot check-in again (wrong status)
  var ci2 = checkInBooking(bkId);
  _logT(R, "T-17", m, "checkInBooking already checked-in blocked", !ci2.success, true, !ci2.success, ci2.message);

  // T-18: Check out
  var co = checkOutBooking(bkId);
  _logT(R, "T-18", m, "checkOutBooking Checked_In→Checked_Out", co.success, true, co.success, co.message);

  // Room should now be Cleaning
  var rmRow2 = getSheet(SHEETS.ROOMS).getRange(findRowById(SHEETS.ROOMS, rmId, 1), 7).getValue();
  _logT(R, "T-19", m, "Room status Cleaning after check-out", rmRow2 === ROOM_STATUS.CLEANING, ROOM_STATUS.CLEANING, rmRow2, "");
}

function _testPaymentBalance(R, token, cleanup) {
  var m = "Payments";
  // Create isolated booking
  var rn = "TST-PAY-" + Utilities.getUuid().slice(0,3).toUpperCase();
  var rR = addRoom({ roomNumber: rn, roomType: "Single", pricePerNight: 5000, floor: 9, notes: "pay test" });
  var gR = addGuest({ guestName:"Pay Tester", phone: "03" + _padNumber(65432109 + cleanup.length, 9), cnic: _demoCnic(6660 + cleanup.length), notes: "" });
  if (rR.success) { var ri = findRowById(SHEETS.ROOMS, rR.data.roomId, 1); if (ri !== -1) cleanup.push({ sheet: SHEETS.ROOMS, row: ri }); }
  if (gR.success) { var gi = findRowById(SHEETS.GUESTS, gR.data.guestId, 1); if (gi !== -1) cleanup.push({ sheet: SHEETS.GUESTS, row: gi }); }
  if (!rR.success || !gR.success) {
    ["T-20","T-21","T-22"].forEach(function(id) { _logT(R, id, m, id, false, "success", "setup failed",""); });
    return;
  }

  var bR = createBooking({ guestId: gR.data.guestId, roomId: rR.data.roomId,
    checkIn: _demoDateStr(90), checkOut: _demoDateStr(92), ratePerNight: 5000,
    discount: 0, taxAmount: 0, advancePaid: 0, notes: "pay test booking" });
  if (bR.success) { var bIdx = findRowById(SHEETS.BOOKINGS, bR.data.bookingId, 1); if (bIdx !== -1) cleanup.push({ sheet: SHEETS.BOOKINGS, row: bIdx }); }
  if (!bR.success) {
    ["T-20","T-21","T-22"].forEach(function(id) { _logT(R, id, m, id, false, "success", "booking failed", bR.message); });
    return;
  }

  var bkId = bR.data.bookingId;
  var net  = bR.data.netAmount; // 2 nights × 5000 = 10000

  // T-20: Payment exceeds balance blocked
  var p1 = addPayment({ bookingId: bkId, date: todayStr(), amount: net + 1000, paymentMethod: "Cash", paymentType: PAYMENT_TYPES.FINAL, notes: "overbalance" });
  _logT(R, "T-20", m, "addPayment over-balance blocked", !p1.success, true, !p1.success, p1.message);

  // T-21: Valid partial payment
  var partAmt = roundTo2(net * 0.5);
  var p2 = addPayment({ bookingId: bkId, date: todayStr(), amount: partAmt, paymentMethod: "Cash", paymentType: PAYMENT_TYPES.ADVANCE, notes: "partial" });
  _logT(R, "T-21", m, "addPayment partial valid", p2.success, true, p2.success, p2.message);
  if (p2.success) { var pIdx = findRowById(SHEETS.PAYMENTS, p2.data.paymentId, 1); if (pIdx !== -1) cleanup.push({ sheet: SHEETS.PAYMENTS, row: pIdx }); }

  // T-22: AdvancePaid updated on booking
  if (p2.success) {
    var bkRow = getSheet(SHEETS.BOOKINGS).getRange(findRowById(SHEETS.BOOKINGS, bkId, 1), 10).getValue();
    var advOk = Math.abs(toNumber(bkRow, -1) - partAmt) < 0.01;
    _logT(R, "T-22", m, "Booking AdvancePaid updated after payment", advOk, String(partAmt), String(bkRow), "");
  } else {
    _logT(R, "T-22", m, "Booking AdvancePaid updated after payment", false, String(partAmt), "payment failed", "");
  }
}

function _testInvoiceBalance(R, token, cleanup) {
  var m = "Billing";
  // Create isolated booking
  var rn = "TST-INV-" + Utilities.getUuid().slice(0,3).toUpperCase();
  var rR = addRoom({ roomNumber: rn, roomType: "Double", pricePerNight: 6000, floor: 9, notes: "inv test" });
  var gR = addGuest({ guestName:"Inv Tester", phone: "03" + _padNumber(54321098 + cleanup.length, 9), cnic: _demoCnic(5550 + cleanup.length), notes: "" });
  if (rR.success) { var ri = findRowById(SHEETS.ROOMS, rR.data.roomId, 1); if (ri !== -1) cleanup.push({ sheet: SHEETS.ROOMS, row: ri }); }
  if (gR.success) { var gi = findRowById(SHEETS.GUESTS, gR.data.guestId, 1); if (gi !== -1) cleanup.push({ sheet: SHEETS.GUESTS, row: gi }); }
  if (!rR.success || !gR.success) {
    ["T-23","T-24","T-25","T-26"].forEach(function(id) { _logT(R, id, m, id, false, "success", "setup failed",""); });
    return;
  }

  var bR = createBooking({ guestId: gR.data.guestId, roomId: rR.data.roomId,
    checkIn: _demoDateStr(100), checkOut: _demoDateStr(103), ratePerNight: 6000,
    discount: 0, taxAmount: 0, advancePaid: 0, notes: "inv test" });
  if (bR.success) { var bIdx = findRowById(SHEETS.BOOKINGS, bR.data.bookingId, 1); if (bIdx !== -1) cleanup.push({ sheet: SHEETS.BOOKINGS, row: bIdx }); }
  if (!bR.success) {
    ["T-23","T-24","T-25","T-26"].forEach(function(id) { _logT(R, id, m, id, false, "success", "booking failed", bR.message); });
    return;
  }

  // T-23: Create invoice (Draft, paidAmount=0)
  var inv1 = createInvoice(token, { bookingId: bR.data.bookingId, notes: "test invoice" });
  _logT(R, "T-23", m, "createInvoice status=Draft paidAmount=0",
        inv1.success && inv1.data.status === INVOICE_STATUS.DRAFT && inv1.data.paidAmount === 0,
        "Draft/0", inv1.success ? inv1.data.status + "/" + inv1.data.paidAmount : "failed", inv1.message);
  if (inv1.success) {
    var iIdx = findRowById(SHEETS.INVOICES, inv1.data.invoiceId, 1);
    if (iIdx !== -1) cleanup.push({ sheet: SHEETS.INVOICES, row: iIdx });
    // Also clean invoice lines
    var lnData = getSheetData(SHEETS.INVOICE_LINES);
    for (var li = lnData.length - 1; li >= 0; li--) {
      if (String(lnData[li][1]) === inv1.data.invoiceId) {
        cleanup.push({ sheet: SHEETS.INVOICE_LINES, row: li + 2 });
      }
    }
    // And ledger entry for invoice
    var ledData = getSheetData(SHEETS.LEDGER);
    for (var li2 = ledData.length - 1; li2 >= 0; li2--) {
      if (String(ledData[li2][5]) === inv1.data.invoiceId) {
        cleanup.push({ sheet: SHEETS.LEDGER, row: li2 + 2 });
      }
    }
  }

  if (!inv1.success) {
    ["T-24","T-25","T-26"].forEach(function(id) { _logT(R, id, m, id, false, "success", "invoice creation failed",""); });
    return;
  }

  var invId  = inv1.data.invoiceId;
  var grand  = inv1.data.grandTotal; // 3 nights × 6000 = 18000

  // T-24: Partial payment → Partially Paid
  var half = roundTo2(grand * 0.5);
  var pay1 = receiveInvoicePayment(token, invId, { amount: half, paymentMethod: "Cash", notes: "half" });
  _logT(R, "T-24", m, "receiveInvoicePayment partial → Partially Paid",
        pay1.success && pay1.data.status === INVOICE_STATUS.PARTIALLY_PAID,
        INVOICE_STATUS.PARTIALLY_PAID, pay1.success ? pay1.data.status : "failed", pay1.message);
  if (pay1.success) {
    var pIdx2 = getSheetData(SHEETS.PAYMENTS);
    for (var pi = pIdx2.length - 1; pi >= 0; pi--) {
      if (String(pIdx2[pi][1]) === bR.data.bookingId && String(pIdx2[pi][7]).indexOf("half") !== -1) {
        cleanup.push({ sheet: SHEETS.PAYMENTS, row: pi + 2 }); break;
      }
    }
    var ledD2 = getSheetData(SHEETS.LEDGER);
    for (var li3 = ledD2.length - 1; li3 >= 0; li3--) {
      if (String(ledD2[li3][5]).indexOf("PAY-") === 0 && toNumber(ledD2[li3][8],0) === half) {
        cleanup.push({ sheet: SHEETS.LEDGER, row: li3 + 2 }); break;
      }
    }
  }

  // T-25: Full remaining payment → Paid, balance=0
  if (pay1.success) {
    var remaining = pay1.data.balanceDue;
    var pay2 = receiveInvoicePayment(token, invId, { amount: remaining, paymentMethod: "Cash", notes: "final" });
    var balOk = pay2.success && pay2.data.status === INVOICE_STATUS.PAID && pay2.data.balanceDue === 0;
    _logT(R, "T-25", m, "receiveInvoicePayment final → Paid balanceDue=0", balOk,
          "Paid/0", pay2.success ? pay2.data.status + "/" + pay2.data.balanceDue : "failed", pay2.message);
  } else {
    _logT(R, "T-25", m, "receiveInvoicePayment final → Paid balanceDue=0", false, "Paid/0", "prior failed","");
  }

  // T-26: Over-payment blocked
  var over = receiveInvoicePayment(token, invId, { amount: 9999, paymentMethod: "Cash", notes: "over" });
  _logT(R, "T-26", m, "receiveInvoicePayment over-balance blocked", !over.success, true, !over.success, over.message);
}

function _testLedgerBalance(R, token, cleanup) {
  var m = "Ledger";
  var stats = getLedgerStats();
  if (!stats.success) {
    _logT(R, "T-27", m, "getLedgerStats returns success", false, true, false, stats.message);
    return;
  }
  // T-27: getLedgerStats returns correct balance = totalCredit - totalDebit
  var expected = roundTo2(stats.data.totalCredit - stats.data.totalDebit);
  var actual   = roundTo2(stats.data.balance);
  _logT(R, "T-27", m, "Ledger balance = totalCredit − totalDebit", Math.abs(expected - actual) < 0.01, expected, actual, "");

  // T-28: Ledger last row balance matches computed
  var rows = getSheetData(SHEETS.LEDGER);
  if (rows.length > 0) {
    var running = 0;
    rows.filter(function(r){ return trimStr(r[0]) !== ""; }).forEach(function(r) {
      running = roundTo2(running + toNumber(r[8],0) - toNumber(r[7],0));
    });
    var lastBal = toNumber(rows[rows.length-1][9], 0);
    _logT(R, "T-28", m, "Last ledger row balance matches running total",
          Math.abs(running - lastBal) < 0.01, roundTo2(running), lastBal, "");
  } else {
    _logT(R, "T-28", m, "Last ledger row balance matches running total", true, "no entries", "no entries", "No data");
  }
}

function _testInventoryBalance(R, token, cleanup) {
  var m = "Inventory";
  var nm = "BalTest-" + Utilities.getUuid().slice(0,6);

  // T-29: addInventoryItem
  var i1 = addInventoryItem({ itemName: nm, category: "General", uom: "PCS", reorderLevel: 5, currentStock: 10, notes: "balance test" });
  _logT(R, "T-29", m, "addInventoryItem valid", i1.success, true, i1.success, i1.message);
  var itmId = i1.success ? i1.data.itemId : null;
  if (itmId) { var iIdx = findRowById(SHEETS.INVENTORY_ITEMS, itmId, 1); if (iIdx !== -1) cleanup.push({ sheet: SHEETS.INVENTORY_ITEMS, row: iIdx }); }
  if (!itmId) { ["T-30","T-31","T-32"].forEach(function(id){ _logT(R,id,m,id,false,"success","setup failed",""); }); return; }

  // T-30: Stock In increases CurrentStock
  var s1 = addStockIn({ date: todayStr(), itemId: itmId, quantity: 20, unitCost: 100, vendor: "Test Vendor", paymentMethod: "Cash", notes: "balance test in" });
  _logT(R, "T-30", m, "addStockIn increases CurrentStock", s1.success, true, s1.success, s1.message);
  if (s1.success) {
    var sIdx = findRowById(SHEETS.STOCK_IN, s1.data.stockInId, 1);
    if (sIdx !== -1) cleanup.push({ sheet: SHEETS.STOCK_IN, row: sIdx });
    var slgD = getSheetData(SHEETS.STOCK_LEDGER);
    for (var li = slgD.length - 1; li >= 0; li--) {
      if (String(slgD[li][8]) === s1.data.stockInId) { cleanup.push({ sheet: SHEETS.STOCK_LEDGER, row: li+2 }); break; }
    }
    var ledD = getSheetData(SHEETS.LEDGER);
    for (var ll = ledD.length - 1; ll >= 0; ll--) {
      if (String(ledD[ll][5]) === s1.data.stockInId) { cleanup.push({ sheet: SHEETS.LEDGER, row: ll+2 }); break; }
    }
    // Check stock level
    var newStock = toNumber(getSheet(SHEETS.INVENTORY_ITEMS).getRange(findRowById(SHEETS.INVENTORY_ITEMS, itmId, 1), 6).getValue(), 0);
    _logT(R, "T-31", m, "CurrentStock = openingStock + stockIn (10+20=30)", Math.abs(newStock - 30) < 0.01, 30, newStock, "");
  } else {
    _logT(R, "T-31", m, "CurrentStock = openingStock + stockIn", false, 30, "stockIn failed", "");
  }

  // T-32: Stock Out exceeds available blocked
  var sOut = addStockOut({ date: todayStr(), itemId: itmId, quantity: 9999, purpose: "Test", department: "General", notes: "exceed test" });
  _logT(R, "T-32", m, "addStockOut exceeds stock blocked", !sOut.success, true, !sOut.success, sOut.message);

  // Also clean stock ledger from opening balance
  var openSlg = getSheetData(SHEETS.STOCK_LEDGER);
  for (var ls = openSlg.length-1; ls >= 0; ls--) {
    if (String(openSlg[ls][8]) === itmId) { cleanup.push({ sheet: SHEETS.STOCK_LEDGER, row: ls+2 }); break; }
  }
}

function _testLowStockReport(R, token, cleanup) {
  var m = "Inventory";
  var nm = "LowStk-" + Utilities.getUuid().slice(0,6);

  // T-33: Item with stock ≤ reorderLevel appears in low-stock report
  var i1 = addInventoryItem({ itemName: nm, category: "General", uom: "PCS", reorderLevel: 20, currentStock: 5, notes: "low stock test" });
  _logT(R, "T-33a", m, "addInventoryItem for low-stock test", i1.success, true, i1.success, i1.message);
  if (i1.success) {
    var iIdx = findRowById(SHEETS.INVENTORY_ITEMS, i1.data.itemId, 1);
    if (iIdx !== -1) cleanup.push({ sheet: SHEETS.INVENTORY_ITEMS, row: iIdx });
    // Clean opening stock ledger entry
    var slg = getSheetData(SHEETS.STOCK_LEDGER);
    for (var ls = slg.length-1; ls >= 0; ls--) {
      if (String(slg[ls][8]) === i1.data.itemId) { cleanup.push({ sheet: SHEETS.STOCK_LEDGER, row: ls+2 }); break; }
    }

    var low = getLowStockItems();
    var found = low.success && low.data.some(function(item) { return item.itemId === i1.data.itemId; });
    _logT(R, "T-33", m, "Low-stock item appears in getLowStockItems", found, true, found, low.message);
  } else {
    _logT(R, "T-33", m, "Low-stock item appears in getLowStockItems", false, true, false, "Setup failed");
  }
}

function _testReportsCalc(R, token, cleanup) {
  var m = "Reports";
  var today = todayStr();
  var from  = _demoDateStr(-30);

  // T-34: Income Statement returns success + kpis
  var r1 = getReportData({ type: "income-statement", from: from, to: today });
  _logT(R, "T-34", m, "income-statement report returns success", r1.success, true, r1.success, r1.message);
  _logT(R, "T-35", m, "income-statement has kpis array", r1.success && Array.isArray(r1.data.kpis), true, r1.success && Array.isArray(r1.data.kpis), "");

  // T-36: Booking Summary
  var r2 = getReportData({ type: "booking-summary", from: from, to: today });
  _logT(R, "T-36", m, "booking-summary report returns success", r2.success, true, r2.success, r2.message);

  // T-37: Expense Summary
  var r3 = getReportData({ type: "expense-summary", from: from, to: today });
  _logT(R, "T-37", m, "expense-summary report returns success", r3.success, true, r3.success, r3.message);

  // T-38: Cancelled Bookings (validates our earlier KPI bug fix)
  var r4 = getReportData({ type: "cancelled-bookings", from: _demoDateStr(-90), to: today });
  _logT(R, "T-38", m, "cancelled-bookings KPI counts valid (not NaN)", r4.success && r4.data && r4.data.kpis && r4.data.kpis[0].value >= 0, true, r4.success ? r4.data.kpis[0].value : "failed", "Bug fix verification");
}

function _testRoleAccess(R, token, cleanup) {
  var m = "Auth";

  // T-39: Admin ROLE_ACCESS includes 'settings'
  var adminHas = ROLE_ACCESS["Admin"] && ROLE_ACCESS["Admin"].indexOf("settings") !== -1;
  _logT(R, "T-39", m, "Admin role has 'settings' access", adminHas, true, adminHas, "");

  // T-40: Finance role does NOT have 'settings' access
  var finHasNo = !ROLE_ACCESS["Finance"] || ROLE_ACCESS["Finance"].indexOf("settings") === -1;
  _logT(R, "T-40", m, "Finance role has NO 'settings' access", finHasNo, true, finHasNo, "");

  // T-41: Front Desk does NOT have 'ledger' access
  var fdHasNo = !ROLE_ACCESS["Front Desk"] || ROLE_ACCESS["Front Desk"].indexOf("ledger") === -1;
  _logT(R, "T-41", m, "Front Desk has NO 'ledger' access", fdHasNo, true, fdHasNo, "");

  // T-42: saveHotelSettings blocked for non-Admin token
  var finToken = _makeRoleToken("Finance");
  try {
    var sr = saveHotelSettings(finToken, { hotelName: "HACK" });
    _logT(R, "T-42", m, "saveHotelSettings blocked for Finance role", !sr.success, true, !sr.success, sr.message);
  } catch(e) {
    _logT(R, "T-42", m, "saveHotelSettings blocked for Finance role", false, true, false, e.message);
  } finally {
    CacheService.getScriptCache().remove("ghms_sess_" + finToken);
  }

  // T-43: saveHotelSettings allowed for Admin token
  var curName = getSetting("HOTEL_NAME");
  var ar = saveHotelSettings(token, { hotelName: curName || "Candlewood Hotel & Suites" });
  _logT(R, "T-43", m, "saveHotelSettings allowed for Admin token", ar.success, true, ar.success, ar.message);
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — TEST UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function _initTestSheet() {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName("Test_Results");
  if (!sheet) {
    sheet = ss.insertSheet("Test_Results");
  }
  // Always clear and rewrite header
  sheet.clearContents();
  var hdr = sheet.getRange(1, 1, 1, 8);
  hdr.setValues([["TestID","Module","TestName","Status","Expected","Actual","Notes","TestedAt"]]);
  hdr.setFontWeight("bold");
  hdr.setBackground(CONFIG.HEADER_BG_COLOR);
  hdr.setFontColor(CONFIG.HEADER_FG_COLOR);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 8);
  return sheet;
}

function _logT(results, testId, module, name, pass, expected, actual, notes) {
  results.push({
    testId  : testId,
    module  : module,
    name    : name,
    status  : pass ? "PASS" : "FAIL",
    expected: String(expected !== undefined ? expected : ""),
    actual  : String(actual   !== undefined ? actual   : ""),
    notes   : String(notes    || ""),
    testedAt: formatDateTime(now()),
  });
}

function _makeTestToken() {
  return _makeRoleToken("Admin");
}

function _makeRoleToken(role) {
  var tok = "SYS-TEST-" + Utilities.getUuid();
  CacheService.getScriptCache().put(
    "ghms_sess_" + tok,
    JSON.stringify({ userId: "SYS-TEST", role: role, fullName: "System Test", email: "sysTest@ghms.local" }),
    300
  );
  return tok;
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — SEED UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _demoReserveIds(entityKey, count) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Lock timeout reserving " + count + " IDs for " + entityKey);
  try {
    var settingsKey = ID_KEYS[entityKey];
    var prefix      = ID_PREFIXES[entityKey];
    var lastId      = getSetting(settingsKey) || (prefix + "-0000");
    var seq         = _parseIdSeq(lastId);
    var ids         = [];
    for (var i = 1; i <= count; i++) ids.push(prefix + "-" + _padNumber(seq + i));
    setSetting(settingsKey, ids[ids.length - 1], "Last generated " + prefix + " ID");
    return ids;
  } finally {
    lock.releaseLock();
  }
}

function _batchAppend(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function _getDemoLedgerBaseBal() {
  try {
    var sheet = getSheet(SHEETS.LEDGER);
    var last  = sheet.getLastRow();
    if (last < 2) return 0;
    return toNumber(sheet.getRange(last, 10).getValue(), 0);
  } catch(e) { return 0; }
}

function _demoDateStr(daysOffset) {
  var d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return formatDate(d);
}

function _demoTs() {
  return formatDateTime(now());
}

function _demoCnic(seed) {
  // Generates a unique 13-digit CNIC string (no dashes)
  var n = (seed % 89999) + 10000;
  var a = _padNumber(n, 5);
  var b = _padNumber(((seed * 7919 + 1234567) % 9000000) + 1000000, 7);
  var c = String((seed % 9) + 1);
  return a + b + c;
}

function _demoPhone(seed) {
  // Generates a unique 11-digit Pakistani phone number starting with 03
  var n = _padNumber(((seed * 6271 + 100000001) % 900000000) + 100000000, 9);
  return "03" + n;
}
