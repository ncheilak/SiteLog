# SiteLog v3.0 — Architecture Document (Updated)

> **Κατάσταση:** Φάση 1 ✅ · Φάση 2 ✅ · Φάση 3 ✅ · Φάση 4 ✅ · Φάση 5 ✅ · Φάση 6 ✅ · Φάση 7 ✅
> **Τελευταία ενημέρωση:** Μετά την ολοκλήρωση Φάσης 7 (ΣΕΠΕ Παρουσιολόγιο + Company Settings)

---

## 1. Στόχος & Επισκόπηση

Το SiteLog v2.0 ήταν single-user εργαλείο καταγραφής παρουσίας εργοταξίου (5 HTML αρχεία + Supabase χωρίς auth).

Το **SiteLog v3.0** το μετατρέπει σε **multi-user σύστημα** με:
- Authentication (email/password + invite flow)
- 4 ρόλους με διαφορετικά δικαιώματα
- Πολλαπλά εργοτάξια με αναθέσεις χρηστών
- Έκτακτους εργαζόμενους με approval workflow
- Row-Level Security στη βάση
- ΣΕΠΕ Ημερήσιο Παρουσιολόγιο (printable/PDF)
- Hosting: **GitHub Pages** (`https://ncheilak.github.io/SiteLog/`)
- Backend: **Supabase** (project: `ikmwxsfaopjkgajebyyf`, region: Europe/Frankfurt)

---

## 2. Ιεραρχία Ρόλων

```
admin                  ← Πλήρης έλεγχος συστήματος
  │
  ▼
project_manager        ← Διαχείριση πολλών εργοταξίων + ανθρώπων
  │
  ▼
site_manager           ← Διαχείριση ενός εργοταξίου
  │
  ▼
scanner                ← Καταγραφή παρουσιών σε ένα εργοτάξιο
```

**Site assignments:**
- `admin` → βλέπει όλα, χωρίς explicit assignments
- `project_manager` → N assignments (πολλά εργοτάξια)
- `site_manager` → exactly 1 assignment (enforced by trigger)
- `scanner` → exactly 1 assignment

**Κρίσιμος κανόνας:** Κάθε site μπορεί να έχει **πολλούς scanners** αλλά **μόνο 1 site_manager** (enforced by DB trigger `trg_enforce_one_site_manager`).

---

## 3. Πίνακας Δικαιωμάτων

```
                          │ admin │ project │ site    │ scanner │
                          │       │ manager │ manager │         │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
SITES                     │       │         │         │         │
  Create/Edit/Delete      │   ✓   │    ✗    │    ✗    │    ✗    │
  View (all)              │   ✓   │    ✓*   │    ✗    │    ✗    │
  View (assigned)         │   ✓   │    ✓    │    1    │    1    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
USERS                     │       │         │         │         │
  Create (invite)         │   ✓   │    ✗    │    ✗    │    ✗    │
  View all                │   ✓   │    ✗    │    ✗    │    ✗    │
  View SM/scanner         │   ✓   │    ✓    │    ✗    │    ✗    │
  Edit role               │   ✓   │  SM↔SC  │    ✗    │    ✗    │
  Edit is_active          │   ✓   │  SM/SC  │    ✗    │    ✗    │
  Assign to site          │   ✓   │ δικά†   │    ✗    │    ✗    │
  Deactivate              │   ✓   │  SM/SC  │    ✗    │    ✗    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
WORKERS (εργολάβων)       │       │         │         │         │
  Create/Edit             │   ✓   │    ✗    │    ✓    │    ✗    │
  Delete                  │   ✓   │    ✗    │    ✗    │    ✗    │
  View (admin panel)      │   ✓   │    ✓    │    ✓    │    ✗    │
  Select (RLS/DB)         │   ✓   │    ✓    │    ✓    │    ✓**  │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
WORKERS_COMPANY           │       │         │         │         │
  Create/Edit/Delete      │   ✓   │    ✗    │    ✗    │    ✗    │
  Σημ: Μηχανικοί — δεν   │       │         │         │         │
  συμπεριλαμβάνονται στο  │       │         │         │         │
  ΣΕΠΕ παρουσιολόγιο      │       │         │         │         │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
ADHOC WORKERS             │       │         │         │         │
  Create + check-in       │   ✓   │    ✗    │    ✓    │    ✓    │
  Approve/Reject          │   ✓   │    ✗    │    ✗    │    ✗    │
  View queue              │   ✓   │    ✗    │    ✗    │    ✗    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
ATTENDANCE                │       │         │         │         │
  Check-in                │   ✓   │    ✗    │    ✓    │    ✓    │
  View                    │ όλα   │ sites   │ 1 site  │ 1 site  │
                          │       │ του     │         │         │
  Delete (today, own)     │   ✓   │    ✗    │    ✓    │    ✗    │
  Delete (historical)     │   ✓   │    ✗    │    ✗    │    ✗    │
  Export CSV              │   ✓   │    ✓    │    ✓    │    ✓    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
ΣΕΠΕ ΠΑΡΟΥΣΙΟΛΟΓΙΟ        │       │         │         │         │
  Προβολή / Εκτύπωση      │   ✓   │    ✓    │    ✓    │    ✗    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
SETTINGS (εταιρεία)       │       │         │         │         │
  Read                    │   ✓   │    ✓    │    ✓    │    ✓    │
  Write                   │   ✓   │    ✗    │    ✗    │    ✗    │
──────────────────────────┴───────┴─────────┴─────────┴─────────┘

*  PM βλέπει read-only ΟΛΑ τα sites (για να ξέρει πού είναι assigned ο καθένας)
** Scanner έχει SELECT στη workers table (policy "scanner_select_workers")
†  PM μπορεί να αναθέσει μόνο σε δικά του sites, και μόνο σε
   users που είναι "ελεύθεροι" (χωρίς assignment) ή "δικοί του"
   (assigned σε δικό του site). Users "απασχολημένοι" σε site
   άλλου PM εμφανίζονται ως 🔒 read-only.
```

