alter table public.foods
  rename column calories_per_100g to calories_per_serving;
alter table public.foods
  rename column protein_per_100g to protein_per_serving_g;
alter table public.foods
  rename column carbs_per_100g to carbs_per_serving_g;
alter table public.foods
  rename column fat_per_100g to fat_per_serving_g;
alter table public.foods
  rename column fiber_per_100g to fiber_per_serving_g;

alter table public.foods
  add column serving_description text;

update public.foods
set calories_per_serving = round(calories_per_serving * coalesce(default_serving_g, 100) / 100, 2),
    protein_per_serving_g = round(protein_per_serving_g * coalesce(default_serving_g, 100) / 100, 2),
    carbs_per_serving_g = round(carbs_per_serving_g * coalesce(default_serving_g, 100) / 100, 2),
    fat_per_serving_g = round(fat_per_serving_g * coalesce(default_serving_g, 100) / 100, 2),
    fiber_per_serving_g = round(fiber_per_serving_g * coalesce(default_serving_g, 100) / 100, 2),
    serving_description = case
      when default_serving_g is null then '100 g'
      else default_serving_g::text || ' g'
    end,
    default_serving_g = coalesce(default_serving_g, 100);

alter table public.foods
  alter column default_serving_g set default 100,
  alter column default_serving_g set not null,
  alter column serving_description set default '100 g',
  alter column serving_description set not null;

alter table public.foods drop constraint if exists foods_check;
alter table public.foods drop constraint if exists foods_owner_source_check;
alter table public.foods
  add constraint foods_owner_source_check check (
    (owner_id is null and source in ('usda', 'open_food_facts'))
    or (owner_id is not null and source in ('custom', 'usda'))
  );

create unique index if not exists foods_owner_source_id_idx
  on public.foods (owner_id, source, source_id);

drop policy if exists "Users can add personal foods" on public.foods;
create policy "Users can add personal foods"
  on public.foods for insert
  with check (
    (select auth.uid()) = owner_id
    and source in ('custom', 'usda')
  );

drop policy if exists "Users can update personal foods" on public.foods;
create policy "Users can update personal foods"
  on public.foods for update
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and source in ('custom', 'usda')
  );

alter table public.food_entries add column servings numeric(10, 4);
update public.food_entries as entry
set servings = round(entry.amount_g / food.default_serving_g, 4)
from public.foods as food
where food.id = entry.food_id;

alter table public.food_entries
  alter column servings set default 1,
  alter column servings set not null;
alter table public.food_entries drop column amount_g;
alter table public.food_entries
  add constraint food_entries_servings_check check (servings > 0);