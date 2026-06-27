# Contributing to Learning Management Platform

Thanks for helping improve LMP. This project is intended to be shared openly, so clear, incremental contributions are especially welcome.

## Ways to Contribute

- Fix bugs.
- Improve documentation.
- Suggest UX or accessibility improvements.
- Add or refine tests.
- Help with performance tuning.

## Before You Start

- Read `README.md`.
- Skim `_edumanage-lite-docs/ROADMAP.md` and `_edumanage-lite-docs/SPEC_FINAL.md`.
- Check existing issues or open a new one before building a large change.

## Local Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Development Guidelines

- Keep changes small and focused.
- Prefer clear service/repository boundaries over duplicated logic.
- Update tests when behavior changes.
- Use the existing naming conventions and docs vocabulary.

## Pull Requests

- Describe what changed and why.
- Include screenshots for UI changes when useful.
- Mention any test coverage added or skipped.
- Note any migration, script, or environment impact.

## Need Help?

Open an issue with the relevant screen, file, or error message. The more concrete the report, the faster someone can help.

