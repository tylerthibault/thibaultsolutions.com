# Thibault Solutions Web Style Guide

This file is the source of truth for the visual and editorial system used on thibaultsolutions.com.

The permanent direction is the **Bold-Tech Mashup**: bold creator energy in the moments that need attention, supported by a dark, precise, technical interface system everywhere else.

Future pages should feel like they were designed at the same time as the homepage, not merely use the same colors.

---

## 1. Brand idea

### Core visual principle

**Bold first. Tech underneath.**

The brand should feel like:

- a short-form creator who understands attention
- a builder who understands software and technical products
- high energy without looking childish
- technical without looking like a generic SaaS template
- opinionated without becoming chaotic

The visual tension is intentional:

- loud editorial moments + restrained technical layouts
- bright fields + dark UI surfaces
- oversized type + very small system labels
- imperfect creator-style elements + precise grids
- flat graphic color + subtle glows and interface depth

### The feeling to preserve

A visitor should think:

> “This person understands content, but also understands the product.”

Do not drift toward:

- luxury/editorial minimalism
- generic corporate SaaS
- cyberpunk / hacker aesthetics
- influencer pastel styling
- pink/magenta as a primary brand color
- excessive gradients or glassmorphism
- rounded-card-everything UI

---

## 2. Color system

### Core tokens

Use these values consistently.

| Token | Hex | Role |
| --- | --- | --- |
| Background | `#07090D` | Primary dark page background |
| Dark surface | `#0D1117` | Cards and contained technical surfaces |
| Ink / light text | `#F2F5F1` | Primary text on dark backgrounds |
| Muted text | `#8D96A2` | Body/supporting text on dark backgrounds |
| Border | `#2A313B` | Dark-mode dividers and card outlines |
| Electric lime | `#A3FF12` | Primary tech accent and CTA accent |
| Electric blue | `#5968FF` | Bold editorial accent |
| Cyan | `#72E8FF` | Secondary creator-style accent |
| Hero yellow | `#F2EF3F` | Bold hero / campaign field |
| Near-black ink | `#101010` | Text and borders on bright fields |

Recommended CSS variables:

```css
:root {
  --bg: #07090d;
  --surface: #0d1117;
  --ink: #f2f5f1;
  --muted: #8d96a2;
  --line: #2a313b;
  --lime: #a3ff12;
  --blue: #5968ff;
  --cyan: #72e8ff;
  --yellow: #f2ef3f;
  --dark-ink: #101010;
}
```

### Color hierarchy

**Lime** means technology, action, proof, and highlighted information.

Use it for:

- primary accents in dark sections
- section-heading emphasis
- small numbered labels
- active tech indicators
- dark-page CTAs
- technical diagrams and arrows

**Blue** means bold creator/editorial energy.

Use it for:

- the emphasized word in a bright hero
- ticker/marquee bands
- occasional large graphic blocks
- strong CTA shadow/accent treatment

**Yellow** is a high-impact field, not a general background.

Use it for:

- homepage hero
- campaign-style hero panels
- occasional high-priority promotional sections

Do not make every section yellow.

**Cyan** is secondary.

Use it sparingly for:

- sticker/callout elements
- secondary visual accents
- one supporting graphic per viewport

### Color usage rule

A typical page should be approximately:

- 65–80% dark neutrals
- 10–20% bright field color when appropriate
- 5–10% lime
- 5% or less blue/cyan accents outside major bold sections

---

## 3. Typography

### Primary typeface

**Space Grotesk**

Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

Fallback:

```css
font-family: "Space Grotesk", system-ui, sans-serif;
```

Do not introduce additional decorative fonts unless there is a strong campaign-specific reason.

### Display headlines

The brand relies heavily on oversized, tightly set display text.

Desktop characteristics:

- weight: 600–700
- line height: `0.75–0.90`
- letter spacing: `-0.05em` to `-0.08em`
- often uppercase in the boldest sections
- use `clamp()` for responsive size

Example:

