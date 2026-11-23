# TutorTrack — unslop design pass

Updated: 23 November 2026

## Design audit

The source UI was functional, but visually inconsistent and unnecessarily decorative:

- Saturated purple and gold hero panels drew attention away from the actual data.
- Floating/glowing shapes, gradient backgrounds and colored shadows added texture without meaning.
- Small uppercase labels with wide letter spacing competed with headings and figures.
- Oversized radius treatments, lifting cards and inconsistent paddings made navigation feel less stable.
- Financial totals were mixed with decorative icon tiles; the important numbers needed a clearer hierarchy.
- The location picker used a decorative fake map even though coordinates were entered as text.

## Direction

- **Product**: A daily work ledger for independent tutors to manage students, lessons and tuition payments.
- **Character**: Bookish, orderly, quietly helpful.
- **World**: Paper schedules, class registers, and a teacher's ledger.
- **Moments**: The weekly class chart using actual student schedules; the date-and-time session ledger.
- **Signature detail**: Fine ruled dividers and a small ink-green indicator for the active teaching day.

## Changes

1. **Spacing**: A consistent 4px-based rhythm, quieter borders and card sizes, normalized radii, a more balanced app header.
2. **Color**: Replaced the purple/amber theme with a paper-white and ink-green palette. Semantic red for unpaid balances and errors is kept.
3. **Icons**: Kept lucide-react as the single icon set; removed unnecessary decorative icons and redrew the existing graduation-cap logo as a flat mark. Updated PWA icons and favicon to match.
4. **Copy**: Replaced the generic dashboard greeting and hype copy with specific teaching-and-payment language. Reduced all-caps micro-labels.
5. **Type**: Used DM Sans for working text and Newsreader for expressive, product-specific headings, with restrained weights and tabular number formatting.
6. **Layout**: Redesigned the dashboard hero as a teaching overview with a real weekly schedule, retained the schedule → next lesson → student directory order. Refined the finance hero and authentication layout.
7. **Details**: Simplified summary cards, student information rows, focus states, buttons, surface treatment and empty states.
8. **Visuals**: No artificial decorative image assets; data itself is the hero moment. The login screen illustrates the existing records, schedules and payment functionality.
9. **Motion**: Removed floating, pulsing, excessive scaling/lifting, and catch-all transitions; retained short interaction feedback and genuine syncing indicators.

## Functional scope

All existing student, session, payment, finance, location, authentication, offline-sync and push-notification logic remains present. One small correctness improvement: the **Next lesson** panel now reports no more lessons today when all scheduled start times have passed, rather than presenting the day's first past lesson as upcoming.

## Validation

- All 22 JSX/TSX application files passed a TypeScript parser/transpilation syntax check with zero diagnostics.
- PWA icon generation completed successfully (192px, 512px, Apple touch and maskable variants).
- Full `npm run build`, type checking against installed packages, and browser-based tests **could not run** because package installation is blocked in this environment (`npm ci --offline`: npm cache missing `yauzl@2.10.0`; online installation did not complete).
- After installing dependencies in your environment, run `npm run typecheck`, `npm run build`, and `npm test` before deployment. The project is designed for Node 22 per `package.json`.

## Design source and credit

This pass follows the principles of **unslop** by Damir Sokolovsky: https://github.com/heydamir/unslop — CC BY 4.0. The source project remains TutorTrack, and its functional scope is preserved.
