
# Tech Coverage Map Dashboard

## Overview
A US map dashboard for your home repair services company with **three role-based views** (Admin, Marketing, CSR), powered by Supabase for authentication, user roles, and technician data management.

## Roles & Access

### Marketing
- View-only access to coverage map (density, regions, radius circles)
- No individual tech details visible

### CSR (Customer Service Representative)
- View coverage map + individual tech pins with details
- Add, edit, deactivate technicians

### Admin
- Full access to both Marketing and CSR views
- **Analytics dashboard** — track activity like techs added, edits made, coverage trends
- **Activity log** — see who (which CSR) added or edited technician details, with timestamps
- **Role management** — assign Marketing or CSR roles to users, invite new users

## Features

### 1. Authentication & Login
- Email/password login page
- Role-based redirect after login (Admin → Admin Dashboard, Marketing → Marketing Map, CSR → CSR Map)
- Role stored securely in a separate `user_roles` table with RLS

### 2. US Map — Marketing View
- Interactive US map showing coverage strength
- **Color-coded states/regions** — green for strong coverage, yellow moderate, red weak
- **Circle overlays** showing coverage radius around tech clusters
- Summary stats: total techs, states covered, strongest/weakest areas
- No individual tech info visible

### 3. US Map — CSR View
- Same coverage visualization as Marketing
- **Clickable pins** for individual technicians
- Click a pin → see tech name, phone, specialty, availability, service area
- Sidebar with searchable/filterable technician list
- Forms to add, edit, and deactivate technicians

### 4. Technician Management (CSR + Admin)
- Add technician form: name, phone, email, specialty/skills, city/state, zip, service radius
- Edit and deactivate existing technicians
- All changes are logged with who made the change and when

### 5. Admin Dashboard
- **Activity Log** — table showing recent actions: "John (CSR) added Tech 'Mike Smith' on Feb 14", "Jane (CSR) edited Tech 'Sarah Lee' location on Feb 13"
- **Analytics** — charts showing techs added over time, coverage growth, active vs inactive techs, techs per state
- **Role Management** — list all users, assign/change roles (Marketing, CSR, Admin), invite new users by email

### 6. Backend (Supabase via Lovable Cloud)
- **Auth** with email/password
- **user_roles table** — stores role per user (admin, marketing, csr)
- **technicians table** — all tech data and coordinates
- **activity_log table** — tracks every add/edit/delete with user ID, action type, timestamp, and details
- **RLS policies** — Marketing: read-only coverage data; CSR: read/write techs; Admin: full access + role management
