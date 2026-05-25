# Landing Page — Progress Report

## Stack

- **Framework**: Next.js (App Router) + React 19
- **Styling**: Tailwind CSS v4 — `@theme inline {}` di `globals.css`, tidak pakai `tailwind.config.ts`
- **Animation**: GSAP + ScrollTrigger
- **Smooth scroll**: Lenis (lazy-loaded, connect ke GSAP ticker)
- **Fonts**: Aspekta (TTF lokal di `/public/font/`) + Roboto Mono (Google Fonts via `next/font`)

---

## Design System (`globals.css`)

### Warna
| Token | Hex | Tailwind class |
|---|---|---|
| `--color-bg` | `#F7F9FC` | `bg-bg`, `text-bg` |
| `--color-surface` | `#FFFFFF` | `bg-surface` |
| `--color-border` | `#DDE8F2` | `border-border` |
| `--color-text` | `#0C1A2B` | `text-text` |
| `--color-muted` | `#5B7490` | `text-muted` |
| `--color-blue-primary` | `#1591DC` | `bg-blue-primary` |
| `--color-blue-light` | `#4BB8FA` | `bg-blue-light` |
| `--color-blue-pale` | `#EAF4FC` | `bg-blue-pale` |
| `--color-blue-deep` | `#2C5EAD` | `bg-blue-deep` |

### Font stack
```css
--font-sans: 'Aspekta', -apple-system, BlinkMacSystemFont, "avenir next", avenir, "segoe ui", ...
--font-mono: 'Roboto Mono', var(--font-roboto-mono), Menlo, Consolas, ...
```

**Aturan font**: Roboto Mono (`font-mono`) **hanya** dipakai di tombol/button. Semua teks lain pakai Aspekta (`font-sans`).

### CSS helpers
- `.clip-line` — `overflow: hidden` wrapper untuk clip reveal animation (yPercent 110 → 0)
- `.marquee-track` — CSS marquee infinite scroll, dipakai di Footer

---

## Komponen

### `app/layout.tsx`
- Load `Roboto_Mono` dan `Syne` via `next/font/google` (Syne sebagai safety net, tapi fallback utama sudah sistem fonts)
- Metadata: `"Tends — Fire your analyst, deploy your agent."`

### `app/page.tsx`
```
SmoothScroll
  Navbar
  main
    Hero
    HorizontalWords
    HowItWorks
    Strategies
    AgentInAction
  Footer
```

---

### `Navbar.tsx` — Floating pill nav
- **Posisi**: `fixed`, `top: 20px`, `left: 24px`, `right: 24px` — tidak nempel ke tepi viewport
- **Kiri**: Logo "Tends"
- **Kanan**: Pill container (`rounded-2xl`, border) berisi 3 nav links + tombol "Launch App"
- **Scroll behavior**: 
  - Default (di atas hero): pill dark glass (`rgba(12,26,43,0.30)` + blur), teks putih
  - Setelah scroll > 75% hero height: pill putih frosted (`rgba(247,249,252,0.92)` + blur), teks gelap
- Tombol "Launch App": Roboto Mono, `bg-blue-primary`, `rounded-xl`

---

### `Hero.tsx` — Video hero dengan clip reveal
- **Background**: Video `/video/Blue%20total%20blur%20...%23153.mp4` + dark gradient overlay
- **Layout**: Section dengan `mx-5 mt-5 rounded-2xl` — video tidak full width, ada margin dari tepi
- **Teks**: Putih. Line 2 "deploy your agent." pakai `#4BB8FA`
- **GSAP entry animation**:
  1. White overlay opacity 1 → 0 (1.2s)
  2. Line 1 clip reveal: `yPercent: 110 → 0`
  3. Line 2 clip reveal: overlapping
  4. Subtitle + button fade up: `opacity: 0, y: 20 → opacity: 1, y: 0`
- **CTA**: Tombol solid putih besar (`px-8 py-4`) "Deploy your agent →" — Roboto Mono
- **Catatan path video**: Nama file ada spasi dan `#`, di-encode sebagai `%20` dan `%23` di `VIDEO_SRC`

---

### `HorizontalWords.tsx` — Horizontal scroll text
- **Teknik**: CSS sticky (outer `height: 350vh`, inner `sticky top-0 h-screen`)
- **Teks**: `"Always on. Always optimizing. Zero effort."` — font besar, `clamp(5rem, 12vw, 10rem)`
- **Animasi**: ScrollTrigger pada outer div, teks scroll horizontal kiri → kanan via `gsap.fromTo(text, { x: 15vw }, { x: -(scrollWidth - 85vw) })`
- **Letter bounce**: Setiap huruf punya `yPercent` + `rotation` random saat masuk frame (`containerAnimation`)
- **Detail**: Titik (`.`) berwarna `#1591DC`
- **Label bawah**: "Your agent doesn't sleep. Your yield doesn't wait."

