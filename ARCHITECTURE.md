# SiteLog v3.0 — Architecture Document

> **Σκοπός:** Αποτύπωση όλων των αρχιτεκτονικών αποφάσεων για την εξέλιξη του SiteLog από v2.0 σε v3.0 (multi-user, role-based, με authentication).
>
> **Κατάσταση:** Σχεδιαστική φάση ολοκληρωμένη. Έτοιμο για υλοποίηση Φάσης 1.

---

## 1. Επισκόπηση

Το SiteLog v2.0 είναι ένα single-user εργαλείο καταγραφής παρουσίας εργοταξίου (5 HTML αρχεία + Supabase). Η v3.0 το μετατρέπει σε **multi-user σύστημα** με:

- Authentication (email/password)
- 4 ρόλους με διαφορετικά δικαιώματα
- Πολλαπλά εργοτάξια με αναθέσεις χρηστών
- Έκτακτους εργαζόμενους με approval workflow
- Row-Level Security στη βάση

### Απόφαση για τη βάση

**Νέο Supabase project** (όχι migration του υπάρχοντος). Καθαρό ξεκίνημα από μηδέν.

---

## 2. Ιεραρχία Ρόλων

```
admin                  ← Πλήρης έλεγχος συστήματος
  │
  ▼
project_manager        ← Εποπτεία πολλών εργοταξίων (view-only)
  │
  ▼
site_manager           ← Διαχείριση ενός εργοταξίου
  │
  ▼
scanner                ← Καταγραφή παρουσιών σε ένα εργοτάξιο
```

**Authentication:** Supabase Auth με email/password + invite link flow.

**Site assignments:**
- `admin` → βλέπει όλα, χωρίς explicit assignments
- `project_manager` → N assignments (πολλά εργοτάξια)
- `site_manager` → exactly 1 assignment
- `scanner` → exactly 1 assignment

---

## 3. Πίνακας Δικαιωμάτων

```
                          │ admin │ project │ site    │ scanner │
                          │       │ manager │ manager │         │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
SITES                     │       │         │         │         │
  Create/Edit/Delete      │   ✓   │    ✗    │    ✗    │    ✗    │
  View                    │ όλα   │  πολλά  │   1     │   1     │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
USERS                     │       │         │         │         │
  Create/Edit/Deactivate  │   ✓   │    ✗    │    ✗    │    ✗    │
  Assign mgr/scanner      │   ✓   │    ✓    │    ✗    │    ✗    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
WORKERS (εργολάβων)       │       │         │         │         │
  Create/Edit             │   ✓   │    ✗    │    ✓    │    ✗    │
  Delete                  │   ✓   │    ✗    │    ✗    │    ✗    │
  View                    │   ✓   │    ✓    │    ✓    │    ✗    │
──────────────────────────┼───────┼─────────┼─────────┼─────────┤
WORKERS_COMPANY           │       │         │         │         │
  Create/Edit/Delete      │   ✓   │    ✗    │    ✗    │    ✗    │
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
──────────────────────────┴───────┴─────────┴─────────┴─────────┘
```

### Ειδικοί κανόνες

- **Site manager delete:** Μόνο `log_date = CURRENT_DATE`, μόνο δικό του site, με διπλό confirmation στο UI.
- **Project manager assignments:** Μπορεί να αναθέτει ΥΠΑΡΧΟΝΤΕΣ managers/scanners στα δικά του sites — δεν δημιουργεί users, δεν αναθέτει άλλους project_managers.
- **Scanner visibility:** Βλέπει ΟΛΕΣ τις παρουσίες του site του (και άλλων χρηστών).

---

## 4. Database Schema

### 4.1 `sites` — Εργοτάξια

```sql
sites
├── id              int PK (serial)
├── project_code    text UNIQUE NOT NULL    -- "ετικέτα"
├── name            text NOT NULL           -- "ετικέτα"
├── client          text                    -- "ετικέτα"
├── address         text                    -- για καρτέλα εποπτείας
├── region          text                    -- για καρτέλα εποπτείας
├── start_date      date                    -- για καρτέλα εποπτείας
├── end_date        date                    -- για καρτέλα εποπτείας
├── is_active       bool default true
├── created_at      timestamptz default now()
└── created_by      UUID FK→profiles
```

**Σχεδιαστική σημείωση:** `project_code`, `name`, `client` χρησιμοποιούνται ως "ετικέτες" σε dropdowns και λίστες. Τα υπόλοιπα εμφανίζονται μόνο στην καρτέλα εποπτείας (μελλοντικό feature).

