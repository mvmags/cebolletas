begin;

revoke all on function public.enforce_information_request_rate_model_v10_4() from public;

comment on function public.enforce_information_request_rate_model_v10_4() is
  'Internal trigger that validates versioned availability and makes participant pricing server-authoritative.';

notify pgrst, 'reload schema';
commit;