---

### `HowItWorks.tsx` — Pinned step reveal
- **Teknik**: CSS sticky (outer `height: 3 × 100vh`, inner `sticky top-0 h-screen`)
- **Layout**: Dua kolom — kiri (44%) pinned label + dots, kanan (56%) step content berubah
- **Steps**: 01 Connect → 02 Pick your strategy → 03 Deploy
- **Animasi**: Single ScrollTrigger pada outer div, `onUpdate(self)` dengan `self.progress * 3` → index aktif
  - Step aktif: `opacity: 1, y: 0`
  - Step sebelumnya: `opacity: 0, y: -28`
  - Step berikutnya: `opacity: 0, y: 28`
- **Dots**: Kiri bawah, aktif = `#1591DC` + ring, non-aktif = `#DDE8F2`

---

### `Strategies.tsx` — Pinned strategy slides
- **Teknik**: CSS sticky (outer `height: 4 × 100vh`, inner `sticky top-0 h-screen`)
- **Layout**: Dua kolom — kiri (44%) headline "Four ways to grow." + dots, kanan (56%) slide berubah
- **Strategies**: 01 Safe & Steady → 02 Balanced Growth → 03 Maximum Yield → 04 Build Your Own
- **Animasi**: Same pattern HowItWorks — single ScrollTrigger, `self.progress`, slide in/out via `x: ±40`
- **CTA per slide**: Tombol "Explore →" (Roboto Mono, border-border), `pointerEvents: 'auto'`
- **Catatan**: APY dihapus — terlalu techy, diganti dengan tagline + deskripsi plain language

---

### `AgentInAction.tsx` — Scroll reveal rows
- **Teknik**: Regular section (tidak pinned) — setiap row punya ScrollTrigger `trigger: row, start: 'top 82%'`
- **Messages**: 4 baris — Checking → Found → Making a move → Done
- **Animasi**: `opacity: 0, y: 24 → opacity: 1, y: 0` saat row masuk viewport
- **Dot**: Dot berwarna `#1591DC` hanya pada message terakhir "Done"
- **CTA**: "Talk to your agent →" (Roboto Mono, `bg-blue-primary`) + "See strategies" (Aspekta, text-muted)

---

### `Footer.tsx` — Marquee + nav links
- **Marquee**: CSS animation infinite — "Always on · Zero effort · Your yield · Your rules · Deploy your agent ·"
- **Layout**: Kiri = statement teks + CTA button, Kanan = nav links besar (Strategies, Dashboard, Chat, Docs)
- **Social icons**: X, In, Gh — circular border, Roboto Mono
- **Bottom bar**: copyright kiri, social icons kiri

---

### `SmoothScroll.tsx` — Lenis wrapper
- Lazy import `lenis` + GSAP di client
- `lenis.on('scroll', ScrollTrigger.update)` — sync Lenis dengan GSAP
- `gsap.ticker.add(time => lenis.raf(time * 1000))` — drive Lenis dari GSAP ticker
- `gsap.ticker.lagSmoothing(0)` — cegah glitch saat tab di-background

---

## Prinsip animasi (penting untuk konsistensi)

**CSS Sticky pattern** — dipakai di HorizontalWords, HowItWorks, Strategies:
```
<div ref={outerRef} style={{ height: 'N × 100vh' }}>         ← drives scroll
  <div className="sticky top-0 h-screen overflow-hidden">    ← CSS pin
    {/* content */}
  </div>
</div>
```
ScrollTrigger di-attach ke `outerRef`, bukan ke inner sticky div. `scrub: false`, `onUpdate(self)` dengan `self.progress`.

**Kenapa bukan `gsap pin: true`**: Tidak reliable di Next.js App Router + React 19 — Lenis + GSAP pin sering konflik dan section tidak bergerak sama sekali.

---

## File & asset penting

| Path | Keterangan |
|---|---|
| `/public/font/Aspekta-*.ttf` | Font Aspekta, weight 50–1000 |
| `/public/video/Blue total blur...#153.mp4` | Video background hero |
| `D:\Coding\tends\DESIGN.md` | Design system doc lengkap |
| `D:\Coding\tends\landing-page\BUILD.md` | Blueprint landing page |

---

## Yang masih perlu dilakukan / dicek

- [ ] Test semua animasi di browser — jalankan `npm run dev` di folder `landing-page`
- [ ] Install deps jika belum: `npm install gsap lenis`
- [ ] Verifikasi video hero load di browser (cek console jika gagal — mungkin perlu rename file video)
- [ ] Mobile responsiveness belum disentuh sama sekali
- [ ] Halaman `/strategies`, `/chat`, `/docs`, `/app` belum dibuat (hanya placeholder href)
- [ ] Warna accent hero line 2 saat di atas video: `#4BB8FA` — bisa dipertimbangkan ulang
- [ ] Footer social icons (X, In, Gh) belum punya href