**Μελλοντικά πεδία** μπορούν να προστεθούν εύκολα με `ALTER TABLE ADD COLUMN`.

### 4.2 `workers` — Εργαζόμενοι Εργολάβων

```sql
workers
├── id              text PK (π.χ. W-1001)
├── ama             text
├── amka            text
├── afm             text
├── ar_ad_ergasias  text
├── eponimo         text
├── onoma           text
├── patronimo       text
├── eidikotita      text
├── default_phase   text
├── is_multi_phase  bool default false
├── ergolabos       text
├── afm_ergolabou   text
└── registered_at   timestamptz default now()
```

**Παραμένει ίδιος με v2.0** (παλαιό schema).

### 4.3 `adhoc_workers` — Έκτακτοι Εργαζόμενοι

```sql
adhoc_workers
├── id                  text PK (π.χ. AH-1001)
├── ama                 text
├── amka                text
├── afm                 text
├── ar_ad_ergasias      text
├── eponimo             text
├── onoma               text
├── patronimo           text
├── eidikotita          text
├── default_phase       text
├── is_multi_phase      bool default false
├── ergolabos           text
├── afm_ergolabou       text
│ ── Metadata ─────────────────────────────
├── site_id             int FK→sites       -- πού καταχωρήθηκε
├── created_by          UUID FK→profiles   -- ποιος κατέγραψε
├── registered_at       timestamptz default now()
├── status              text ('pending'|'approved'|'rejected')
├── reviewed_by         UUID FK→profiles   -- admin
├── reviewed_at         timestamptz
└── promoted_worker_id  text FK→workers.id -- αν έγινε approve
```

### 4.4 `workers_company` — Δικοί μας Υπάλληλοι

```sql
workers_company
├── id              text PK (π.χ. EMP-0001)
│ ── Βασικά στοιχεία ──────────────────────
├── ama             text
├── amka            text
├── afm             text
├── eponimo         text
├── onoma           text
├── patronimo       text
├── eidikotita      text
│ ── Επαγγελματική επικοινωνία ────────────
├── email           text UNIQUE (nullable) -- για invite link
├── phone_work      text (nullable)
│ ── Προσωπική επικοινωνία ────────────────
├── phone_personal  text (nullable)
│ ── Metadata ─────────────────────────────
├── is_active       bool default true
├── created_at      timestamptz default now()
└── created_by      UUID FK→profiles
```

**Σχεδιαστικές σημειώσεις:**
- ΔΕΝ έχει `ar_ad_ergasias` (αφορά μόνο εργολάβους)
- ΔΕΝ κάνουν check-in (δεν εμφανίζονται στο παρουσιολόγιο)
- Πηγή για δημιουργία managers/scanners (επιλογή από dropdown στο `admin-users.html`)
- Email nullable για εγγραφή χωρίς εταιρικό email
- Για user account απαιτείται email

### 4.5 `profiles` — User Metadata

```sql
profiles
├── id                  UUID PK, FK→auth.users
├── email               text
├── full_name           text
├── role                text ('admin'|'project_manager'|
│                             'site_manager'|'scanner')
├── is_active           bool default true
├── company_worker_id   text FK→workers_company.id (nullable)
├── created_at          timestamptz default now()
└── created_by          UUID FK→profiles
```

**Σημείωση:** `company_worker_id` είναι nullable γιατί ο πρώτος admin (bootstrap) δεν έχει αντίστοιχη εγγραφή στο `workers_company`. Όλοι οι υπόλοιποι users (project_manager, site_manager, scanner) θα έχουν link.

### 4.6 `user_site_assignments` — Αναθέσεις

```sql
user_site_assignments
├── user_id         UUID FK→profiles
├── site_id         int FK→sites
├── assigned_at     timestamptz default now()
├── assigned_by     UUID FK→profiles
└── PRIMARY KEY (user_id, site_id)
```

**Cardinality:**
- admin → 0 rows
- project_manager → 1+ rows
- site_manager → exactly 1 row
- scanner → exactly 1 row

Ο έλεγχος cardinality γίνεται στο UI (admin-users.html).

### 4.7 `attendance_log` — Παρουσίες

