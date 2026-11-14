# MOSS & MARROW

Premium café, kitchen and bar web application. The public React/Vite experience integrates a database-driven menu when the Express API is available, while retaining a graceful, local visual fallback for design review.

## Run locally

1. Install dependencies: `npm run install:all`
2. Copy `backend/.env.example` to `backend/.env`; ensure MongoDB is running.
3. Seed: `npm run seed --prefix backend`
4. Start API: `npm run server`
5. Start web app: `npm run dev`

The workspace name contains `&`; the frontend scripts intentionally invoke Vite through Node directly so they work correctly from this Windows path.

The app is available at `http://localhost:5173`. API health is at `/api/v1/health`.

## Brand assets

The official logo is preserved at `docs/brand/moss-and-marrow-logo.png`; the supplied inspiration screenshot is at `docs/design-references/website-inspiration-oria.jpg`. Both are copied non-destructively from the user-supplied source. The original generated editorial collection is in `frontend/public/images/editorial/moss-marrow-scenes.png` and is listed as such in the image manifest.

## Current scope

Implemented: responsive public routes, cart, menu API model/endpoint, reservation API with validation and capacity guard, Mongo seed data, brand system and image-rich design. Razorpay, authentication/admin management, uploads, order persistence, email, advanced availability locks and test suites require credentials and further implementation before production use.
