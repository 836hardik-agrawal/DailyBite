create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_from date not null default current_date,
  calorie_target integer not null check (calorie_target between 1 and 10000),
  protein_target_g numeric(8, 1) not null default 0 check (protein_target_g >= 0),
  carbs_target_g numeric(8, 1) not null default 0 check (carbs_target_g >= 0),
  fat_target_g numeric(8, 1) not null default 0 check (fat_target_g >= 0),
  fiber_target_g numeric(8, 1) not null default 0 check (fiber_target_g >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete restrict,
  source text not null check (source in ('usda', 'open_food_facts', 'custom')),
  source_id text,
  name text not null check (char_length(trim(name)) > 0),
  brand_name text,
  barcode text,
  default_serving_g numeric(8, 2) check (default_serving_g > 0),
  calories_per_100g numeric(8, 2) not null check (calories_per_100g >= 0),
  protein_per_100g numeric(8, 2) not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g numeric(8, 2) not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g numeric(8, 2) not null default 0 check (fat_per_100g >= 0),
  fiber_per_100g numeric(8, 2) not null default 0 check (fiber_per_100g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_id is null and source in ('usda', 'open_food_facts'))
    or (owner_id is not null and source = 'custom')
  )
);

create unique index foods_shared_source_id_idx
  on public.foods (source, source_id)
  where owner_id is null and source_id is not null;

create index foods_name_idx on public.foods (name);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  amount_g numeric(8, 2) not null check (amount_g > 0),
  meal_type text not null default 'snack'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index food_entries_user_consumed_at_idx
  on public.food_entries (user_id, consumed_at desc);

alter table public.profiles enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.foods enable row level security;
alter table public.food_entries enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can manage their own nutrition targets"
  on public.nutrition_targets for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can view shared and personal foods"
  on public.foods for select
  using (owner_id is null or (select auth.uid()) = owner_id);

create policy "Users can add personal foods"
  on public.foods for insert
  with check ((select auth.uid()) = owner_id and source = 'custom');

create policy "Users can update personal foods"
  on public.foods for update using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and source = 'custom');

create policy "Users can delete personal foods"
  on public.foods for delete using ((select auth.uid()) = owner_id);

create policy "Users can manage their own food entries"
  on public.food_entries for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
