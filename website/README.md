# WaveCore X Polish

I attached The pwebsite Zip File. take the Code.and Complete the WaveCore X public product website as a polished, top-tier landing page.

First, fix every remaining TypeScript/build error in src/routes/index.tsx and ensure the page renders correctly in the preview. Preserve the existing TanStack Start structure—do not add React Router, backend logic, database features, or change simulator behavior.

Keep WaveCore X strictly as a frontend-only public presentation layer. Any simulator links must remain environment-configured and must not alter simulator or backend behavior.

Review and refine the entire page for a premium, high-end technology/product aesthetic: strong hero composition, clear value proposition, refined typography, intentional spacing, elegant responsive layouts, subtle motion only where it improves the experience, and excellent mobile presentation. Avoid generic AI-looking gradients or default layouts.

Verify all navigation and CTA links have appropriate safe fallbacks, all visual sections are coherent, and no unsupported claims or invented product evidence are introduced.

Add or correct route-level SEO metadata in src/routes/index.tsx: unique title, description, Open Graph title/description, og:type, and Twitter card metadata.

Finally, test the running preview for console errors, layout issues, CTA behavior, and mobile responsiveness. Do not publish the site—just leave the preview complete and working.

## Local Development

You need Node.js and npm installed.

```sh
cd website
npm install
npm run dev
```

This will start the development server.

## Production Build

To build the optimized static assets:

```sh
npm run build
```
You can preview the built site with `npm run preview`.

## Deployment

The website can be deployed to Vercel (recommended) or any other static hosting provider. 

### Vercel Deployment

Run the following command from the `website/` directory to deploy to Vercel:

```sh
npx vercel
```
For production deployment:
```sh
npx vercel --prod
```

**Environment Variables:**
- `VITE_SIMULATOR_URL`: The URL of the deployed simulator backend (optional). If not set, the UI will fall back to "Live simulation deployment coming soon" for the "Launch Simulator" link.
- `VITE_GITHUB_URL`: Link to the project repository.
- `VITE_DEMO_VIDEO_URL`: Link to an external demo video (if not serving locally).