```css
.hero-title {
  font-size: clamp(88px, 10.3vw, 160px);
  line-height: .75;
  letter-spacing: -.08em;
  font-weight: 600;
  text-transform: uppercase;
}
```

### Outlined headline text

Outlined text is a signature element in bold hero moments.

```css
.outline-text {
  color: transparent;
  -webkit-text-stroke: 2px #101010;
}
```

Use outlined text for at most one phrase per headline.

### Section headings

Dark-section headings should still be large and assertive:

```css
.section-title {
  font-size: clamp(52px, 5.6vw, 82px);
  line-height: .88;
  letter-spacing: -.06em;
  text-transform: uppercase;
}
```

Highlight only a meaningful phrase with lime.

### Micro labels

The system uses very small uppercase metadata deliberately.

Examples:

- `01 / WHAT I MAKE`
- `TECH UGC`
- `FOUNDER-STYLE UGC`
- `AVAILABLE FOR UGC PROJECTS`

Rules:

- 7–10px desktop
- 7–9px mobile
- uppercase
- letter spacing `0.12em–0.18em`
- medium/bold weight

These labels should create contrast with the huge headlines.

### Body copy

Body copy should remain readable and understated.

- 14–17px for major explanatory copy
- 11–13px inside cards
- line height `1.5–1.7`
- muted gray on dark surfaces
- near-black on yellow/bright surfaces

Avoid long blocks. Prefer 2–4 sentence paragraphs.

---

## 4. Layout and spacing

### Maximum content width

Primary content shell:

```css
.shell {
  width: min(1400px, calc(100% - 56px));
  margin-inline: auto;
}
```

### Page gutters

Desktop:
- minimum 28px per side
- centered inside a maximum 1400px content width

Tablet:
- 28px per side

Mobile:
- 20px per side for hero
- 15–20px minimum elsewhere

**Never allow major text to touch the viewport edge.**

### Section spacing

Default desktop section padding:

- 100–120px top and bottom

Mobile:

- 70–85px top and bottom

Bold/high-impact transitions may be tighter if the visual field itself creates separation.

### Grid philosophy

Use rigid grids for technical sections:

- 2-column hero
- 4-column process
- asymmetric 1.1 / 0.9 portfolio grids
- numbered strip layouts

Then interrupt those grids with creator elements:

- rotated stickers
- oversized type
- a circular CTA
- colored rows
- a ticker
- an intentionally tilted phone/mockup

That contrast is the style.

---

## 5. Hero system

The homepage hero establishes the permanent pattern.

### Hero formula

1. Bright yellow full-width field
2. Small outlined availability/status pill
3. Tiny creator/builder eyebrow
4. Extremely large editorial headline
5. One outlined phrase
6. One electric-blue emphasized word
7. Short supporting copy
8. Black primary CTA with blue offset shadow
9. Dark technical product/phone visual
10. Creator-style stickers
11. Structured “best fit” metadata row
12. Blue ticker immediately after the hero

### Bright hero rules

When using a bright hero on another page:

- use near-black typography
- preserve at least 20px mobile gutters
- keep the bright field full width
- technical visual should remain dark
- at least one element should feel “system/UI”
- at least one element may feel “creator/editorial”
- do not add more than two sticker/callout elements

Not every page requires a yellow hero. Secondary pages can use dark heroes, but should retain the same typography scale and accent language.

---

## 6. Navigation

Navigation should be technical and restrained.

Characteristics:

- dark background
- 1px lower border
- small typography
- compact `TT` brand mark in a bordered rounded square
- nav labels remain secondary to the hero
- CTA uses a thin dark-mode border
- lime may be used for its arrow/accent

Desktop height: approximately 84–88px.

On mobile:

- hide nonessential nav links
- retain brand mark
- retain one clear CTA if space allows

Avoid hamburger menus unless multiple secondary pages make one necessary.

---

## 7. Components

### A. Status pill

Use for availability, project status, format, or small context.

Bright hero version:

- white fill
- 2px black border
- black offset shadow
- small blue status dot

Dark version:

- dark translucent fill
- 1px gray border
- lime status dot/glow

