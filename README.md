# TSEC Sync v3 — Smart Campus Timetable & Room Management

React + Vite prototype for Thadomal Shahani Engineering College: role-based timetables, room /
lab / seminar-hall availability, bookings, seminars & events, approvals, and schedule-change
notifications across the Old and New Building.

## Quick start

```bash
npm install                 # Node >= 22.5 (the API uses the built-in node:sqlite — no native build step)
npm run dev:all             # API on :3001 + UI on :5173   (open http://localhost:5173)
```
The first start creates `server/data/` (SQLite database + uploaded PDFs), imports all **27 official timetables** and the demo accounts. Nothing else to set up.

| Task | Command |
|---|---|
| Both servers for development | `npm run dev:all` (or `npm run server` + `npm run dev`) |
| All tests (UI + API) | `npm test` → 142 UI tests (Vitest) + 132 API tests (node:test) |
| Tests + production build | `npm run check` |
| Production build | `npm run build` (→ `dist/`) |
| Run in production | `npm run build && npm start` — one Node process serves the app **and** `/api` (default port 3001) |

## Environment variables (copy `.env.example` → `.env`, or set them in your host)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3001 | HTTP port |
| `DATA_DIR` | `server/data` | SQLite DB + `files/` (PDFs). **Must be a persistent disk in production; back it up.** |
| `NODE_ENV` | – | `production` hides demo logins on the login page and marks the session cookie `Secure` (needs HTTPS) |
| `TRUST_PROXY` | – | `1` when behind an HTTPS proxy (Render, Railway, Fly, nginx) |
| `SEED_DEMO_USERS` | on | **Set `0` in production.** Otherwise the demo accounts (published passwords) are created |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | – | Creates a real administrator at start (both required) |
| `APP_TZ` | Asia/Kolkata | Time zone for "today" (current timetables, past-date checks) |
| `SESSION_HOURS` | 12 | Login lifetime |
| `MAX_UPLOAD_MB` | 10 | PDF size limit |
| `ALLOW_DEMO_RESET` | off | Only on a throw-away demo server: enables the admin *Reset demo data* button |

No secrets are committed: `.env` and `server/data/` are git-ignored, passwords are stored as scrypt hashes, and the browser holds no credentials.

## Deployment (what is ready, what is still manual)
The app is **one Node process + one folder on disk**. It is *not* a static site: `vercel.json` only serves the frontend and **cannot** run the API or keep the database — use a Node host with a persistent disk.

1. Create a Node >= 22.5 web service (Render / Railway / Fly.io / a VPS) from this repository.
2. Build command `npm ci && npm run build`; start command `npm start`; health check `GET /api/health` (public, returns `{"ok":true}`).
3. Attach a persistent disk and set `DATA_DIR` to its mount path.
4. Set `NODE_ENV=production`, `TRUST_PROXY=1`, `SEED_DEMO_USERS=0`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
5. First start initialises the database and imports the timetables automatically (idempotent: later restarts never duplicate or overwrite anything). To upgrade an existing deployment just redeploy; migrations are additive and never delete data.

Verified in this repository: the production build, the production server serving `dist/` with SPA fallback for deep links, `/api/health`, login for all roles, and the data upgrade from the previous release. **Not done (needs your hosting account):** an actual deployment to a live host and HTTPS — nothing here claims a live deployment.

## Home page on every reload
Every full page load (refresh, new tab, typed/shared URL) opens the **public home page**: `src/utils/entry.js` rewrites the address to `/` once, before React and the router start (`src/main.jsx`). In-app navigation never reloads the page, so it is untouched. Authentication is unchanged: protected routes are still guarded by the server session and by `RoleRoute`/`AppLayout`; a logged-in user who refreshes simply sees *Open your dashboard* on the home page, and `/login` redirects a signed-in user to their dashboard. Works with any host because deep links are served `index.html` (Express fallback; `vercel.json` rewrite) and the app then normalises the URL.

## Demo logins (prototype only)

