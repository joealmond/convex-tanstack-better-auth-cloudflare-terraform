# Legal document starter kit

These are editable **drafts**, adapted from the Ujfocim project's legal and operations materials. They are not published policies or legal advice. Keep only modules that match the generated app. Replace every `{{PLACEHOLDER}}`, verify each statement against the deployed product and provider agreements, and obtain local legal/accounting review before publishing or taking payments.

## Start here

1. Record the legal operator, product, markets, languages, support/complaint channels, and effective date. Never put secrets in these files.
2. Inventory actual data flows: account and session data, selected examples, logs, email, payment, AI, cookies and local storage. Check production configuration and provider contracts, not just source code.
3. Complete [processing and vendor register](internal/PROCESSING_REGISTER.md) and [storage inventory](public/COOKIES_STORAGE.hu.md). Decide each purpose, legal basis, recipient, transfer and retention with the responsible adviser.
4. Adapt [terms](public/TERMS.hu.md), [privacy notice](public/PRIVACY.hu.md), and any paid-service material. Publish only the applicable documents at stable public URLs and link them from the app.
5. Record the exact approved version and effective date. Archive the public text and a content hash for each published version; never edit an already accepted version in place.
6. Assign owners and test the [operator runbook](internal/OPERATOR_RUNBOOK.md), including account deletion, data requests, billing and email failures.

The template's account export and deletion features need product-specific review of provider-side records, backups, finance records and retention. The billing example is an integration example, not a complete consumer-payment or entitlement system.

## Files

| File                                   | Use                                              |
| -------------------------------------- | ------------------------------------------------ |
| `public/TERMS.hu.md`                   | Hungarian service terms outline                  |
| `public/PRIVACY.hu.md`                 | Hungarian privacy notice outline                 |
| `public/COOKIES_STORAGE.hu.md`         | Hungarian cookie and device-storage inventory    |
| `public/WITHDRAWAL_REFUNDS.hu.md`      | Optional paid consumer-service outline           |
| `internal/PROCESSING_REGISTER.md`      | Processing and vendor fact worksheet             |
| `internal/OPERATOR_RUNBOOK.md`         | Request, payment and incident procedures         |
| `internal/RESPONSE_TEMPLATES.hu.md`    | Hungarian support reply drafts                   |
| `internal/CONTRACT_CONFIRMATION.hu.md` | Optional paid-service confirmation specification |

## Source and reference

Adapted from the user's Ujfocim repository (`docs/legal/` and legal routes), MIT licensed. Its original draft status and product claims do not carry over. [GDPR Articles 13–14](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679) cover privacy-information requirements; the [EDPB cookie guidance](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en) helps scope client-side storage review. Recheck the law and local requirements for the target market at launch.
