# Student confirmation email configuration

Redline Defense now follows the Redline Auto email pattern and can use Gmail SMTP through Nodemailer. Email is triggered **only after staff confirms a received deposit** using the Command Center. No email goes out when a visitor merely requests a seat.

## Gmail (recommended to match Redline Auto)

In Vercel project `redline-defense-academy`, add these **production-only** environment variables:
- `RDA_GMAIL_USER` = the Gmail address used to send confirmation messages
- `RDA_GMAIL_APP_PASSWORD` = its Gmail app password (sensitive; set in Vercel, never source code or chat)

The Gmail account must support app passwords. Redeploy after setting these values. The dashboard will then show emails as configured. Do not set either credential in GitHub.

## Optional Resend alternative
- `RDA_RESEND_API_KEY` (sensitive)
- `RDA_FROM_EMAIL` (verified sending address, e.g. Redline Defense Academy <info@your-domain>)

If Gmail is configured, Gmail takes priority. Otherwise the Resend integration is used.

## Reservation flow
1. Student clicks **Reserve Seat**, chooses a class, and submits the request; status is Requested and no payment is processed.
2. Staff receives the deposit **externally** and opens the request in Command Center.
3. Staff clicks **Confirm Deposit**, records amount, payment method, and optional reference.
4. The system records deposit in the enrollment event and confirms the seat together, then attempts the confirmation email.
5. A successful send gets an Email Sent timestamp; failures show Email Failed with a retry button. If delivery is not configured, the seat is still reserved and the email remains pending; **no claim of sending**.

Class capacity must be checked before confirmation. A repeat deposit confirmation is rejected. Deposit amounts already manually logged can be counted without duplication. No card payments are processed.

**Important:** The initial enrollment request is NOT a confirmed seat. Confirmation email is NOT an invoice, tax receipt, permit, or proof of completion.
