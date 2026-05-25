# Tends — Design System

## Philosophy
Clean, minimalist, modern. Terinspirasi dari IntegratedBio.com.
Dark image sebagai hero background. Tipografi besar dan bold. Whitespace yang lega dan percaya diri.
Kesan: premium, intelligent, effortless.

## Copywriting Rule
**Semua teks yang tampil di UI (headline, subtitle, button, label, notif, footer) HARUS dalam Bahasa Inggris.**
Tidak ada teks Indonesia di produk.

---

## Color Palette

| Token | Hex | Role |
|---|---|---|
| `--blue-deep` | `#2C5EAD` | Secondary button, dark surface, panel |
| `--blue-primary` | `#1591DC` | Primary CTA, active states, links |
| `--blue-light` | `#4BB8FA` | Hover, highlight, glow, accent detail |
| `--blue-pale` | `#C4E2F5` | Muted text, caption, subtle tint |
| `--white` | `#FFFFFF` | Primary text di atas dark bg |
| `--black` | `#080E1A` | Fallback background (jika no image) |

### Tailwind Config
```js
colors: {
  'blue-deep':    '#2C5EAD',
  'blue-primary': '#1591DC',
  'blue-light':   '#4BB8FA',
  'blue-pale':    '#C4E2F5',
  'tends-black':  '#080E1A',
}
```

---

## Typography

| Penggunaan | Font | Weight | Notes |
|---|---|---|---|
| Display / Headline besar | Aspekta | 700–800 | Tracking ketat (-0.02em) |
| Body / Subtext | Aspekta | 400 | Readable, clean |
| Button / Label / Tag | Roboto Mono | 500 | Uppercase, letter-spacing lebar |

### CSS Tokens
```css
--font-display: 'Aspekta', sans-serif;
--font-mono: 'Roboto Mono', monospace;

--text-display: clamp(3rem, 8vw, 7rem);
--text-h2: clamp(2rem, 5vw, 4rem);
--text-body: 1.125rem;
--text-caption: 0.875rem;

--tracking-display: -0.02em;
--tracking-mono: 0.08em;
```

---

## Animation Principles

| Animasi | Detail |
|---|---|
| Hero entry | Screen putih → background image scale dari tengah → overlay fade → text clip reveal line by line |
| Clip reveal | Text tersembunyi di balik mask, slide keluar ke bawah, staggered per baris |
| Scroll animations | GSAP ScrollTrigger, scrub-based, smooth |
| Transition duration | 0.8s default, ease: `power2.out` |
| Stagger delay | 0.15s antar elemen |

---

## Component Tokens

### Button Primary
```
Background : #1591DC
Text       : #FFFFFF
Font       : Roboto Mono, 500, uppercase
Padding    : 14px 28px
Hover      : background #4BB8FA, transition 0.3s
```

### Button Secondary
```
Background : transparent
Border     : 1px solid #2C5EAD
Text       : #C4E2F5
Font       : Roboto Mono, 500, uppercase
Hover      : border #4BB8FA, text #FFFFFF
```

### Card
```
Background : rgba(8, 14, 26, 0.6)  (tends-black + opacity)
Border     : 1px solid rgba(75, 184, 250, 0.2)
Backdrop   : blur(12px)
Radius     : 12px
```

---

## Design Inspirations

| Referensi | Dipakai untuk |
|---|---|
| IntegratedBio.com | Layout hero, spacing, dark bg + large type |
| Truus.co | HorizontalWords scroll animation (GSAP) |
| Capsule | StickyCols (kartu geser), Footer structure |