---

## 4. Database Schema (υλοποιημένο ✅)

### Supabase Credentials
- **Project URL:** `https://ikmwxsfaopjkgajebyyf.supabase.co`
- **Anon Key:** `sb_publishable_mob3KRMf905pSPlm-ASBwQ_Fzh5X3Ax`
- **Service Role Key:** στο Edge Function secret (ποτέ στο frontend)

### Πίνακες

```sql
profiles              ← User metadata (extends auth.users)
sites                 ← Εργοτάξια
workers_company       ← Εταιρικοί υπάλληλοι (μηχανικοί κλπ)
workers               ← Εργαζόμενοι εργολάβων
adhoc_workers         ← Έκτακτοι εργαζόμενοι
user_site_assignments ← Αναθέσεις χρηστών σε εργοτάξια
attendance_log        ← Παρουσίες
settings              ← Ρυθμίσεις συστήματος (key-value)
```

### Πίνακας `sites` — Πλήρη πεδία
```sql
id               serial PRIMARY KEY
project_code     text UNIQUE NOT NULL
name             text NOT NULL
client           text
address          text          ← legacy ενιαίο πεδίο
region           text
start_date       date
end_date         date
is_active        boolean DEFAULT true
created_by       uuid REFERENCES profiles
-- ΣΕΠΕ πεδία (Φάση 7):
permit_number    text          ← Αριθμός οικοδομικής άδειας
address_street   text          ← Οδός
address_number   text          ← Αριθμός
address_city     text          ← Πόλη / Δήμος
efka_branch      text          ← Υποκατάστημα ΕΦΚΑ
efka_agm         text          ← Α.Γ.Μ. έργου στον ΕΦΚΑ
```

### Πίνακας `settings` — Key-value ρυθμίσεις
```sql
key    text PRIMARY KEY
value  text

-- Καταχωρημένα keys:
company_name     ← Επωνυμία εταιρείας
company_afm      ← ΑΦΜ εταιρείας
company_address  ← Διεύθυνση εταιρείας
company_phone    ← Τηλέφωνο
company_email    ← Email επικοινωνίας
company_website  ← Ιστοσελίδα
```

### Helper Functions (SECURITY DEFINER)
```sql
is_admin()                        → boolean
is_project_manager()              → boolean
get_my_role()                     → text
get_my_sites()                    → SETOF int  ← UNION ALL αντί CASE
get_my_site_ids()                 → SETOF int
user_in_my_sites(uuid)            → boolean
user_is_unassigned(uuid)          → boolean
enforce_one_site_manager_per_site → trigger fn
```

### Trigger
```sql
trg_enforce_one_site_manager
  ON user_site_assignments BEFORE INSERT OR UPDATE
  → RAISE EXCEPTION αν ήδη υπάρχει site_manager στο site
```