### B. Primary CTA

On bright fields:

- black background
- white text
- blue offset shadow
- square-ish 8px radius

On dark fields:

- lime background
- near-black text
- no heavy gradient

### C. Secondary CTA

- transparent
- border matching foreground
- no filled gray pill unless needed for hierarchy

### D. Sticker / creator callout

Use sparingly.

Characteristics:

- hard border
- offset box shadow
- 3–6 degree rotation
- white or cyan fill
- uppercase condensed message
- no soft shadow
- should look intentionally “placed,” not like a UI card

### E. Tech card

Characteristics:

- very dark surface
- 1px neutral border
- 10–15px corner radius
- tiny metadata label
- technical content/mock UI inside
- little or no generic drop shadow

### F. Numbered strips

Useful for:

- services
- capabilities
- case-study facts
- process summaries
- deliverables

Structure:

`number / title / supporting copy / arrow`

Mix dark rows with an occasional full lime or full blue row.

Do not make every row a different color.

### G. Ticker

Use as a high-energy transition, not a constant gimmick.

- blue background
- white uppercase text
- thin borders
- short repeated phrases
- slow continuous motion
- disable animation for `prefers-reduced-motion`

### H. Circular CTA

Reserved for high-impact closing areas or bold campaign pages.

- dark fill
- light text
- slight rotation
- large enough to feel graphic, not like a standard button

---

## 8. Imagery and product media

The site should prioritize actual creator and product footage over stock imagery.

Best media:

- direct-to-camera vertical video
- screen recordings inside a device frame
- product-use b-roll
- real creator thumbnails
- real software UI
- before/after or process visuals

Avoid:

- generic stock photography
- generic 3D tech illustrations
- AI-generated people pretending to be Tyler
- over-polished SaaS dashboard mockups that do not represent real work

### Device mockups

Phone/device mockups should:

- use dark shells
- be slightly rotated, typically 3–5 degrees
- use strong hard shadows when sitting on a bright hero
- use softer depth when on dark sections
- retain generous internal padding
- not dominate the headline

---

## 9. Borders, radius, and shadows

### Borders

Dark sections:
- `1px solid #2A313B`

Bright/bold elements:
- `2px solid #101010`

### Radius

Use radius with restraint.

- buttons: 8px
- technical cards: 10–15px
- phone: 30–38px
- pills: full radius only for metadata pills
- creator stickers: generally 0–4px

Do not make every container a rounded rectangle.

### Shadows

Two shadow languages exist:

**Tech depth**
- soft black shadow
- low opacity
- used for device mockups / overlays

**Bold/editorial**
- hard offset shadow
- no blur
- black or electric blue
- used for stickers and primary bright-field CTA

Never mix both shadow types on the same small component.

---

## 10. Motion

Motion should support hierarchy, not become the brand.

Allowed:

- slow ticker
- subtle card hover background
- CTA lift by 1–3px
- modest transform on graphic elements
- simple fade/slide entrance if needed

Avoid:

- parallax overload
- giant cursor effects
- constant bouncing stickers
- multiple simultaneous animated gradients
- text that becomes unreadable during motion

Always respect:

```css
@media (prefers-reduced-motion: reduce) {
  /* disable nonessential animation */
}
```

---

## 11. Responsive behavior

The mobile experience is not a compressed desktop layout.

### Mobile priorities

1. Preserve headline impact
2. Preserve gutters
3. Remove nonessential complexity
4. Stack technical content
5. Keep one primary CTA obvious
6. Prevent decorative elements from clipping text

### Key mobile rules

- minimum hero gutter: 20px
- large hero headline: approximately 44–58px depending on copy
- section heading: approximately 44–50px
- multi-column grids collapse to one column
- process grid: 1 column below ~580px
- large technical mockups scale down instead of overflowing
- stickers stay inside viewport bounds
- metadata strips may horizontally scroll if intentionally designed

Test at:

- 320px
- 375px
- 390px
- 430px
- 768px
- 1024px
- 1440px+

---

## 12. Voice and copy style

