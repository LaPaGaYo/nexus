# Design Hard Rules Reference

Use this reference when a Nexus skill says to lazy-load Design Hard Rules.

## Classifier

- MARKETING/LANDING PAGE: hero-driven, brand-forward, conversion-focused.
- APP UI: workspace-driven, data-dense, task-focused dashboards/admin/settings.
- HYBRID: marketing shell with app-like sections.

Apply Landing page rules to marketing sections and App UI rules to functional sections.

## Hard Rejection Criteria

- Generic SaaS card grid.
- Carousel with no narrative purpose.
- Purple/violet/indigo default gradient with no brand reason.
- Centered everything.
- Decorative blobs, emoji, or icons doing the work of information architecture.
- AI-generated hero copy that could fit any product.

## Litmus Checks

Answer YES or NO:

1. Brand/product unmistakable in first screen?
2. One strong visual anchor?
3. Scannable by headlines only?
4. Each section has one job?
5. Cards actually necessary?
6. Motion improves hierarchy?
7. Would it still feel premium with all decorative shadows removed?

## Landing Page Rules

- First viewport reads as one composition, not a dashboard.
- Brand-first hierarchy: brand, headline, body, CTA.
- Typography is expressive and purposeful. No default stacks such as Inter, Roboto, Arial, or system.
- No flat single-color backgrounds. Use gradients, imagery, subtle patterns, or material atmosphere.
- Hero is full-bleed and edge-to-edge, not inset/tiled/rounded.
- Hero budget: brand, one headline, one supporting sentence, one CTA group, one image.
- No cards in hero. Cards only when card is the interaction.
- One job per section.
- Use 2-3 intentional motions minimum.
- Define CSS variables for the color system.
- Copy is product language, not design commentary.

## App UI Rules

- Calm surface hierarchy, strong typography, few colors.
- Dense but readable, minimal chrome.
- Organize primary workspace, navigation, secondary context, and one accent.
- Avoid dashboard-card mosaics, thick borders, decorative gradients, and ornamental icons.
- Use utility language for orientation, status, and action.
- Cards only when card is the interaction.

## Universal Rules

- Define CSS variables for color.
- No default font stacks.
- One job per section.
- If deleting 30% of copy improves it, keep deleting.
- Cards earn their existence.

## AI Slop Blacklist

- 3-column feature grid.
- Purple/violet/indigo as the default palette.
- Generic hero with centered headline, subhead, CTA, and floating cards.
- Fake glassmorphism.
- Decorative gradients or blobs without product meaning.
- Repeated rounded cards with icons.
- Empty "beautiful, modern, seamless" copy.
- Emoji as design elements.

Source inspiration: OpenAI "Designing Delightful Frontends with GPT-5.4" plus Nexus design methodology.