### RLS Status
- Όλοι οι πίνακες έχουν RLS ενεργό ✅

### RLS Policies — Πλήρης Λίστα

**profiles:**
- `profiles_select_self_admin_or_pm` — self, admin, ή PM βλέπει SM/scanner
- `profiles_admin_write` — admin μόνο
- `profiles_update_pm` — PM αλλάζει SM/scanner που είναι "δικοί του" ή "ελεύθεροι"

**sites:**
- `sites_select` — admin, PM (read-only all), ή μέσω get_my_sites()
- `sites_admin_write` — admin μόνο

**user_site_assignments:**
- `usa_select_self_admin_or_pm` — self, admin, ή PM (βλέπει όλα τα assignments)
- `usa_write_admin_or_pm` — admin, ή PM στα δικά του sites

**workers:**
- `workers_select` — admin, PM, SM
- `scanner_select_workers` — scanner (για manual check-in)
- `workers_insert` / `workers_update` — admin, SM
- `workers_delete_admin` — admin μόνο

**workers_company:**
- `workers_company_admin_all` — admin μόνο

**attendance_log:**
- `attendance_select` — admin ή μέσω get_my_sites()
- `attendance_insert` — admin, SM, scanner + site scope
- `attendance_delete` — admin ή SM/scanner (today-only σε ελληνική ώρα, own site)
- `attendance_update_admin` — admin μόνο

**adhoc_workers:**
- `adhoc_select` — admin ή μέσω get_my_sites()
- `adhoc_insert` — admin, SM, scanner + site scope
- `adhoc_delete_admin` — admin μόνο
- `adhoc_update_admin` — admin μόνο

**settings:**
- `settings_select_all` — όλοι οι authenticated users (χρειάζεται για ΣΕΠΕ)
- `settings_admin_write` — admin μόνο

### PostgREST FK Hints (σημαντικό!)
```javascript
// workers_company → profiles (δύο σχέσεις)
.select('*, profiles!company_worker_id(id, email, role)')

// profiles → user_site_assignments (δύο σχέσεις)
.select('user_site_assignments!user_id(site_id, sites(...))')
```

---

## 5. Authentication & Email

### Flow
- **Login:** email/password → `login.html`
- **Invite:** admin → Edge Function → `supabase.auth.admin.inviteUserByEmail()` → email → `set-password.html`
- **Password Reset:** `login.html` → forgot password → email → `set-password.html`

### Supabase Auth Settings
- Enable signups: **OFF** (μόνο invite)
- Confirm email: **ON**
- Site URL: `https://ncheilak.github.io/SiteLog`
- Redirect URLs: `https://ncheilak.github.io/SiteLog/**`, `http://localhost:5500/**`

### Email (Free Tier)
- Supabase built-in: 3 emails/ώρα (αρκεί για production με invite flow)
- Emails: Invite + Password Reset (built-in templates)

### set-password.html — Κρίσιμη λεπτομέρεια
Ο Supabase διαγράφει το URL hash (`#type=invite&access_token=...`) πριν προλάβει να το διαβάσει το JS. Λύση:
```html
<!-- ΠΡΙΝ το supabase CDN script -->
<script>
  window._hashType = new URLSearchParams(window.location.hash.slice(1)).get('type');
</script>
```

---

## 6. Edge Functions

### `invite-user`
- **URL:** `https://ikmwxsfaopjkgajebyyf.supabase.co/functions/v1/invite-user`
- **Verify JWT:** OFF (κάνει δικό της auth check)
- **Secret:** `SUPABASE_SERVICE_ROLE_KEY` (αυτόματο από Supabase)

**Flow:**
```
Frontend (admin JWT) → Edge Function
  1. Verify caller είναι admin (callerClient με RLS)
  2. inviteUserByEmail() (adminClient με service_role)
  3. INSERT INTO profiles
  4. INSERT INTO user_site_assignments
  (Rollback: deleteUser αν αποτύχει το profile insert)
```

**Input:**
```json
{ "email", "fullName", "role", "workerId", "siteIds": [] }
```

---

## 7. File Structure (τρέχουσα κατάσταση)

