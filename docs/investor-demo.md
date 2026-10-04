# Vachan investor demo

## Demo goal

Show Vachan as the coordination layer between a work promise and a payment—not as a bank, wallet, escrow service, or payment aggregator.

**Recommended length:** 3–4 minutes  
**Audience:** investor, accelerator reviewer, potential design partner, or early customer  
**Demo URL:** the deployed Vachan homepage

## Before the call

- Open the homepage at the top of the page.
- Confirm the hero shows `Stripe Checkout · test-ready` and `No card data touches Vachan`.
- Confirm the workspace contains the `Inventory sync API` row labeled `₹32,000 · Demo only` and status `Demo`.
- Do not add Stripe live keys during the demo.
- If Stripe test keys are not configured, describe Checkout architecture but do not pretend to open a real payment page.

## The 3-minute script

### 0:00–0:30 — Start with the problem

**Action:** Stay on the hero section.

**Say:**

> “Most small-business work starts with a promise in chat: ‘I’ll send it when it’s done.’ The problem is not that India lacks fast payment rails. The problem is that the payment rarely records what the money was for, what ‘done’ means, or what evidence should settle a disagreement. Vachan is the missing coordination layer between that promise and the payment.”

**Point to:**

- `₹2.4L tracked in prototype`
- `18 agreements closed`
- `0 funds held`

**Key message:** Vachan coordinates trust; it does not custody money.

### 0:30–1:00 — Explain the trust loop

**Action:** Scroll to **The Vachan Loop**.

**Say:**

> “The product reduces every agreement to three inspectable steps: define the promise, signal the payment, and show the proof. That is the product thesis—less ‘trust me’, more ‘check this’.”

**Point to:**

1. Promise — scope, amount, acceptance criteria, review window.
2. Signal — UPI or Stripe Checkout without storing card details.
3. Proof — deployment URL, commit, test run, file, or approval.

**Transition:**

> “Now I’ll show what that looks like after the promise becomes a real working record.”

### 1:00–1:55 — Show the workspace

**Action:** Scroll to **Product / 02 — Agreements that move work forward.**

**Say:**

> “This is the workspace. A deal is not just an amount; it is a record with a client, a review deadline, a status, and an evidence timeline.”

**Action:** Click `Inventory sync API` in the agreement list.

**Say:**

> “This ₹32,000 Inventory Sync API entry is intentionally marked ‘Demo only’. It is product storytelling data, not a payment claim. That distinction matters because an investor-ready product should be honest about what is real and what is simulated.”

**Action:** Click `Landing page refresh` to return to the main timeline.

**Say:**

> “The selected milestone shows the commercial context at a glance: value, client, review window, and the next action.”

### 1:55–2:35 — Make the timeline the proof moment

**Action:** Point to the timeline events from top to bottom.

**Say:**

> “The timeline is the trust primitive. First, the agreement is created. Then the payment state is recorded. Then proof is submitted. Finally, the client accepts or opens a dispute. Each event is append-only and signed server-side, so the timeline can expose tampering instead of silently rewriting history.”

**Action:** Click `Accept milestone`.

**Say:**

> “Acceptance is a deliberate human action. Vachan can accelerate the workflow, but it does not remove judgment from the person who owns the review.”

**Optional action:** Click `Export receipt`.

**Say:**

> “The receipt carries context: what was promised, who was involved, what value was attached, and how the milestone ended.”

### 2:35–3:20 — Explain Stripe safely

**Action:** Point to the `Payment safety by design` note and the payment-boundary section.

**Say:**

> “For real payments, Vachan uses provider-hosted Stripe Checkout. The server creates the Checkout Session from the stored milestone amount. The browser never collects card data, and the redirect back to Vachan is not treated as proof of payment.”

**Point to:**

- `Provider-hosted`
- `Idempotent`
- `Test-first`

**Say:**

> “The source of truth is the signed Stripe webhook. Vachan verifies Stripe’s raw request signature, records each Stripe event ID once, and only then appends a signed `payment_confirmed` event to the deal timeline. If the webhook is duplicated, it is safely ignored. If Stripe is not configured, the API stays disabled rather than pretending a payment happened.”

**If test mode is configured:**

- Click `Open Stripe Checkout` only on an authenticated API-backed deal.
- Use Stripe test payment details on Stripe’s hosted page.
- Return to Vachan and show the webhook-confirmed timeline event.

**If test mode is not configured:**

> “This environment intentionally keeps Stripe disabled. The integration is ready, but no keys are committed and no live funds are processed in this demo.”

### 3:20–3:45 — Close with the wedge

**Action:** Scroll to **Designed for trust / 04**.

**Say:**

> “Vachan starts with freelance and small-business milestones, where the cost of ambiguity is high and the existing tools are fragmented across chat, UPI screenshots, files, and memory. The wedge is simple: make the promise legible, make the payment verifiable, and make the proof portable.”

**Close with:**

> “We are not replacing India’s payment rails. We are making the work around those rails trustworthy.”

## Suggested investor questions

**“Is Vachan an escrow service?”**  
“No. Vachan does not hold funds. It coordinates evidence and payment status around licensed providers.”

**“Why not just use Stripe or UPI directly?”**  
“Stripe or UPI can move money. They do not define what ‘done’ means, collect proof, manage acceptance, or preserve a shared dispute timeline.”

**“What is defensible?”**  
“The defensible layer is the structured agreement and signed evidence graph around a payment event: the context that gets lost when work, proof, and money live in separate tools.”

**“Is the ₹32,000 deal real?”**  
“No. It is explicitly labeled Demo only. The demo uses it to show the product state without misrepresenting a real transaction.”

**“Are live payments enabled?”**  
“Not in the public demo. Stripe Checkout is implemented in test-first mode, disabled without server keys, and designed to activate only after webhook, refund, settlement, compliance, and monitoring checks.”

## Recovery plan if something breaks

- **Homepage unavailable:** use the repository README and walk through the screenshots/copy conceptually.
- **Stripe button says disabled:** this is expected without configured server keys; use the payment-boundary section.
- **A demo button changes state unexpectedly:** refresh the page and continue from the timeline explanation.
- **Investor asks for production proof:** show the GitHub Actions checks, the signed-event tests, and the production runbook rather than claiming live scale.

## One-line version

> “Vachan is the trust layer that turns an informal Indian work promise into a verifiable milestone around the payment rails people already use.”