| Role | Name | Department · Semester · Division | Email | Password |
|---|---|---|---|---|
| Student | Heeya Shewkani | Computer Engineering · SEM V · C1 ¹ | student@tsec.edu | student123 |
| Student | Dhwani Shriyan | AI & Data Science · SEM III · S1 ¹ | student.aids@tsec.edu | student123 |
| Student | Tanisha Thakur | Information Technology · SEM VII · I1 ¹ | student.it@tsec.edu | student123 |
| Teacher | Dr. Rupali Sarode ² | Computer Engineering | teacher@tsec.edu | teacher123 |
| Teacher | Dr. Sakshi Surve ² | Computer Engineering | teacher2@tsec.edu | teacher123 |
| Administrator | Dr. S. Iyer | — | admin@tsec.edu | admin123 |

¹ The divisions of the three students were **not specified**; C1 / S1 / I1 are development placeholders (change them in `server/seed.js` and `src/data/users.js`).
Emails are development-only placeholders in the project's existing style (`student@tsec.edu` …), not real institutional addresses.
² Spelled exactly as printed in the official COMP sheet legends (RS = Dr. Rupali Sarode, SMS = Dr. Sakshi Surve) because lecture ownership is matched **by name**.
Their lectures are the entries printed with their abbreviation on the supplied COMP SE/TE/BE sheets (nothing else is assigned to them).
On an existing database the five sample accounts are refreshed **in place** at startup (name/department/semester/division only; ids, password hashes and roles are never changed).

Demo data is generated relative to today's date. (The admin *Reset demo data* button only exists on servers started with `ALLOW_DEMO_RESET=1`.)

## How it works now (v3)

**Everything is server-backed.** The browser no longer owns any data or any permission.

| What | Where it lives | Who may change it |
|---|---|---|
| Users, sessions | SQLite `users`, `sessions` | server only (scrypt hashes, HttpOnly cookie) |
| Official timetables (versions, entries, PDFs, audit) | SQLite `timetables`, `versions`, `entries`, `audit` + `files/` | administrators, via `/api/admin/*` |
| Lectures, one-day changes/cancellations, requests, bookings, events/seminars, notifications, read marks, audit | SQLite `app_state` (one versioned document) | **only** through `POST /api/actions/:name` — the actor is the logged-in session user |
| Idempotency ledger | SQLite `op_log` | server |

* **Server-authoritative operations.** The prototype's pure operations (`src/store/operations.js`) now run on the server
  (`server/state.js`) inside one SQLite transaction per action, with the actor taken from the session — never from the request.
  A role gate (`src/store/actions.js`, HTTP 403) sits in front of each operation's own permission check and conflict re-validation.
* **Official timetables take part in the same workflow.** Published, still-valid official timetables are mirrored into the shared
  lectures (`source: "official"`, with batch, kind, validity dates and the room codes printed on the sheet), so approvals,
  cancellations, conflict checks and notifications work for them too. Parallel lab batches and electives are not treated as clashes.
  Publishing, replacing, withdrawing or archiving a timetable re-syncs them automatically. Original PDFs and structured entries are never touched.
