# Redline Defense Command Center

Follows Redline Auto's architecture: Google Calendar storage, Node/Vercel serverless APIs, and a signed HttpOnly cookie for staff access. No Supabase is used.

Environment variables: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID` (the authorized Redline Google Calendar), `RDA_AUTH_SECRET`, `RDA_ADMIN_PASSWORD_HASH` (PBKDF2-SHA256: salt:hash), `RDA_ADMIN_EMAIL`.

Data isolation: Redline Defense records are held as private transparent all-day events on May 8, 2095 with `extendedProperties.private.rda_type` identifying `class`, `request`, or `payment`. The Auto CRM queries only current-year booking events and does not use these events. Existing Supabase records (if any) are not imported or deleted.

The public site lists active visible classes; requests are pending until staff confirm them. Deposit payments are ledger entries only, not automatic card charging or refunds. Auto email notifications are NOT yet configured. Admin login uses the email and password configured in the environment (no verification emails).