```sql
attendance_log
├── id                  int8 PK (generated always as identity)
├── worker_id           text FK→workers (nullable)
├── adhoc_worker_id     text FK→adhoc_workers (nullable)
├── site_id             int FK→sites
├── time_in             text (HH:MM)
├── log_date            date
├── fasi                text
├── created_by          UUID FK→profiles
├── created_at          timestamptz default now()
│
└── CHECK: exactly one of (worker_id, adhoc_worker_id) is NOT NULL
```

**Κρίσιμο:** Κάθε εγγραφή δείχνει σε **είτε** `workers` **είτε** `adhoc_workers`, ποτέ και στα δύο, ποτέ σε κανένα.

---

## 5. Authentication Flow

### 5.1 Δημιουργία χρήστη (από admin)

```
Admin → admin-users.html
      ├── Διαλέγει υπάλληλο από workers_company
      ├── Ορίζει role (project_manager|site_manager|scanner)
      └── (Optional) Ανάθεση σε site(s)
           │
           ▼
   Supabase: auth.admin.inviteUserByEmail()
           │
           ▼
   Email στον υπάλληλο:
   "Δημιουργήθηκε λογαριασμός SiteLog — όρισε τον κωδικό σου"
           │
           ▼
   set-password.html → ορισμός κωδικού → login
```

### 5.2 Lifecycle δικού μας υπαλλήλου

```
1. Εισαγωγή στη βάση (workers_company)
   └── admin-company-workers.html
   Κατάσταση: εργαζόμενος ✓, user ✗, role ✗, site ✗

2. (Αργότερα) Δημιουργία user account
   └── admin-users.html → invite email
   Κατάσταση: εργαζόμενος ✓, user ✓ (pending), role ✓, site ✗

3. Υπάλληλος θέτει password (μέσω email link)
   Κατάσταση: user ✓ (active). Αν login χωρίς site →
   "Δεν έχεις ανάθεση σε εργοτάξιο ακόμα."

4. (Αργότερα) Ανάθεση σε εργοτάξιο
   └── admin-users.html → assign to site
   Admin ενημερώνει εξωτερικά (τηλέφωνο/Viber), ΚΑΜΙΑ email notification.
   Κατάσταση: πλήρως ενεργός.
```

### 5.3 Password management

- **Ορισμός αρχικού:** Invite link email → set-password.html (Supabase built-in)
- **Αλλαγή:** Κουμπί "Αλλαγή Password" στο user menu (Supabase built-in)
- **Reset:** Link "Ξεχάσατε τον κωδικό;" στο login.html (Supabase built-in)

---

## 6. Adhoc Worker Lifecycle

```
[ΕΡΓΟΤΑΞΙΟ] scanner/site_manager                [ADMIN]
     │
     ▼
  Χρειάζεται έκτακτη καταχώρηση
     │
     ▼
  Συμπληρώνει πλήρη φόρμα (όλα τα πεδία workers)
     │
     ▼
  INSERT INTO adhoc_workers
    status='pending'
    site_id=τρέχον
    created_by=τρέχων user
     │
     ▼
  INSERT INTO attendance_log
    adhoc_worker_id=νέο id
    (ο εργαζόμενος δουλεύει κανονικά — η παρουσία μετράει)
     │
     └──────► admin-index.html badge: +1 pending
                                                 │
                                                 ▼
                                           [Admin Panel]
                                           admin-adhoc-queue.html
                                                 │
                                    ┌────────────┼────────────┐
                                    ▼                         ▼
                              [APPROVE]                  [REJECT]
                                    │                         │
                                    ▼                         ▼
                         1. INSERT INTO workers      UPDATE adhoc_workers
                            (copy όλα τα πεδία)       SET status='rejected'
                         2. UPDATE adhoc_workers          reviewed_by=admin
                            SET status='approved'         reviewed_at=now
                                promoted_worker_id=new
                                reviewed_by=admin
                                reviewed_at=now
                         3. UPDATE attendance_log
                            SET worker_id=new_id
                                adhoc_worker_id=NULL
                            WHERE adhoc_worker_id=old
                         4. DELETE FROM adhoc_workers
                            WHERE id=old_id
```

**Κρίσιμο:** Η παρουσία ΔΕΝ χάνεται ποτέ. Μετά το approve, τα references στο `attendance_log` μεταφέρονται από `adhoc_worker_id` σε `worker_id`.

**Rejected records:** Παραμένουν στο `adhoc_workers` με status='rejected' για audit trail (δεν διαγράφονται).

---

## 7. Email Strategy

### Δρόμος 2 — Minimal (built-in Supabase only)

