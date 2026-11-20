# Phase 0: Foundation

## What was built

### Project Setup
- Next.js 15 + TypeScript (strict) + Tailwind CSS + App Router
- Supabase client helpers (server + browser + middleware)
- Mobile-first responsive shell

### Database Schema (`supabase/migrations/`)
1. **`00000000000000_schema.sql`** — All tables, enums, indexes, constraints
2. **`00000000000001_rls_and_functions.sql`** — RLS policies, `get_my_role()` helper, audit triggers, `updated_at` triggers

### Auth & Route Guards
- Email/password login via Supabase Auth
- Middleware-based session refresh and route protection
- Unauthenticated users redirected to `/login`
- Authenticated users redirected from `/login` to `/dashboard`

### Dashboard Shell
- Mobile-friendly sidebar with hamburger menu (works at 375px)
- Role-based nav: admin-only items hidden from other roles
- User info + sign out in sidebar footer
- Placeholder pages for every future module

### Seed Data (`supabase/seed.sql`)
- 2 sample flats with 5 rooms and 12 beds at various price points
- Users must be created through Supabase Auth (dashboard or API)

### Configuration
- `.env.example` with all required env vars documented
- `.gitignore` for Next.js + Supabase

## How to test

### Prerequisites
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env.local` and fill in your Supabase URL + keys

### Setup
```bash
npm install
```

### Apply migrations
Run the SQL files in `supabase/migrations/` in order against your Supabase project:
1. `00000000000000_schema.sql`
2. `00000000000001_rls_and_functions.sql`

Then run `supabase/seed.sql` for sample data.

### Create test users
In Supabase Dashboard → Authentication → Users, create users with emails:
- `admin@gmd.co.in` (then insert into profiles with role='admin')
- `sales@gmd.co.in` (role='sales')
- `noc@gmd.co.in` (role='noc')
- `accounts@gmd.co.in` (role='accounts')
- `maintenance@gmd.co.in` (role='maintenance')
- `electricity@gmd.co.in` (role='electricity')

### Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Test checklist
- [ ] Login with each role
- [ ] Sidebar shows correct items per role (admin sees Employees + Settings)
- [ ] Dashboard shows welcome message with correct name and role
- [ ] Mobile: hamburger menu opens/closes, sidebar overlays content
- [ ] Logout works, redirects to login
- [ ] Accessing `/dashboard` without login redirects to `/login`