```
SiteLog/
│
├── shared/
│   └── auth.js                    ✅ Κοινή βιβλιοθήκη auth
│
├── login.html                     ✅ Entry point
├── set-password.html              ✅ Invite + password reset landing
├── index.html                     ✅ Role-aware dashboard (κάρτες A1–A5)
│
├── admin-sites.html               ✅ Λίστα εργοταξίων (admin only)
├── admin-site-edit.html           ✅ Create/edit εργοταξίου + ΣΕΠΕ πεδία
├── admin-company-workers.html     ✅ Λίστα εταιρικών υπαλλήλων
├── admin-company-worker-edit.html ✅ Create/edit υπαλλήλου
├── admin-users.html               ✅ Users + invite + assignments (admin + PM)
├── admin-adhoc-queue.html         ✅ Έγκριση/απόρριψη έκτακτων εργαζομένων
├── admin-settings.html            ✅ Στοιχεία εταιρείας (Φάση 7)
│
├── 0-worker-compiler-gr.html      ✅ Καταχώρηση εργαζομένων
├── 1-qr-generator-gr.html         ✅ QR badges
├── 2-attendance-gr.html           ✅ Παρουσιολόγιο + κουμπί ΣΕΠΕ (Φάση 7)
├── 3-scanner-app-gr.html          ✅ Σαρωτής QR
├── reports.html                   ✅ Αναφορές εργατοημερών
├── sepe-report.html               ✅ ΣΕΠΕ Ημερήσιο Παρουσιολόγιο (Φάση 7)
│
└── supabase/
    └── functions/
        └── invite-user/
            └── index.ts           ✅ Edge Function (deployed)
```

### Λογική εργαλείων (workflow σειρά)
```
0-worker-compiler  → Καταχώρηση εργαζομένων στη βάση
1-qr-generator     → Δημιουργία & εκτύπωση QR badges
3-scanner-app      → Live check-in με σάρωση QR
2-attendance       → Προβολή & εξαγωγή παρουσιολογίου
sepe-report        → ΣΕΠΕ Ημερήσιο Παρουσιολόγιο (εκτύπωση / PDF)
```

### Πρόσβαση ανά εργαλείο
```
0-worker-compiler  → requireRole(['admin', 'site_manager'])
1-qr-generator     → requireRole(['admin', 'site_manager'])
3-scanner-app      → requireLogin() (admin, SM, scanner)
2-attendance       → requireLogin() (όλοι οι ρόλοι)
reports            → requireRole(['admin', 'project_manager', 'site_manager'])
sepe-report        → requireRole(['admin', 'project_manager', 'site_manager'])
admin-users        → requireRole(['admin', 'project_manager'])
admin-settings     → requireRole(['admin'])
```

### shared/auth.js — Public API
```javascript
window.sb                                // Supabase client (window global)
Auth.initAuth()                          // cache profile + assignments
Auth.requireLogin()                      // redirect αν δεν είναι logged in
Auth.requireRole(['admin', ...])         // redirect αν λάθος role
Auth.getCurrentUser()                    // { id, email, full_name }
Auth.getCurrentRole()                    // 'admin'|'project_manager'|...
Auth.getRoleLabel()                      // 'Διαχειριστής'|...
Auth.getAssignedSites()                  // [{ id, name, project_code }]
Auth.isAdmin()                           // boolean
Auth.canDeleteAttendance(siteId, logDate) // boolean
Auth.signOut()                           // clear + redirect login
```

---

## 8. PM Permissions — Σχεδιαστική Λογική

### Τριπλή κατηγοριοποίηση χρηστών (για PM)
```
ΕΛΕΥΘΕΡΟΣ  = site_manager/scanner χωρίς assignment
           → PM μπορεί: edit role, is_active, assign σε δικό του site

ΔΙΚΟΣ ΜΟΥ = assigned σε site δικό μου
           → PM μπορεί: edit role, is_active, αφαίρεση/αλλαγή site

ΑΛΛΟΥ PM   = assigned σε site που δεν ελέγχω
           → PM βλέπει read-only (🔒 Απασχολημένος)
           → Για να τον πάρει: ο admin τον αναθέτει, ή ο άλλος PM τον αφήνει
```

### Τι μπορεί να κάνει ο PM στο admin-users:
- Βλέπει **όλους** τους site_manager/scanner (ενεργούς + ανενεργούς)
- Αλλάζει ρόλο **μεταξύ** site_manager ↔ scanner
- Ενεργοποιεί/απενεργοποιεί (is_active toggle)
- Αναθέτει σε **δικά του** sites μόνο
- ΔΕΝ βλέπει admin ή project_manager
- ΔΕΝ μπορεί να κάνει invite (admin-only)
- ΔΕΝ αγγίζει users "Απασχολημένους" σε site άλλου PM

