# MailCerti — Event & Outreach Management Console

A full-stack event management system for college events. Automates email workflows — registrations, shortlisting, reminders, and certificate generation & delivery.

## Tech Stack

- **Frontend:** React + Vite (SPA)
- **Backend:** Node.js + Express (monolithic `server.js`)
- **Database:** MongoDB (Mongoose)
- **Auth:** JWT + Google OAuth2
- **Email:** Nodemailer (SMTP)
- **Certificates:** PDFKit (name overlay on template image)
- **Excel:** xlsx library
- **AI:** Gemini API (email composition assistance)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your MongoDB URI, SMTP credentials, Google OAuth Client ID

# 3. Run in development (frontend + backend concurrently)
npm run dev
```

## Features

- 📅 **Event Management** — Create events with custom templates, Google Form webhook integration
- 📤 **Excel Import** — AI-powered column mapping, bulk import with auto confirmation emails
- ✉️ **Send Emails** — Shortlist/reject/remind/custom with AI composition & placeholders
- 🏅 **Certificates** — Upload template, live preview, 5-step safety wizard, batch send PDFs
- ⚙️ **Settings** — SMTP config, Gemini API key, email whitelist

## Environment Variables

See `.env.example` for all required variables.
