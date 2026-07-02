# MailCerti — Event & Outreach Management Console

This folder serves as the single source of truth for the **MailCerti** workspace. Before making any codebase changes, review this document to understand the architecture, database models, APIs, and directory structure.

---

## 🚀 1. Technology Stack

* **Frontend:** Vite + React (SPA)
  * **Routing:** `react-router-dom`
  * **Notifications:** `react-hot-toast`
  * **Styling:** Vanilla CSS (`src/App.css` and `src/index.css`)
* **Backend:** Node.js + Express
  * **Database:** MongoDB (using Mongoose ODM)
  * **Authentication:** JWT + Google OAuth2 Client
  * **Emailing:** `nodemailer`
  * **Document Generation:** `pdfkit` (Certificate generation — overlays name on template image)
  * **Excel Processing:** `xlsx`
  * **AI Assistance:** `@google/generative-ai` (Gemini API for email composing)
  * **Scheduling:** `node-cron` (daily reminder cron at 8am)
  * **ID Generation:** `uuid` (team grouping IDs)

---

## 📂 2. Directory Structure

```
mail_certi/
├── .env                # Port, MONGODB_URI, SMTP, Google Auth, JWT, WEBHOOK_SECRET
├── server.js          # Core backend (API routes, Mongoose models, mailer utilities)
├── vite.config.mjs    # Vite configuration & proxy definitions
├── index.html         # Frontend entry page
├── public/            # Static assets
├── uploads/           # Upload storage directory
│   ├── temp/          # Temp spreadsheets/files (auto-deleted after processing)
│   └── templates/     # Event certificate templates (kept)
├── src/               # React Frontend source
│   ├── main.jsx       # Mounts React application
│   ├── App.jsx        # Navigation shell, state management, routes
│   ├── Login.jsx      # Google OAuth login interface
│   ├── api.js         # Axios instance wrapper pointing to backend `/api`
│   ├── App.css        # Core design tokens, dark mode styles, custom UI
│   ├── index.css      # CSS resets and variables
│   └── pages.jsx      # UI Pages (Events workspace, Directory, Settings)
└── project_info/
    └── README.md      # This specification folder/file
```

---

## 🗄️ 3. Database Models (Mongoose)

Defined in [server.js](../server.js):

### A. `Event`
Defines campaigns, venues, dates, and certificate template settings.
* `name` / `description` / `venue` (String)
* `date` (Date, Required)
* `status` (Enum: `upcoming`, `ongoing`, `completed`)
* `googleFormLink` (String) — Google Form link for Module 1
* `participationType` (Enum: `individual`, `team`, default: `individual`)
* `teamEmailPolicy` (Enum: `leader_only`, `all_members`, default: `leader_only`)
* `certificateTemplate` (String, file path to uploaded PNG/JPG)
* `certNameX` / `certNameY` (Number, % position for name on cert, default: 50)
* `certFontSize` (Number, default: 48)
* `certFontColor` (String, default: `#000000`)
* `confirmationSubject` / `confirmationBody` (String, custom email templates)
* `certificateSubject` / `certificateBody` (String)

### B. `Registration`
Students registered for specific events.
* `eventId` (Ref: Event)
* `name` / `email` / `teamName` / `college` / `phone` (String)
* `source` (Enum: `manual`, `excel_import`, `google_form`)
* `status` (Enum: `registered`, `shortlisted`, `rejected`, `participated`)
* `isTeamLeader` (Boolean, default: true)
* `teamId` (String, UUID for grouping team members)
* `memberNames` / `memberEmails` ([String]) — team member details
* **Email Tracking Bools:** `confirmationEmailSent`, `shortlistEmailSent`, `rejectionEmailSent`, `reminderEmailSent`, `certificateEmailSent`

### C. `Settings`
Global SMTP, branding, and API credential configuration.
* `fromName` / `fromEmail` / `orgName` / `replyTo` / `geminiApiKey` (String)
* `allowedEmails` ([String]) — whitelist of permitted @vvce.ac.in accounts

---

## 🖥️ 4. Frontend Structure (`src/pages.jsx`)

Contains route views:

### 1. **Events Workspace** (`/`)
**Split layout**: Left panel = event list, Right panel = event detail

### 2. **Import & Confirm** (`/import`)
AI-powered Excel column mapping + bulk import with auto confirmation emails.

### 3. **Send Emails** (`/send-emails`)
Choose mail type → Compose → Preview → Test → Send All (with AI assist)

### 4. **Certificates** (`/certificates`)
Upload template → Configure → Live Preview → Review all → Confirm → Send

### 5. **Settings** (`/settings`)
SMTP config + Gemini API key + email whitelist + test email.

---

## 🔑 5. Key API Routes

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/events/:id/excel-template` | Download blank XLSX template |
| PUT | `/api/events/:id/cert-settings` | Save certificate settings |
| POST | `/api/events/:id/preview-certificate` | Generate sample certificate PDF |
| POST | `/api/registrations/import` | Import Excel (auto-confirm) |
| POST | `/api/registrations/send-targeted` | Send targeted emails |
| POST | `/api/registrations/preview-certificate-standalone` | Generate on-the-fly certificate PDF |
| POST | `/api/registrations/send-certificates` | Batch send certificates |
| POST | `/api/registrations/retry-certificate/:regId` | Retry failed certificate |
| POST | `/api/registrations/webhook/:eventId?key=...` | Google Forms webhook |
| POST | `/api/compose/generate` | AI email generation via Gemini |
| POST | `/api/compose/test-send` | Send a test email preview |

---

## 🔒 6. Authentication Flow

* Users sign in using Google Sign-In (`Login.jsx`).
* Backend validates Google token and checks `@vvce.ac.in` domain.
* Signs a local JWT stored in `localStorage['mailcerti_token']`.
* Attached to every API request via the `api.js` Axios interceptor.

---

## 🌐 7. Google Form Webhook Setup

1. Create Google Form → Script Editor → paste the Apps Script shown in Module 1 UI
2. Add a trigger: `onFormSubmit` → On form submit
3. The Apps Script POSTs to `/api/registrations/webhook/:eventId?key=mailcerti_wh_secret_2025`
4. Server auto-registers and sends confirmation email

---

## 🏅 8. Certificate Safety Rules

- Each PDF is generated with **only that participant's name** — never another's
- Filename: `<ParticipantName>_<EventName>_Certificate.pdf`
- `certificateEmailSent` DB flag prevents duplicate sends
- Failed sends can be **retried individually** via the registrations table
- User must go through 5-step verification wizard before sending