**Τι στέλνει το σύστημα αυτόματα:**
- Invite email (Supabase built-in, customized template)
- Password reset email (Supabase built-in)
- Email change confirmation (Supabase built-in)

**Τι ΔΕΝ στέλνει:**
- Ειδοποιήσεις ανάθεσης σε εργοτάξιο
- Ειδοποιήσεις αλλαγής ρόλου
- Ειδοποιήσεις για νέα pending adhoc workers

**Περιεχόμενο invite email:**
```
Subject: Δημιουργία λογαριασμού SiteLog

Καλωσήρθες [Όνομα],
Σου δημιουργήθηκε λογαριασμός στο SiteLog.
Για να ξεκινήσεις, όρισε τον κωδικό σου:
[Ορισμός Κωδικού]  (λήγει σε 24 ώρες)

Σημείωση: ΔΕΝ περιέχει στοιχεία εργοταξίου ή ρόλου —
η ανάθεση γίνεται αργότερα και εκτός συστήματος email.
```

### Σημείωση για free tier

- Supabase free: 3 emails/ώρα (testing only)
- Για παραγωγική χρήση: custom SMTP (Resend free = 3.000/μήνα)

---

## 8. Row-Level Security (RLS) Policies

### Ενεργοποίηση RLS σε όλους τους πίνακες

```sql
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers_company       ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_workers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_log        ENABLE ROW LEVEL SECURITY;
```

### Helper function

```sql
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

(Και παρόμοιες: `is_project_manager()`, `get_my_role()`, `get_my_sites()`)

### Σύνοψη πολιτικών

```
TABLE               │ SELECT                    │ INS/UPD/DEL
────────────────────┼───────────────────────────┼──────────────────────
profiles            │ self + admin (all)        │ admin only
user_site_          │ self + admin              │ admin + project_manager
  assignments       │                           │   (για δικά του sites)
sites               │ admin: all                │ admin only
                    │ others: assigned          │
workers             │ all authenticated         │ INS/UPD: admin+manager
                    │ (εκτός scanner)           │ DEL: admin only
workers_company     │ admin only                │ admin only
adhoc_workers       │ admin: all                │ INS: all auth + site match
                    │ others: own site          │ UPD/DEL: admin only
attendance_log      │ admin: all                │ INS: all auth + site match
                    │ others: own site          │ DEL: admin always,
                    │                           │      manager (own+today)
```

---

## 9. File Structure

```
sitelog/
├── login.html                     ← ΝΕΟ · entry point
├── set-password.html              ← ΝΕΟ · landing από invite
├── index.html                     ← UPD · role-aware + adhoc badge
│
├── 0-worker-compiler-gr.html      ← UPD · auth guard (admin+manager)
├── 1-qr-generator-gr.html         ← UPD · auth guard (admin+manager)
├── 2-attendance-gr.html           ← UPD · site-scoped filter
├── 3-scanner-app-gr.html          ← UPD · auto-site + adhoc + today-delete
│
├── admin-sites.html               ← ΝΕΟ · admin only
├── admin-company-workers.html     ← ΝΕΟ · admin only
├── admin-users.html               ← ΝΕΟ · admin + project_manager
├── admin-adhoc-queue.html         ← ΝΕΟ · admin only
│
├── site-dashboard.html            ← ΜΕΛΛΟΝ · καρτέλα εποπτείας
│
└── shared/
    └── auth.js                    ← ΝΕΟ · shared library
```

### shared/auth.js — Public API

```javascript
initAuth(db)                         // cache profile + assignments
requireLogin()                       // redirect if not logged in
requireRole(['admin', ...])          // redirect if role mismatch
getCurrentUser()                     // { id, email, full_name }
getCurrentRole()                     // 'admin'|'project_manager'|...
getAssignedSites()                   // [ { id, name, project_code }, ... ]
isAdmin()                            // boolean
canDeleteAttendance(siteId, logDate) // boolean
signOut()                            // clear session + redirect
```

---

## 10. Καρτέλα Εποπτείας Εργοταξίου (μελλοντικό feature)

Σελίδα: `site-dashboard.html?site_id=X`

**Πρόσβαση:** admin (όλα), project_manager (δικά του), site_manager (το δικό του). Scanner δεν βλέπει.

**Ενότητες:**

```
📋 Γενικά Στοιχεία
   Κωδικός Έργου, Πελάτης, Ονομασία,
   Διεύθυνση/Περιοχή, Εκκίνηση, Προβλ. Ολοκλήρωση
   (όλα από sites table)

