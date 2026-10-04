# Vachan

**A trust layer for UPI-based work.**

Vachan turns a freelance or small-business promise into a clear, reviewable milestone record: scope, payment intent, proof of work, acceptance/dispute window, and a tamper-evident receipt.

## Why this exists

India has excellent instant payment rails, but the payment itself rarely captures what the money was for, what “done” means, or what evidence should settle a disagreement. Vachan is an India-first prototype for that missing coordination layer.

This repository is a **demo product**, not a bank, escrow service, payment aggregator, or legal-dispute service. It never holds funds. The UPI flow generates a payment intent for demonstration and the ledger records simulated status events.

## Demo flow

1. Create a milestone agreement.
2. Copy or open the generated UPI payment intent.
3. Simulate payment confirmation.
4. Submit proof-of-work with a link and summary.
5. Accept the milestone or open a dispute.
6. Export the verifiable receipt.

## Run locally

No build step is required. Open `index.html` in a browser, or serve this directory with any static server.

```bash
python -m http.server 4173
```

Then visit <http://localhost:4173>.

## Product principles

- No fake live payments or invented credentials.
- Human-readable evidence before automation.
- UPI-friendly without custody of user funds.
- Local-first demo data with browser storage.
- English, Hindi, and Bengali surface copy for the first India-focused release.

## Roadmap

- Signed server events and public receipt verification.
- Optional payment-provider adapters with user-owned credentials.
- WhatsApp-ready receipt sharing.
- Multi-party approvals for agencies.
- Regional language packs and offline PWA support.

## License

MIT
