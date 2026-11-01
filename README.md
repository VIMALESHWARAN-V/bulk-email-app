# Bulk Mail Studio

A MERN bulk-mail application with a React/Vite frontend and an Express, MongoDB, and Nodemailer backend.

## Run locally

1. Copy `server/.env.example` to `server/.env` and add MongoDB/SMTP values.
2. Install dependencies with `npm run install:all`.
3. Start both apps with `npm run dev`.
4. Open `http://localhost:5173`.

Without SMTP credentials, the API runs in demo mode and records the campaign as `demo`; without MongoDB, sending still validates and attempts delivery, but history persistence is unavailable.