The copy should feel like Tyler talking to someone who has a real product to explain.

### Voice traits

- direct
- confident
- conversational
- technically comfortable
- mildly provocative when useful
- specific
- anti-corporate-jargon

Good:

> Make the feature feel obvious.

> Don’t gamble on one opening.

> Give me the product. I’ll find the story.

> I figure out why it matters.

Avoid:

> Elevating brands through innovative storytelling solutions.

> Unlock next-level engagement through creator-led synergies.

> We empower brands to maximize authentic omnichannel experiences.

### Headline rule

A headline should usually make one strong claim.

Prefer:
- short declarative phrases
- contrast
- a viewer/product problem
- a clear point of view

Avoid stacking multiple abstract ideas into one headline.

---

## 13. Section sequencing

For most marketing pages, follow a high-energy / low-energy rhythm.

Example:

1. Bold hero
2. Structured tech section
3. High-energy colored interruption
4. Portfolio/product proof
5. Dark explanatory section
6. Structured process/facts
7. Bold closing CTA

Do not place three loud/color-heavy sections back-to-back.

The bold elements work because the dark technical sections create contrast.

---

## 14. Accessibility

Maintain the visual attitude without sacrificing usability.

Requirements:

- semantic HTML
- visible keyboard focus states
- sufficient text/background contrast
- alt text for meaningful images
- buttons/links with clear accessible names
- do not communicate status by color alone
- `prefers-reduced-motion` support
- body text should not fall below 11px; use 14px+ for substantive reading
- outlined display text is decorative emphasis, not the only readable form of critical information

---

## 15. Implementation conventions

### Preferred HTML structure

Use semantic sections:

```html
<header>...</header>
<main>
  <section class="hero">...</section>
  <section>...</section>
</main>
<footer>...</footer>
```

### CSS philosophy

- define colors and fonts as variables
- use CSS Grid for primary structure
- use Flexbox for small alignment problems
- avoid absolute positioning for core readable content
- absolute positioning is acceptable for decorative stickers, device elements, and mock UI
- responsive typography should use `clamp()`
- page-specific deviations should extend the system rather than overwrite it wholesale

### Naming

Prefer role-based names:

- `.hero`
- `.section-head`
- `.feature-card`
- `.status-pill`
- `.sticker`
- `.process-grid`

Avoid arbitrary names such as `.box2`, `.greenThing`, or `.new-section-final`.

---

## 16. New-page templates

### Secondary content page

Use:

- dark navigation
- dark or restrained yellow hero
- oversized title
- tiny section metadata
- lime emphasis
- content contained in 1400px shell
- one blue or cyan interruption
- bold lime/yellow close

### Case study / portfolio page

Recommended order:

1. project/category metadata
2. huge case-study title
3. hero video or vertical-video grid
4. brief / objective
5. hook or creative strategy
6. selected deliverables
7. result / learning
8. related work
9. contact CTA

### Services page

Recommended order:

1. bold promise
2. numbered service strips
3. example deliverables
4. process
5. what the client provides / what Tyler provides
6. CTA

---

## 17. Do / Don’t summary

### Do

- use oversized typography confidently
- keep technical sections structured
- use bright colors in large decisive blocks
- give content breathing room
- maintain 20px+ mobile gutters
- use lime for tech/action and blue for bold/editorial emphasis
- preserve small uppercase metadata labels
- use real product/creator visuals
- allow some intentional asymmetry

### Don’t

- reintroduce pink as a core accent
- turn the site into generic SaaS glassmorphism
- use five accent colors in one section
- make every element rounded
- use decorative motion everywhere
- make mobile text touch the edges
- add tiny unreadable body copy
- use stock imagery to fill space
- reduce the style to “dark background + lime button”

---

## 18. Reference implementation

The canonical reference is:

- `/index.html` — permanent homepage

Prototype history remains available under:

- `/tech/`
- `/bold/`
- `/mashup/`

These prototype paths are references only. New production pages should match the root homepage and this style guide, not copy older prototype details blindly.

When the homepage evolves, update this file if the underlying system changes.
