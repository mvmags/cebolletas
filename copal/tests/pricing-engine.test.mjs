import assert from "node:assert/strict";
import { calculateQuote, calculateQuoteForUnits, pricingUnits } from "../pricing-engine.mjs";

const baseService = Object.freeze({
  booking_time_model: "overnight",
  pricing_model: "base_plus_guests",
  base_price_cents: 120000,
  included_guests: 3,
  min_guests: 1,
  max_occupancy: 6,
  max_adults: null,
  max_children: null,
  max_infants: null,
  adult_extra_cents: 50000,
  child_extra_cents: 35000,
  infant_extra_cents: 0,
  supplement_basis: "per_unit",
  min_units: 1,
  max_units: null
});

const twoNights = Object.freeze({ nights: 2 });

assert.equal(pricingUnits(baseService, twoNights), 2);
assert.equal(
  pricingUnits({ ...baseService, booking_time_model: "calendar_day" }, twoNights),
  3
);
assert.equal(
  pricingUnits({ ...baseService, booking_time_model: "fixed_window" }, { nights: 0 }),
  1
);
assert.equal(
  pricingUnits({ ...baseService, booking_time_model: "fixed_window" }, { nights: 1 }),
  null
);

assert.deepEqual(calculateQuote(baseService, twoNights, 4, 1, 0), {
  manual: false,
  fixed: false,
  totalGuests: 5,
  units: 2,
  baseTotal: 240000,
  extraAdults: 1,
  extraChildren: 1,
  extraInfants: 0,
  supplementUnits: 2,
  supplementTotal: 170000,
  total: 410000
});

assert.equal(
  calculateQuote({ ...baseService, supplement_basis: "per_reservation" }, twoNights, 4, 1, 0).total,
  325000
);

assert.equal(
  calculateQuote({ ...baseService, pricing_model: "fixed" }, twoNights, 6, 0, 0).total,
  240000
);

assert.deepEqual(
  calculateQuote({ ...baseService, pricing_model: "manual_quote" }, twoNights, 2, 0, 0),
  { manual: true, totalGuests: 2, units: 2 }
);

assert.equal(
  calculateQuote({ ...baseService, max_adults: 2 }, twoNights, 3, 0, 0).capacityExceeded,
  true
);

assert.equal(
  calculateQuote({ ...baseService, min_units: 3 }, twoNights, 2, 0, 0).durationExceeded,
  true
);

assert.equal(
  calculateQuoteForUnits(
    { ...baseService, booking_time_model: "calendar_day", pricing_model: "fixed" },
    1,
    2,
    0,
    0
  ).total,
  120000
);

assert.equal(
  calculateQuote(
    { ...baseService, booking_time_model: "calendar_day", pricing_model: "fixed", max_units: 1 },
    { nights: 0 },
    2,
    0,
    0
  ).total,
  120000
);

console.log("pricing-engine tests passed");
