# Kamoola Frontend

React 18 + TypeScript + Vite + Tailwind CSS. Manga reading platform.

## Stack

- **Framework**: React 18 with TypeScript
- **Build**: Vite 5
- **Styling**: Tailwind CSS 3 (dark theme only, no light mode)
- **Routing**: React Router v6
- **Data fetching**: TanStack Query v5 (`@tanstack/react-query`)
- **Icons**: lucide-react
- **HTTP**: axios
- **Animation**: framer-motion (install if not present: `npm install framer-motion`)

## Theme Colors

```js
background: '#0f0f0f'   // page bg
surface:    '#1a1a2e'   // cards, navbar, panels
accent:     '#e63946'   // red — primary CTA, highlights
textPrimary: '#eee'
textSecondary: '#888'
```

## Project Structure

```
src/
  pages/          # Route-level components
    HomePage.tsx
    BrowsePage.tsx
    MangaDetailPage.tsx
    ReaderPage.tsx
    SearchResultsPage.tsx
  components/
    layout/       # AppLayout, Navbar, Footer, Sidebar
    manga/        # MangaCard, MangaGrid, ChapterList, FilterPanel
    shared/       # SearchBar, SkeletonCard, StatusBadge, Pagination
  hooks/          # useMangaQueries.ts (TanStack Query hooks)
  api/            # manga.ts (axios calls + getProxiedImageUrl)
  types/          # manga.ts (Manga, Chapter types)
```

## Path Alias

`@/` maps to `src/`. Use `@/components/...` not relative `../`.

## Key Patterns

- **Images**: always proxy via `getProxiedImageUrl(url, source)` from `@/api/manga`
- **Skeleton loading**: use `<SkeletonCard />` and `skeleton` CSS class during load states
- **MangaCard**: `group-hover:scale-105` image zoom already on cards — don't double-add
- **Lazy load images**: `loading="lazy"` on all `<img>` tags
- **Scrollable rows**: `hide-scrollbar` class for horizontal scroll containers

## Animation Guidelines (Framer Motion)

Install: `npm install framer-motion`

Preferred patterns:
```tsx
// Page entrance
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

// Staggered list
<motion.div variants={container} initial="hidden" animate="show">
  {items.map((item, i) => (
    <motion.div key={i} variants={item} />
  ))}
</motion.div>

// Hover card lift
whileHover={{ y: -4, scale: 1.02 }}

// Layout transitions
<AnimatePresence mode="wait">
```

Keep animations subtle: duration 0.2–0.5s, ease "easeOut". No spinning logos.

## Commands

```bash
npm run dev      # dev server (localhost:5173)
npm run build    # tsc + vite build
npm run preview  # preview build
```

## Deployment

Hosted on Vercel. `vercel.json` rewrites all routes to `index.html` (SPA). No SSR.

## Backend API

Base URL from env `VITE_API_URL`. All manga/chapter endpoints proxied through backend to handle CORS and image proxying. See `src/api/manga.ts` for endpoint map.
