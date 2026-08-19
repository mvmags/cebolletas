export function pricingUnits(service, stay) {
  if (!service || !stay || !Number.isInteger(stay.nights) || stay.nights < 0) {
    return null;
  }

  if (service.booking_time_model === "fixed_window") {
    return stay.nights === 0 ? 1 : null;
  }
  if (service.booking_time_model === "calendar_day") return stay.nights + 1;
  return stay.nights;
}

export function calculateQuote(service, stay, adults, children, infants) {
  if (!service || !stay) return null;

  const units = pricingUnits(service, stay);
  return calculateQuoteForUnits(service, units, adults, children, infants);
}

export function calculateQuoteForUnits(service, units, adults, children, infants) {
  if (!service) return null;

  const guestCounts = [adults, children, infants];
  const totalGuests = adults + children + infants;
  const invalidGuests = !guestCounts.every((count) => Number.isInteger(count) && count >= 0)
    || adults < 1
    || totalGuests < service.min_guests
    || totalGuests > service.max_occupancy
    || (service.max_adults !== null && adults > service.max_adults)
    || (service.max_children !== null && children > service.max_children)
    || (service.max_infants !== null && infants > service.max_infants);

  if (invalidGuests) {
    return { capacityExceeded: true, totalGuests };
  }

  if (units === null
    || !Number.isInteger(units)
    || units < service.min_units
    || (service.max_units !== null && units > service.max_units)) {
    return { durationExceeded: true, totalGuests, units };
  }

  if (service.pricing_model === "manual_quote") {
    return { manual: true, totalGuests, units };
  }

  const baseTotal = service.base_price_cents * units;
  if (service.pricing_model === "fixed") {
    return { manual: false, fixed: true, totalGuests, units, baseTotal, total: baseTotal };
  }

  const extraAdults = Math.max(adults - service.included_guests, 0);
  const remainingIncluded = Math.max(service.included_guests - adults, 0);
  const extraChildren = Math.max(children - remainingIncluded, 0);
  const extraInfants = infants;
  const supplementUnits = service.supplement_basis === "per_reservation" ? 1 : units;
  const supplementSubtotal = (extraAdults * service.adult_extra_cents)
    + (extraChildren * service.child_extra_cents)
    + (extraInfants * service.infant_extra_cents);

  return {
    manual: false,
    fixed: false,
    totalGuests,
    units,
    baseTotal,
    extraAdults,
    extraChildren,
    extraInfants,
    supplementUnits,
    supplementTotal: supplementSubtotal * supplementUnits,
    total: baseTotal + (supplementSubtotal * supplementUnits)
  };
}
