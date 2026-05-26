# Tends — Design System

> Dokumen ini mendeskripsikan arah desain, token, dan prinsip visual landing page Tends.
> Update dokumen ini setiap kali ada perubahan desain yang signifikan.

---

## Arah Desain

**"Institutional dark-tech editorial"**

Tends bukan crypto startup biasa — ini adalah produk finansial serius yang kebetulan berbasis AI dan blockchain. Desainnya meminjam bahasa dari dua dunia:

- **Finance/institutional**: warna navy gelap, tipografi ketat, layout yang tenang dan tidak berteriak
- **Tech/product**: monospace untuk label interaktif, animasi scroll yang presisi, video backgrounds

Hasilnya: terasa seperti Bloomberg Terminal yang didesain ulang oleh tim Apple — bukan seperti dashboard DeFi generik dengan gradien ungu.

**Satu kata**: _Precision._

---

## Warna

### Palette Utama

| Token | Nilai | Penggunaan |
|---|---|---|
| `--color-text` | `#0C1A2B` | Teks utama, button dark, backgrounds dark |
| `--color-bg` | `#F7F9FC` | Background halaman, section terang |
| `--color-surface` | `#FFFFFF` | Cards, section intro |
| `--color-muted` | `#5B7490` | Teks sekunder, label, caption |
| `--color-border` | `#DDE8F2` | Divider, border tipis |

### Brand Blues

Digunakan **secara hemat** — aksen, bukan dominan.

| Token | Nilai | Penggunaan |
|---|---|---|
| `--color-blue-deep` | `#2C5EAD` | Strategy card: Conservative |
| `--color-blue-primary` | `#1591DC` | Accent dot, link, highlight |
| `--color-blue-light` | `#4BB8FA` | Hover accent, interactive pop |
| `--color-blue-pale` | `#EAF4FC` | Strategy card: Custom (paling soft) |

### Prinsip Warna

- Dominasi dua kutub: **gelap navy** (`#0C1A2B`) dan **putih/off-white** (`#F7F9FC`).
- Blues hanya muncul di momen spesifik — jangan tersebar rata di seluruh halaman.
- `#1591DC` sudah dipakai di HorizontalWords (titik-titik di teks) — gunakan hemat.
- Video backgrounds boleh "warna-warni" karena di-overlay gelap semi-transparan.

---

## Tipografi

### Font Stack

| Peran | Font | Variable |
|---|---|---|
| Display / Heading / Body | **Aspekta** (custom, lokal) | `--font-sans` |
| Button / Label / UI | **Roboto Mono** | `--font-mono` |

> Syne diload di `layout.tsx` tapi tidak aktif dipakai — bisa dihapus jika tidak direncanakan.

### Scale

| Konteks | Nilai |
|---|---|
| Hero headline | `clamp(4rem, 9.5vw, 7rem)` |
| Section heading | `clamp(3rem, 5.5vw, 5rem)` |
| Card heading | `clamp(1.6rem, 2.4vw, 2.4rem)` |
| Body / paragraph | `clamp(1rem, 1.5vw, 1.5rem)` |
| Mono button / label | `0.78rem` (desktop), `0.7rem` (mobile) |
| Caption / meta | `0.75–0.82rem` |

### Prinsip Tipografi

- **Tracking negatif** di semua display text: `-0.03em` sampai `-0.04em` — kesan editorial, padat, confident.
- **Line height ketat** untuk heading: `0.85–0.95`. Untuk body: `1.6–1.7`.
- **Roboto Mono selalu uppercase** untuk semua elemen interaktif (buttons, label, counter).
- Tidak ada `letter-spacing` positif di buttons — terasa lebih natural dan modern.
- Aspekta weight 700 untuk heading, 400–500 untuk body.

---

## Spacing

### Responsive Tokens

```css
/* Desktop */
--page-px:   70px;   /* padding horizontal halaman */
--nav-inset: 70px;   /* jarak navbar dari tepi */
--hero-px:   40px;   /* indentasi inner hero */

/* Mobile (≤768px) */
--page-px:   20px;
--nav-inset: 20px;
--hero-px:   16px;
```

### Border Radius

| Elemen | Nilai |
|---|---|
| Button CTA (hero, navbar) | `12–14px` |
| Card / section container | `20px` |
| Section wrapper rounding | `28px` |
| Circle (social, counter) | `50%` |

---

## Animasi

### Stack

- **GSAP + ScrollTrigger** — semua animasi scroll-driven dan entry sequence
- **Lenis** — smooth scroll sebagai pengganti native scroll

### Prinsip

1. **Motion adalah dekorasi, bukan gangguan.** Kalau animasi dihapus, layout tetap harus terbaca sempurna.
2. **Scroll = waktu.** Setiap section menggunakan scroll sebagai timeline — user mengontrol tempo.
3. **Satu animasi besar per section**, bukan banyak micro-animations kecil yang bertebaran.

### Easing

| Konteks | Easing |
|---|---|
| Entry reveals (slide up) | `power3.out` |
| State changes (wipe, card swap) | `power2.inOut` |
| Button micro-interaction | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Scroll scrub | `none` (linear) |

