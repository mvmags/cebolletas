begin;

alter table public.information_requests
  drop constraint information_requests_dates_valid,
  add constraint information_requests_dates_valid
  check (checkout_date >= checkin_date);

comment on constraint information_requests_dates_valid
  on public.information_requests
  is 'Calendar-day and fixed-window requests may start and end on the same date; the reservation RPC enforces later checkout for overnight rates.';

commit;
