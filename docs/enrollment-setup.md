# Redline Defense Academy enrollment admin setup

The website includes a secure \`/admin/\` command-center interface and a customer request form. Both deliberately remain inactive until a dedicated database and admin user are connected. No payment card information is collected or stored.

1. Create a **new, separate** Supabase project for Redline Defense Academy in the organization you approve (do NOT reuse Strike Force 1 Protection's database).
2. Apply \`db/rda-schema.sql\` as a Supabase migration.
3. Disable open user signup in Supabase Auth. Create your admin user in Supabase Auth, verify its email, and insert their user id into \`rda_admins\` using the example in the schema. Use a unique long password and MFA if supported.
4. Configure Redline Defense's Vercel project environment variables for production:
   * \`RDA_SUPABASE_URL\` — your Supabase project URL
   * \`RDA_SUPABASE_ANON_KEY\` — publishable or anon API key
   * \`RDA_SUPABASE_SERVICE_KEY\` — secret service-role key (server only)
   * \`RDA_RATE_SALT\` — secure random secret for request abuse throttling
5. Optional secure owner email notifications:
   * \`RESEND_API_KEY\` — your Resend API key
   * \`RDA_FROM_EMAIL\` — an authorized sender at a verified domain
   * \`RDA_NOTIFY_EMAIL\` — destination admin email address
6. Redeploy Vercel so the new variables take effect. Use \`/admin/\` to create classes with dates, prices, deposits, capacities, and visible/active flags. Public form displays only available visible classes.
7. Submit a test request; confirm the notification email if configured, status controls, and a test manual deposit entry. Keep production requests pending until manually approved.

Deposit ledger is **manual record keeping**, not a checkout or payment gateway. Recording Zelle, cash, or external card payments does not actually charge customers. Refunds must be negative ledger entries. No automatic payment confirmations are sent to students. The system never treats a pending request as a reserved seat.

## Deployment update (November 2026)
The production backend uses Supabase's legacy anon key plus verified staff JWTs and row-level security. It does **not** use the service-role key. Required Vercel variables: `RDA_SUPABASE_URL`, `RDA_SUPABASE_ANON_KEY`, `RDA_RATE_SALT`, `RDA_ADMIN_EMAIL`. The database's `rda_owner_sync` trigger grants a verified account with the allowlisted Gmail address admin access. The owner activates from the admin page with a new password; Supabase email confirmation is required. Do not reuse a password provided in chat. The initial SQL in this repository was superseded by migration `rda_initial_private_enrollment` applied to the dedicated production Supabase project; update that schema artifact before future standalone imports.