### Durasi

| Konteks | Durasi |
|---|---|
| Wipe fill (button hover) | `0.65s` |
| Icon slide diagonal | `0.55s` |
| Color / text transition | `0.65s` |
| Card panel swap (Strategies) | `0.55s` |
| Page entry zoom | `1.5s` |

### Pattern: Clip-line Reveal

Teks slide naik dari bawah, parent `overflow: hidden` jadi masker:

```jsx
<div className="clip-line"> {/* overflow: hidden + padding-bottom: 0.2em */}
  <div ref={textRef}> {/* gsap: yPercent 110 → 0 */}
    Heading
  </div>
</div>
```

### Pattern: Wipe Fill Button

Layer absolut slide naik dari bawah saat hover:

```jsx
<span style={{
  position: "absolute", bottom: 0, left: 0, right: 0,
  height: hovered ? "100%" : "0%",
  transition: "height 0.65s cubic-bezier(0.4, 0, 0.2, 1)",
}} />
```

### Pattern: Icon Diagonal Conveyor

Dua span bertumpuk dalam wrapper `overflow: hidden` — satu keluar ke kanan-atas, satu masuk dari kiri-bawah:

```jsx
// Wrapper: width & height = ukuran icon, overflow: hidden
// arr-out
transform: hovered ? "translate(200%, -200%)" : "translate(0, 0)"
// arr-in
transform: hovered ? "translate(0, 0)" : "translate(-200%, 200%)"
```

Icon menggunakan `stroke="currentColor"` — otomatis ikut warna text tanpa kode tambahan.

---

## Komponen

### Navbar

- Fixed, full-width, `z-50`, entry: slide down setelah hero zoom selesai (~1.15s delay)
- Logo **Aspekta** semibold, klik scroll ke top
- CTA "Launch App": dark navy + white wipe + rocket icon conveyor
- **Color-aware**: otomatis switch warna saat melewati white section vs dark section (scroll listener + DOM refs)
- Tidak ada border, tidak ada background pill saat di hero section

### Buttons CTA

| | Hero ("Deploy Your Agent") | Navbar ("Launch App") |
|---|---|---|
| Background idle | `#ffffff` | `#0C1A2B` |
| Wipe color | `#0C1A2B` | `#ffffff` |
| Text idle | `#0C1A2B` | `#ffffff` |
| Text hover | `#ffffff` | `#0C1A2B` |
| Icon | Arrow ↗ | Rocket |
| Border radius | `14px` | `12px` |
| Padding | `12px 12px 12px 22px` | sama |

- Icon **tanpa lingkaran** — inline langsung, warna via `currentColor`
- Tidak ada shadow, border, atau efek lift

### Video Frame (Hero)

- Padding `14px` / `8px` (mobile) saat di paling atas → menciptakan white inset frame
- Collapse ke `padding: 0, border-radius: 0` saat scroll turun
- Restore otomatis saat scroll kembali ke top

### Strategy Cards (Strategies)

- Outer card: video background, `border-radius: 20px`, `overflow: hidden`
- LEFT panel: solid color animasi (`yPercent: 100 → 0`) — naik menutupi panel sebelumnya
- RIGHT panel: teks slides (`yPercent: 100/−100 → 0`)
- Dot nav: indicator kecil `6px`, opacity transition
- Mobile: color panel jadi overlay absolute `inset: 0` di atas seluruh card

### Footer

- Full-viewport, `background: #0C1A2B`, video bg + overlay `opacity: 0.6`
- Brand name "Tends." `clamp(5rem, 18vw, 16rem)` — dim by default, spotlight on hover
- Spotlight: `radial-gradient` mask follow cursor position

---

## Struktur Halaman

```
1. Hero           dark   — zoom entry, headline reveal, CTA
2. How It Works   dark   — sticky slides scroll-driven (720vh)
3. Horizontal Words light — scroll-driven horizontal text, letter bounce
4. Strategies     mixed  — white intro pinned → dark animated card (400vh)
5. Footer         dark   — video bg, brand spotlight
```

**Ritme gelap ↔ terang:**
```
Dark → Dark → Light → Light+Dark → Dark
```

Section terang di tengah (HorizontalWords, Strategies intro) memberi "napas" sebelum kembali ke dark footer.

---

## Do & Don't

### ✅ Do
- Tracking negatif di semua heading
- Video + overlay gelap untuk atmospheric backgrounds
- Animasi tied ke scroll — bukan auto-play tanpa kontrol user
- Roboto Mono uppercase untuk semua label interaktif
- Generous whitespace — jangan takut ruang kosong
- Gunakan `clamp()` untuk fluid typography

### ❌ Don't
- Gradien ungu/pink — terlalu "AI startup generic"
- Terlalu banyak aksen biru di satu tampilan
- Shadow di buttons — desain ini shadow-free intentionally
- Inter, Space Grotesk, atau font generik lainnya
- Animasi spinning/bouncing — ini bukan landing page gaming
- Warna baru di luar palette yang sudah didefinisikan
