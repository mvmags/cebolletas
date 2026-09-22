begin;

-- External references only need to be unique within the same request and
-- payment method. Different providers can legitimately issue the same text.
drop index if exists public.reservation_payments_active_reference_unique;

create unique index reservation_payments_active_reference_unique
on public.reservation_payments (
  information_request_id,
  payment_method_id,
  lower(reference_full)
)
where voided_at is null
  and method_code_snapshot <> 'cash';

commit;