### RLS enforcement (πέρα από UI)
- `profiles_update_pm` — αποτρέπει update σε users που δεν είναι δικοί ή ελεύθεροι
- `usa_write_admin_or_pm` — αποτρέπει write σε sites άλλου PM
- `trg_enforce_one_site_manager` — αποτρέπει 2ο SM σε ίδιο site

---

## 9. Bootstrap Πρώτου Admin (ολοκληρωμένο ✅)

```
1. Supabase Dashboard → Authentication → Add user (auto confirm)
   UUID: 38114f8a-7b1a-40d8-9d2b-da50d68e5794

2. SQL Editor:
   INSERT INTO profiles (id, email, full_name, role, is_active)
   VALUES ('38114f8a-...', 'ncheilakos@gmail.com', 'Admin', 'admin', true);
```

---

## 10. Roadmap Υλοποίησης

```
┌─────────────────────────────────────────────────────────────┐
│ ΦΑΣΗ 1 — Foundation                                ✅ DONE  │
│   SQL schema + RLS + helper functions                        │
│   shared/auth.js                                             │
│   login.html + set-password.html                             │
│   index.html (role-aware)                                    │
│   Bootstrap πρώτου admin                                     │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 2 — Admin panels                              ✅ DONE  │
│   admin-sites.html + admin-site-edit.html                    │
│   admin-company-workers.html                                 │
│   admin-company-worker-edit.html                             │
│   admin-users.html (με invite flow + assignments)            │
│   Edge Function: invite-user                                 │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 3 — Lock-down + PM permissions                ✅ DONE  │
│   Auth guard + window.sb σε όλα τα εργαλεία                 │
│   0-worker-compiler → requireRole([admin, site_manager])     │
│   1-qr-generator    → requireRole([admin, site_manager])     │
│   2-attendance      → requireLogin() + site-scoped dropdown  │
│   3-scanner-app     → requireLogin() + site-scoped           │
│                        auto-select, JOIN log, adhoc button    │
│   Header: user pill + sign-out σε όλα                       │
│   Site pill: project_code · name                             │
│   Delete buttons: κρυμμένα για scanner                       │
│   RLS fixes:                                                 │
│     - scanner_select_workers                                 │
│     - get_my_sites() rewrite (UNION ALL)                     │
│     - profiles_select/update PM policies                     │
│     - usa_select PM visibility                               │
│     - sites_select PM read-only all                          │
│     - user_in_my_sites() + user_is_unassigned() helpers      │
│     - trg_enforce_one_site_manager trigger                   │
│   admin-users.html: PM UI                                    │
│     - Βλέπει SM/scanner (ελεύθερος/δικός/απασχολημένος)     │
│     - Αλλαγή ρόλου SM↔scanner                               │
│     - Ενεργοποίηση/απενεργοποίηση                           │
│     - Assignment μόνο σε δικά sites                          │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 4 — Adhoc workers                             ✅ DONE  │
│   Scanner: φόρμα έκτακτης καταχώρησης (όλα τα πεδία)        │
│   admin-adhoc-queue.html (approve/reject/promote)            │
│   Badge στο admin index (ήδη υλοποιημένο στο index.html)    │
│   Adhoc workers συμπεριλαμβάνονται στο παρουσιολόγιο        │
│   2-attendance-gr.html: JOIN adhoc_workers, tag ΕΚΤ, CSV    │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 5 — Delete permissions & testing              ✅ DONE  │
│   Κουμπί "Καθαρισμός" αφαιρέθηκε τελείως                    │
│   Delete per εγγραφή: admin, SM, scanner (today-only)        │
│   Custom confirmation modal (2 βήματα, αντί window.confirm)  │
│   RLS attendance_delete: προστέθηκε scanner role             │
│   RLS timezone fix: CURRENT_DATE → AT TIME ZONE              │
│     'Europe/Athens' (χειμώνας UTC+2 / καλοκαίρι UTC+3)      │
│   Testing matrix: όλα τα scenarios επαληθεύτηκαν            │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 6 — Reporting                                 ✅ DONE  │
│   reports.html — εργατοημέρες ανά εργολάβο / μήνα / site    │
│   Access: admin, project_manager, site_manager               │
│   Φίλτρα: site dropdown (κρυφό για SM) + Από/Έως            │
│   Default "Από": start_date του site (auto-load)             │
│   Default "Έως": σήμερα (τοπική ώρα)                        │
│   Αποτέλεσμα: κάρτα ανά εργολάβο (φθίνουσα σειρά)          │
│   Κελιά ανά μήνα με κλικ → CSV λήψη                         │
│   CSV περιέχει: site, εργολάβο, ημέρα/αριθμό εργατών (Χ=0) │
│   Flatpickr datepicker: DD/MM/YYYY παντού                    │
│   isoToLocalDate(): αποφυγή UTC offset bug                   │
│   Νέα κάρτα "📊 Εργατοημέρες" στο index.html                │
├─────────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 7 — ΣΕΠΕ Παρουσιολόγιο + Company Settings    ✅ DONE  │
│                                                              │
│   DB:                                                        │
│     ALTER TABLE sites ADD COLUMNS:                           │
│       permit_number, address_street, address_number,         │
│       address_city, efka_branch, efka_agm                    │
│     CREATE TABLE settings (key, value) + RLS                 │
│       Keys: company_name, company_afm, company_address,      │
│             company_phone, company_email, company_website     │
│                                                              │
│   admin-site-edit.html:                                      │
│     Νέο section "Στοιχεία ΣΕΠΕ / ΕΦΚΑ"                      │
│     Πεδία: permit_number, address_street/number/city,        │
│            efka_branch, efka_agm                             │
│                                                              │
│   admin-settings.html (νέο):                                 │
│     Στοιχεία εταιρείας: Επωνυμία, ΑΦΜ, Διεύθυνση,          │
│     Τηλέφωνο, Email, Ιστοσελίδα                              │
│     Upsert στη settings table · Admin-only                   │
│     Κάρτα A5 στο index.html                                  │
│                                                              │
│   sepe-report.html (νέο):                                    │
│     Φίλτρα: 1 εργοτάξιο + 1 ημερομηνία                      │
│     Φορτώνει παράλληλα: settings + site + attendance         │
│     Header κειμένου ακριβώς όπως ΒΗΔΑΠ έντυπο               │
│     Στήλες: Α/Α, Επώνυμο/Όνομα/Πατρώνυμο, ΑΜΑ, ΑΜΚΑ,      │
│       ΑΦΜ, Αρ.Αδ.Εργασίας, Ειδικότητα, Φάση,               │
│       Εργολάβος(ΑΦΜ), Ώρα Έναρξης,                          │
│       [κενά]: Ώρα Λήξης, Μικτό Ημερομίσθιο,                │
│       Ημ/νία Πρόσληψης, Ημέρα Αναπαύσεως,                   │
│       Υπογραφή Εργαζομένου                                   │
│     Min 15 γραμμές (κενές για χειρόγραφο)                    │
│     Print: A4 landscape · @media print · χωρίς UI chrome     │
│     Access: admin, project_manager, site_manager             │
│                                                              │
│   2-attendance-gr.html:                                      │
│     Fix ημερομηνίας: YYYY-MM-DD → DD/MM/YYYY                 │
│     (table + CSV export)                                     │
│     Κουμπί "📋 ΣΕΠΕ" → sepe-report.html                     │
│     (περνά site + date ως URL params)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Φινίρισμα (εκκρεμή)

**Κοινό CSS (`shared/theme.css`)**
Εξαγωγή κοινών styles σε ένα αρχείο.
Απαιτεί πλήρη εικόνα όλων των σελίδων.

**Rename αρχείων**
```
0-worker-compiler-gr.html  → workers.html
1-qr-generator-gr.html     → qr-generator.html
2-attendance-gr.html       → attendance.html
3-scanner-app-gr.html      → scanner.html
```
Τελευταίο — σπάει existing bookmarks/links.

**Scanner UI — "Trades" badge**
Candidate για αφαίρεση. "Companies" παραμένει.

---

## 12. Γνωστά Bugs & Fixes

| Πρόβλημα | Αιτία | Fix |
|---|---|---|
| "more than one relationship" σε workers_company | Δύο FKs μεταξύ workers_company↔profiles | `profiles!company_worker_id(...)` |
| "more than one relationship" σε profiles | Δύο FKs μεταξύ profiles↔user_site_assignments | `user_site_assignments!user_id(...)` |
| "infinite recursion" σε user_site_assignments | RLS policy subquery στον ίδιο πίνακα | `get_my_site_ids()` SECURITY DEFINER |
| set-password δεν έδειχνε φόρμα | Supabase σβήνει hash πριν JS | `window._hashType` capture πριν CDN |
| Edge Function bundle error | Import `_shared/cors.ts` | Inline corsHeaders |
| Scanner δεν φόρτωνε workers | RLS SELECT denied για scanner | Policy `scanner_select_workers` |
| Scanner log κενά ονόματα | loadTodayLog εμπλούτιζε από workerDB | loadTodayLog με JOIN |
| Scanner delete buttons σε scanner role | UI δεν ελέγχε ρόλο | `_canDelete` flag |
| "more than one row" για PM με 2+ sites | `get_my_sites()` CASE = scalar | Rewrite με UNION ALL |
| PM βλέπει "ελεύθερο" user assigned αλλού | `user_site_assignments` SELECT restricted | `usa_select_self_admin_or_pm` policy |
| PM δεν βλέπει sites άλλων PM (JOIN null) | `sites_select` restricted | PM read-only all sites |
| Δύο site_managers στο ίδιο site | Κανένα DB constraint | Trigger `trg_enforce_one_site_manager` |
| Scanner μπορούσε να σβήσει χθεσινές παρουσίες | `CURRENT_DATE` = UTC, όχι ελληνική ώρα | `CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Athens'` στο attendance_delete |
| Scanner δεν μπορούσε να διαγράψει καθόλου | RLS attendance_delete δεν περιλάμβανε scanner | Προστέθηκε `scanner` στο `get_my_role() IN (...)` |
| Date inputs σε MM/DD/YYYY (browser locale) | Native `<input type="date">` χρησιμοποιεί OS locale | Αντικατάσταση με Flatpickr + `locale:'gr'` |
| Flatpickr έδειχνε λάθος ημερομηνία (+2 μήνες) | `setDate(isoString)` ερμηνεύεται ως UTC → offset +3h | `isoToLocalDate()`: `new Date(y, m-1, d)` για τοπική ώρα |
| Ημερομηνία παρουσιολογίου σε YYYY-MM-DD | `log_date` έρχεται από Supabase ως ISO | `fmtDate()` helper: `new Date(y,m-1,d)` → DD/MM/YYYY |

