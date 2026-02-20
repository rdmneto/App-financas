-- Create a table for Incomes
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  value numeric not null,
  date timestamp with time zone not null,
  description text not null,
  category text not null,
  created_at timestamp with time zone default now()
);

-- Elevate row level security (RLS) for Incomes
alter table public.incomes enable row level security;
create policy "Users can view their own incomes" on incomes for select using (auth.uid() = user_id);
create policy "Users can insert their own incomes" on incomes for insert with check (auth.uid() = user_id);
create policy "Users can update their own incomes" on incomes for update using (auth.uid() = user_id);
create policy "Users can delete their own incomes" on incomes for delete using (auth.uid() = user_id);

-- Create a table for Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  value numeric not null,
  date timestamp with time zone not null,
  description text not null,
  category_type text not null check (category_type in ('Essenciais', 'Estilo de Vida', 'Poupança')),
  created_at timestamp with time zone default now()
);

-- Elevate row level security (RLS) for Expenses
alter table public.expenses enable row level security;
create policy "Users can view their own expenses" on expenses for select using (auth.uid() = user_id);
create policy "Users can insert their own expenses" on expenses for insert with check (auth.uid() = user_id);
create policy "Users can update their own expenses" on expenses for update using (auth.uid() = user_id);
create policy "Users can delete their own expenses" on expenses for delete using (auth.uid() = user_id);

-- Create a table for Investments
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  goal_name text not null,
  value numeric not null,
  date timestamp with time zone not null,
  yield_rate numeric,
  is_auto_correcting boolean default false,
  created_at timestamp with time zone default now()
);

-- Elevate row level security (RLS) for Investments
alter table public.investments enable row level security;
create policy "Users can view their own investments" on investments for select using (auth.uid() = user_id);
create policy "Users can insert their own investments" on investments for insert with check (auth.uid() = user_id);
create policy "Users can update their own investments" on investments for update using (auth.uid() = user_id);
create policy "Users can delete their own investments" on investments for delete using (auth.uid() = user_id);