👷 Εργαζόμενοι
   • Σύνολο ενεργών (COUNT distinct workers με παρουσία <30d)
   • Ανά εργολάβο (GROUP BY workers.ergolabos)
   • Έκτακτοι σε αναμονή (COUNT adhoc_workers pending)

📊 Παρουσίες
   • Σήμερα / Εβδομάδα / Μήνα (COUNT attendance_log)
   • Στατιστικά ανά φάση (GROUP BY fasi)

👥 Υπεύθυνοι
   • Project Manager(s) (από user_site_assignments)
   • Site Manager
   • Scanners
```

**Σημαντικό:** Όλα τα στοιχεία των 3 τελευταίων ενοτήτων είναι COMPUTED — δεν χρειάζονται δικά τους πεδία στη βάση.

---

## 11. Bootstrap Πρώτου Admin (one-time)

```
Supabase Dashboard:
  1. Authentication → Add user → email + password
  2. SQL Editor:
     INSERT INTO profiles (id, email, full_name, role, is_active)
     VALUES ('<uuid-from-step-1>', 'admin@domain.com',
             'Admin Name', 'admin', true);

Από εκεί και μετά: ΚΑΜΙΑ επαφή με το Supabase UI.
```

---

## 12. Roadmap Υλοποίησης

```
┌─────────────────────────────────────────────────────────┐
│ ΦΑΣΗ 1 — Foundation                                      │
│   SQL: όλοι οι πίνακες + basic RLS                      │
│   shared/auth.js                                         │
│   login.html + set-password.html                         │
│   index.html (role-aware)                                │
│   Bootstrap πρώτου admin                                 │
├─────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 2 — Admin panels                                    │
│   admin-sites.html                                       │
│   admin-company-workers.html                             │
│   admin-users.html (με invite flow + assignments)        │
├─────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 3 — Lock-down existing tools                        │
│   Auth guards σε 0, 1, 2, 3 HTML                        │
│   Scanner: auto-site για non-admin                       │
│   Attendance: scoped filter βάσει role                   │
│   Full RLS για όλους τους πίνακες                        │
├─────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 4 — Adhoc workers                                   │
│   Scanner: φόρμα έκτακτης καταχώρησης                   │
│   admin-adhoc-queue.html (approve/reject/promote)        │
│   Badge στο admin index                                  │
├─────────────────────────────────────────────────────────┤
│ ΦΑΣΗ 5 — Delete permissions & polish                     │
│   Today-only delete για site_manager (UI + RLS)          │
│   Διπλό confirmation dialog                               │
│   Audit columns (created_by παντού)                      │
│   Testing matrix                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 13. Μελλοντικές Επεκτάσεις (όχι scope της v3.0)

- `site-dashboard.html` καρτέλα εποπτείας
- Custom emails μέσω Edge Function + Resend
- Notifications για νέες αναθέσεις / αλλαγές ρόλων
- Statistics dashboard για admin
- Bulk CSV import για workers_company
- Mobile PWA wrapper για scanner

---

## 14. Απαντήσεις σε συχνές ερωτήσεις αρχιτεκτονικής

**Γιατί δεν ενοποιήθηκαν `profiles` με `workers_company`;**
Γιατί ο πρώτος admin δεν είναι εταιρικός υπάλληλος. Η διάκριση κρατά το σύστημα ευέλικτο.

**Γιατί ο project_manager δεν έχει Create/Edit σε workers;**
Principle of Least Privilege. Είναι εποπτικός ρόλος. Αν χρειαστεί, ζητά από site_manager ή admin.

**Γιατί ξεχωριστό `adhoc_workers` και όχι flag στο `workers`;**
Καθαρός διαχωρισμός approved/unapproved. Εύκολος εντοπισμός pending, διαφορετικά lifecycle.

**Γιατί το `attendance_log` δείχνει σε δύο πίνακες;**
Για να μη χαθεί παρουσία όταν ένας adhoc γίνεται approved → μεταφορά reference χωρίς data loss.

**Τι γίνεται αν admin διαγράψει εργοτάξιο με ενεργά assignments;**
Soft delete (is_active=false). Hard delete μόνο σε εντελώς άδειο εργοτάξιο.

---

*Document version: 1.0 · Φτιάχτηκε πριν την υλοποίηση Φάσης 1.*