---

## 13. Τεχνικές Αποφάσεις

- **Νέο Supabase project** (όχι migration) — καθαρό ξεκίνημα
- **GitHub Pages** για hosting — zero cost, zero config
- **Supabase Edge Functions** για invite (service_role δεν μπαίνει στο frontend)
- **SECURITY DEFINER functions** για helper functions — αποφυγή RLS recursion
- **Soft delete** (is_active=false) για sites και users — διατήρηση δεδομένων
- **Auto-generated IDs**: `EMP-0001` (workers_company), `W-1001` (workers), `AH-1001` (adhoc)
- **PostgREST FK hints** απαραίτητα όπου υπάρχουν πολλαπλές σχέσεις
- **window.sb** — ενιαίος authenticated client από auth.js
- **Auth cache** — profile + assignments φορτώνονται μία φορά, επαναχρησιμοποιούνται
- **loadTodayLog με JOIN** — scanner φέρνει worker data ανεξάρτητα από workerDB
- **Shared CSS**: αποφασίστηκε για φινίρισμα
- **PM two-tier management**: admin = system-level, PM = project-level
- **Τριπλή κατηγοριοποίηση**: ελεύθερος / δικός μου / απασχολημένος (UI + RLS)
- **DB trigger** για 1-SM-per-site — reliability πέρα από UI validation
- **Flatpickr** αντί για native `<input type="date">` — DD/MM/YYYY παντού
- **isoToLocalDate()** — `new Date(y, m-1, d)` αντί για ISO string parsing, αποφυγή UTC offset
- **settings table (key-value)** — στοιχεία εταιρείας ανεξάρτητα από εργοτάξια, εύκολη επέκταση
- **Promise.all()** στο sepe-report — παράλληλη φόρτωση settings + site + attendance
- **@media print A4 landscape** — εκτύπωση/PDF απευθείας από browser, χωρίς server

---

## 14. Μελλοντικές Επεκτάσεις (εκτός scope v3.0)

- Custom SMTP (Resend) για περισσότερα emails/ώρα
- Notifications για αναθέσεις / adhoc pending
- **Mobile PWA για scanner** — εικονίδιο στην αρχική οθόνη, full screen, χωρίς browser chrome (manifest.json + service worker)
- Bulk CSV import για workers_company
