# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

This is a Next.js 16 application using the App Router with React 19, TypeScript, Tailwind CSS v4, and shadcn/ui.

**Key directories:**
- `src/app/` - Next.js App Router pages and layouts
- `src/components/ui/` - shadcn/ui components
- `src/lib/` - Utilities (includes `cn()` for class merging)

**shadcn/ui configuration:**
- Style: new-york
- Uses Lucide icons
- Add components via: `npx shadcn@latest add <component>`

**Import alias:** `@/*` maps to `./src/*`