* **One Timetable tab** for all roles: *Weekly schedule* (official lectures + **approved** changes/cancellations, original struck
  through; the requester's **pending** requests are listed separately and never shown as final) and *Official sheet & PDF*.
  `/app/official-timetable` still works (redirects).
* **Request → notify → decide.** Teachers can request: reschedule, room change, cancellation, **faculty change** (always needs approval),
  **new lecture**, and **seminar proposals** (edit your own pending proposal; invisible to students until approved). Each request notifies the
  administrator with the teacher, department, original vs requested schedule, time, reason, status and a link. Approval re-checks conflicts,
  applies the change, keeps the original in history and notifies exactly the affected class and the teacher. Rejection notifies the teacher
  (with the reason), changes nothing and tells no student.
* **No duplicates.** Retried calls (`opId`), repeated clicks (in-flight sharing), re-deciding a decided request, duplicate pending requests
  and de-duplicated notices (`dedupeKey`) are all handled.
* **Notification centre.** Per-user read state on the server, filters (category, unread), "Open" jumps to the related page, nothing is deleted.
  **Delivery is database-backed polling** (every ~4 s and when the tab regains focus). It is *not* instant push; there are no e-mails/SMS.

### Authorization summary
Students: read-only (+ mark own notifications read). Teachers: only their own lectures/requests/bookings/proposals; cannot approve anything.
Administrators: everything, but cannot file teacher-only requests. Unauthenticated: nothing. Every `/api/admin/*` route and every action is checked on the server.

### Upgrading from the previous version (data preservation)
The new tables (`app_state`, `op_log`) are created with `CREATE TABLE IF NOT EXISTS`; nothing existing is altered or deleted. On first start the
server creates the shared state from the demo seed, mirrors the official timetables into it, and imports notices that were only in the old
`notifications` ledger. This was tested against a database produced by the previous release (versions, 204 entries, users, sessions, audit rows
and stored PDFs verified identical). Data your **browser** saved with the older localStorage prototype is untouched; an administrator can import
it **once** from *Profile → Import data from this browser*, and only while nobody has made a change on the server (otherwise it is refused so real data is never overwritten).

## Official timetable module (details)


* **Students/teachers** → *Timetable → Official sheet & PDF*: department → semester → division → the currently published timetable
  (grid + original PDF view/download). Only valid combinations are offered. Drafts, withdrawn, expired and
  not-yet-effective timetables are never shown; the student gets an explanatory message instead.
* **Administrators** → *Timetable Uploads*: upload a PDF for any department/semester/division, edit entries,
  preview, publish, replace, withdraw, archive, cancel a pending draft, restore an old version, see version
  history and the audit log. Nothing is ever hard-deleted.
* **Active semesters and divisions** live in `shared/divisions.js` (used by both server and UI). Only **Semesters III, V and VII**
  exist; I, II, IV, VI (and VIII) are retired everywhere (filters, upload form, API validation, seed data). Divisions:
  AI&DS = **S1, S2** (S3 was removed from every semester); COMP = **C1, C2, C3** (as printed on the sheets; formerly CI/CII/CIII);
  IT = I1, I2. **EXTC and Chemistry have no divisions** — one class per semester (their class key uses an empty division; division selectors and labels are hidden for them; all students of a semester share one timetable). IT's files S1/S2/T1/T2/B1/B2 are *file identifiers*, not division names.
* **Data model** (SQLite, `server/db.js`): `timetables` (dept, semester, division, academic year — unique) →
  `versions` (status draft/published/withdrawn/archived/cancelled, effective/expiry dates, PDF reference + SHA-256,
  legend, content hash; a partial unique index allows at most ONE published version per timetable) → `entries`
  (day, start, end, kind, subject, faculty, room, batch, printed-time label); plus `audit`, `notifications`,
  `users`, `sessions`.
* **Security:** server-side sessions (random token, only its hash stored; HttpOnly SameSite=Lax cookie), scrypt
  password hashing, every `/api/admin/*` route requires role `management` on the server, state-changing requests
  need an `X-Requested-With` header (CSRF), PDF content is verified by magic bytes, size-limited, stored under
  its SHA-256 (never a user-supplied path), login attempts are throttled.
* **Validation (warnings only, never silent edits):** same-batch overlap, whole-division overlap, same faculty
  twice at one time, missing faculty, codes missing from the sheet's legend. Parallel lab batches and parallel
  electives are deliberately NOT flagged.
* **Notifications:** published / updated / withdrawn notices go into the same shared notification list (per department-semester-division), de-duplicated
  by content hash — republishing identical content sends nothing.
* **Imported IT data** is the six supplied PDFs, transcribed into structured entries exactly as printed. The
  original PDFs are stored and downloadable byte-for-byte.

### Assumptions to confirm
1. **Academic year 2026-27** for the IT timetables — the sheets only say W.E.F. 06.07.2026.
2. **BE-C1/C2/C3 are Semester VII.** The brief's table said Semester V, but the sheets themselves are headed `COMP/VII/C1…C3` (and TE-C* = `COMP/V`, SE-C* = `COMP/III`). The PDFs were treated as the source of truth.
3. Where a sheet prints an explicit range such as "(1 to 2)" (post-lunch start at 1:00 pm) that range is stored; otherwise the grid column is used.

### Known issues in the source sheets (kept as printed; shown to admins on each version)
* **S1**: Friday 10:30–12:30 prints `SQL S11` and `FSJ S11` — probably `SQL S13`.
* **S2**: Monday `SQL S23 1004` has no faculty.
* **B2**: Thursday `ROSP B21` and `IOE B21` in the same slot; Friday `DS B22` printed twice (KS and AK) — one is probably B23.
* Faculty codes JM, SG, AK, KS, AV and subject codes SEAP, DEVOPS, WEB LAB, DS, WDW, SQL are used on sheets whose legends do not define them; legend typos ("Arrtificial", "Systeem"…) are kept as printed.
* Fix through *Timetable Uploads → Create editable draft → Entries → Publish* so the correction is versioned and audited.

### Supplied official timetables (27 sheets, W.E.F. 06 Jul 2026, academic year 2026-27 assumed)
| Sheet id | Department | Semester | Division | PDF |
|---|---|---|---|---|
| S1 / S2 | IT | III | I1 / I2 | `S1-TT.pdf`, `S2-TT.pdf` |
| T1 / T2 | IT | V | I1 / I2 | `T1-TT.pdf`, `T2-TT.pdf` |
| B1 / B2 | IT | VII | I1 / I2 | `B1-TT.pdf`, `B2-TT.pdf` |
| SE-C1 / SE-C2 / SE-C3 | Computer Engineering | III | C1 / C2 / C3 | `SE-C?-July-2026.pdf` |
| TE-C1 / TE-C2 / TE-C3 | Computer Engineering | V | C1 / C2 / C3 | `TE-C?-July-2026.pdf` |
| BE-C1 / BE-C2 / BE-C3 | Computer Engineering | **VII** | C1 / C2 / C3 | `BE-C?-July-2026.pdf` |
| **S1-5 / S2-5** | AI&DS | **III** | S1 / S2 | `S1-5.pdf`, `S2-5.pdf` |
| T1-5 / T2-5 | AI&DS | V | S1 / S2 | `T1-5.pdf`, `T2-5.pdf` |
| B1-5 / B2-5 | AI&DS | VII | S1 / S2 | `B1-5.pdf`, `B2-5.pdf` |
| **SE-ETC-1 / TE-ETC-1 / BE-ETC-1** | EXTC | III / V / VII | *none* (one class) | `SE-ETC-1.pdf`, `TE-ETC-1.pdf`, `BE-ETC-1.pdf` |
| **SE-CHEM / TE-CHEM / BE-CHEM** | Chemistry | III / V / VII | *none* (one class) | `SE_CHEM.pdf`, `TE_CHEM.pdf`, `BE_CHEM.pdf` |

Transcriptions live in `server/seed/it-data.js`, `official-data.js` and `official-data-2.js`, exactly as printed; the importer
(`seedOfficialTimetables`) is idempotent and, on an existing database, adds a new version and archives (never deletes) whatever was published before.
Each sheet is stored as structured entries (day, start/end, kind, subject, faculty, room, batch, printed time label) **and** as the original PDF.
Tea/lunch breaks are stored as `break` entries (shown on the official sheet, never scheduled as lectures).

### Timetable completion checklist — the eight configurations of the final pass
| # | Identifier | PDF | Class | Entries | Source heading verified | Practical batches | Open ambiguities |
|---|---|---|---|---|---|---|---|
| 1 | `S1-5` | S1-5.pdf | AI&DS III **S1** | 40 | "SE-S1 AI & DS", Class Room 901 | S11–S13 rotate COA/AOA/Java ✓ | ED printed as full name (stored as ED); none else |
| 2 | `S2-5` | S2-5.pdf | AI&DS III **S2** | 40 | "SE-S2 AI & DS", Class Room 907 | S21–S23 rotate ✓ | tutorial printed "MEC" (legend: MCE) |
| 3 | `SE-ETC-1` | SE-ETC-1.pdf | EXTC III | 40 | "SE/III/EXTC", 702 | A1–A4 rotate ✓ | "Prof. Uttara Bh" legend cut off; JAVA/C++ room pairing |
| 4 | `TE-ETC-1` | TE-ETC-1.pdf | EXTC V | 46 | "SE/V/EXTC", 806 | A1–A4 rotate ✓ | code RP not in legend; "A1/A2 ML + DCE" and "A3/A4 ML + DCE" split not printed (2 validator warnings, declared) |
| 5 | `BE-ETC-1` | BE-ETC-1.pdf | EXTC VII | 27 | "SE/VII/EXTC" | A1–A3 ✓ | code JK not in legend; "12 PM" / "1.30 PM" annotations; room pairing "605/803"; no class room printed |
| 6 | `SE-CHEM` | SE_CHEM.pdf | Chemistry III | 54 | "Sem:-III", 308 | K1–K3 rotate ✓ | codes SG, NP not in legend; MPR undefined |
| 7 | `TE-CHEM` | TE_CHEM.pdf | Chemistry V | 56 | "Sem:-V", 309 | K1–K3 rotate ✓ | MDL (K3) has no faculty printed; SG, MK not in legend; PDE/MDL undefined |
| 8 | `BE-CHEM` | BE_CHEM.pdf | Chemistry VII | 44 | "Sem:-VII", 108 | K1–K3 rotate ✓ | HRA cell extents inferred from the 3-batch rotation (verify Mon/Tue/Thu blocks); SG not in legend |

Verification method: every sheet was read visually at high zoom (the Chemistry PDFs are photographed scans), transcribed, then checked three ways —
(1) automated spot-checks of specific cells against the PDFs (`server/test/official2.test.js`), (2) *rotation checks*: every practical subject must be run by every batch exactly once,
(3) validator: no overlaps or faculty clashes except the two documented TE-ETC-1 ambiguities. **Not independently proofread by a second person** — please have the department
confirm each sheet, especially the items in the "Open ambiguities" column (they are also shown to administrators inside the app on each timetable version).

### Retired data (migration `server/retire.js`, runs at every start)
Nothing is deleted. Published timetables of retired classes (AI&DS S3, Semesters I/II/IV/VI/VIII, old CI/CII/CIII) are **archived**, their drafts **cancelled**,
their shared lectures **deactivated** (kept, never scheduled), they disappear from the active admin list (`?include_inactive=1` still shows them) and cannot be
republished. Accounts stored with the old COMP division names are moved to the matching new ones (CI→C1, CII→C2, CIII→C3). Demo lectures for COMP/IT/AI&DS are no
longer created (real sheets replace them); a class that has an official timetable never also shows old demo lectures.

### Removed demo data
The invented IT and AI&DS demo lectures were removed from the prototype's seed (they conflicted with the real IT data). IT lectures now come only from the six PDFs. The demo "guest lecture" targets COMP SEM V.

## Architecture of the original prototype (a single source of truth)

The original app kept lectures, bookings and events in three disconnected datasets, so a room that
had a lecture in it looked "available" and could be double-booked. v2 has ONE state object and ONE
conflict engine:

```
src/
  data/        mock data only (departments, rooms, faculty, users, slots, subject banks)
  store/
    seed.js          builds demo state (relative to today)
    operations.js    every change: permission check -> validation -> conflict check -> new state
                     (+ notification + audit entry). Pure functions, fully unit-tested.
    persistence.js   localStorage load/save; commit() = read-modify-write from storage
  utils/
    schedule.js      THE engine: getOccupancies(), findConflicts(), suggestAlternatives() ...
    changeDetection.js   original-vs-updated diff -> "Room Changed", "Rescheduled" ...
    permissions.js, notifications.js (who receives what), dates.js
  context/     Auth, Data (state + actions + sync), Notifications, Toast
  components/  UI building blocks      pages/  one file per route
```

State = `lectures` (recurring weekly slots) + `exceptions` (a change to ONE date of ONE lecture;
the weekly timetable is never overwritten) + `bookings` + `events` + `requests` + `notifications`
+ `audit` + `settings`.

`getOccupancies(date)` merges lectures (with that date's exceptions applied), approved bookings and
scheduled events into room/time blocks. Teacher bookings, admin timetable edits, seminar creation
and the Room Availability page all call the same `findConflicts()`. It checks room, faculty,
class-division and compulsory-attendance clashes. Time ranges are half-open, so 10:00–11:00 and
11:00–12:00 are allowed back-to-back, while 10:00–11:00 and 10:30–11:30 are rejected.

## Roles

**Student (read-only):** today's lectures, weekly timetable with original vs updated for changed
lectures, upcoming events/seminars, room availability, and notifications for *their class only*.

**Teacher:** My Lectures (next 3 weeks) with change room / reschedule / cancel (reason required,
live conflict preview, alternatives suggested); My Bookings (pending / approved / rejected /
completed / cancelled); My Requests. Teachers can only touch their own lectures and cannot change
faculty. Which actions need approval is set by the admin (default: room change direct;
reschedule and cancel need approval; seminar-hall bookings need approval).

**Administrator:** Manage Timetables (any department, filter by department, semester, division,
faculty, building, room; edit one weekly slot, change one date, add/remove lectures; cancel a whole
day for ONE department; publish a timetable update); Approvals (approve/reject with reasons, edit
approval rules); All Bookings; Seminars & Events with live conflict detection and explicit
per-conflict resolution (nothing is ever cancelled automatically); Change History (who, what,
when, why).

## Seminar conflict example

Admin → Seminars → Add. Choose **Seminar Hall 2**, the date of the seeded booking
"Remedial Mathematics session" (see All Bookings), 11:00–13:00. You get **Scheduling Conflict
Detected** naming the 12:00–13:00 booking, with suggested alternative halls/time slots and an
explicit "Cancel that booking" button. A lecture in a *different* room only counts as a conflict if
you tick "Attendance compulsory" for that audience.

## Test results

`npm test` runs **142 UI tests** (Vitest) and **132 API tests** (node:test). The UI tests run against an in-memory backend (`src/test/localBackend.js`) that uses the *same* operations, role gate and per-user view as the server; `src/store/persistence.js` and `seed.js` are now used by the server seed and by tests only. The API tests run the real Express app on a temporary SQLite database. The original prototype suite covers: scheduling engine (overlap rules, consecutive bookings, seed integrity
over 21 days from 5 start dates), operations (all 15 scenarios from the brief except visual
mobile layout), and UI flows (login, role guards for every admin/teacher route, end-to-end
teacher → admin → student notification journey, live booking conflict, all pages render with zero
`console.error`).

## What is real and what is not (please read)

| Feature | Status |
|---|---|
| Login, sessions, roles | **Real, server-side** (scrypt, HttpOnly cookie, CSRF header, login throttling). The browser holds no passwords or role table. |
| Authorization of every change | **Real, server-side** (role gate + per-operation checks + re-validation at approval time). |
| Data shared between users/devices | **Real** — one SQLite database on the server. |
| Persistence across refresh/restart/re-login | **Real** (SQLite on disk; needs a persistent disk when hosted). |
| Notification delivery | **Database-backed polling** (~4 s + on focus). Not push, not e-mail/SMS. |
| Simultaneous actions | Serialized by SQLite transactions (`BEGIN IMMEDIATE`); the second of two competing bookings sees the first. |
| Draft / publish stage | Official timetables have a full draft → preview → publish → withdraw/archive lifecycle. Lecture-level changes by an administrator publish immediately (+ notification); "pending" is the only pre-publish state for teacher requests. |
| Teachers editing subject/faculty | Teachers can *request* a faculty change or a new lecture (approval required); only administrators edit subjects directly. |
| Not built | Working-day/academic-calendar configuration (Mon–Fri fixed), month-calendar view, user-management screen, e-mail/SMS/push. |
| Multiple server instances | **Not supported** (one Node process owns the SQLite file). |
| Offline use | **Not supported**: if the server is unreachable, actions fail with a message; nothing is applied locally. |
| Official room codes (1004, 906, OB 308 …) | Registered as rooms for conflict checks, but not listed on the Room Availability page (that page lists the mock inventory). |
| Teachers on official sheets | A teacher can change an official lecture only if their account **name equals the faculty name printed on the sheet's legend**; codes with no legend name (e.g. JM, SG, AK) cannot be matched. There is no user-management screen yet. |
| Modify an already-approved seminar | Admin only. Teachers can edit their own *pending* proposal (not an approved seminar). |
| Mobile/tablet layout | CSS is responsive but was **not checked on a real device** (no browser in the build sandbox). |
| Time zone | The server decides "today" (`APP_TZ`); forms use the browser's date pickers. |

## Viva cheat-sheet

* **Why one engine?** The old app had separate datasets, so availability and conflicts disagreed.
* **Exceptions vs recurring slots?** An exception overrides one date only, so "move Friday's lab"
  never alters the weekly timetable, and the original stays available to show "original vs updated".
* **Change detection?** `diffLecture(original, updated)` compares room/building/floor/time/date/faculty
  and `describeLectureChange` turns the diff into the notification text.
* **Overlap?** `startA < endB && startB < endA` (half-open), so back-to-back is fine.
* **Approval flow?** Teacher change -> rule says direct or approval -> request stored -> admin approves
  -> conflicts are re-checked at approval time -> exception published -> only affected students/faculty
  notified (`audience`) -> audit entry written.
* **Why is it not secure?** No server. Real security = server-side checks.


## Manual testing guide
1. `npm run dev:all`, open http://localhost:5173. (If you upgraded from an older copy, restart the server so the new code loads.)
2. **One Timetable tab:** log in as each role (student / teacher / admin, see demo logins). The sidebar has exactly one *Timetable*; admins additionally have *Manage Timetables* and *Timetable Uploads*. Open `/app/official-timetable` — it redirects to Timetable → *Official sheet & PDF*.
3. **Official IT timetable:** log in as `student.it@tsec.edu` (Tanisha, IT SEM VII I1) → Timetable → *Official sheet & PDF* shows IT SEM VII I1 (B1-TT) with *View/Download PDF*; switch to *Weekly schedule* to see the same lectures week by week.
4. **Request → approval:** teacher `teacher@tsec.edu` → My Lectures → *Change / cancel* on a lecture (reschedule/cancel need approval by default). In a second browser/profile log in as `admin@tsec.edu`: within ~4 s the bell shows a new notification (*Approval needed …* with teacher, original vs requested schedule, reason and an **Open** button). Approve it → the Timetable shows the change (original struck through) and a student of that class (for example a COMP SEM V C1 student such as `student@tsec.edu`) gets a notification; students of other classes do not. Reject another request with a reason → the teacher is notified, nothing changes.
5. **New lecture / seminar:** teacher → My Requests → *Request a new lecture* / *Propose a seminar*; the admin is notified and decides under Approvals. A clashing seminar is refused immediately.
6. **Persistence:** refresh, log out/in, restart the server — notifications, read marks and changes remain. Read marks are per user.
7. **Server-side authorization:** with the dev tools, `curl -b cookie -H 'X-Requested-With: tsec-sync' -X POST localhost:3001/api/actions/decideRequest -d '{"input":{}}'` as a student returns 403.

## Remaining limitations / needs a decision
* Polling, not push (see above); one server process only; no offline mode.
* IT faculty accounts matching the names on the official sheets must be created before those teachers can request changes (no user-management UI; accounts can be added to the `users` table).
* Vercel (static) cannot run this app; see *Run it → Deployment note*.

## Known limitations (final)
* **No attendance tracking exists** in this application (the only "attendance" is a *compulsory attendance* flag on events). None was invented.
* Notifications arrive by polling (every ~4 s), not push; one server process only; no offline mode.
* Layouts are responsive (scrollable timetable grid, wrapping long text) but were checked by automated tests and CSS review, **not on physical phones/tablets**.
* The home-page-on-reload rule also applies to shared deep links (a link to `/app/requests?focus=…` opens the home page first).
* Sample accounts are demonstration accounts; student divisions (C1 / S1 / I1) are placeholders. EXTC and Chemistry have no sample accounts (all students of a semester share one timetable).
* A live deployment (hosting account, HTTPS, persistent disk) must still be set up by you — see *Deployment*.
