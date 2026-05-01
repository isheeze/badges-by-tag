# Badges by Tag Launch Checklist

Use this before submitting the public Shopify app for review.

## Required production settings

- Confirm `shopify.app.toml` uses the deployed app URL: `https://badges-by-tag.onrender.com`.
- Set `SHOPIFY_APP_URL=https://badges-by-tag.onrender.com`.
- Set `SUPPORT_EMAIL=badgesbytag@gmail.com`.
- Set `PRIVACY_POLICY_URL=https://badges-by-tag.netlify.app/privacy`.
- Set `TERMS_URL=https://badges-by-tag.netlify.app/terms`.
- Set `SHOPIFY_APP_LISTING_URL` after the Shopify listing exists.
- Set `BILLING_ENABLED=1` only after the app is configured for public distribution and Shopify Billing API can be used.

## Shopify Partner Dashboard

- Configure public app distribution.
- Confirm the app name and icon match the listing: `Badges by Tag`.
- Configure Shopify-managed installation or the official App Store install flow.
- Add pricing that matches the app UI: Free and Pro at `$4.99/month` with a 7-day trial.
- Add listing screenshots for Home, Badges, Pricing, Support, and the theme block.
- Add review instructions that include a tagged product and where the Product Badges block is installed.

## Infrastructure

- Use a durable production database for Prisma session storage. SQLite is acceptable for local development, but a hosted production app should use a managed database suitable for the hosting platform.
- Run `npm run setup` during deployment so Prisma generates the client and applies migrations.
- Serve the app over HTTPS with a valid TLS certificate.
- Confirm the production app emits App Bridge/session-token activity from inside Shopify admin.

## Review test path

1. Install the app from Shopify.
2. Open the embedded app Home page.
3. Create or edit badge mappings.
4. Save mappings successfully.
5. Add matching product tags in Shopify admin.
6. Add the Product Badges theme app block to a product page or collection product card.
7. Confirm storefront badges render on desktop and mobile.
8. Open Pricing and test upgrade/downgrade after billing is enabled.
9. Open Support and confirm contact/privacy links are valid.
