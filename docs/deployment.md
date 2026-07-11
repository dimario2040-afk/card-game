# Deployment

## Platform

**GitHub Pages** — автоматический деплой через GitHub Actions.

## Pipeline

```
push → main → build → deploy to GitHub Pages
```

## Настройка (один раз)

1. Залить репозиторий на GitHub
2. **Settings → Pages → Source: GitHub Actions**

После этого всё автоматом.

## Manual Deploy

```bash
npm run build
npx gh-pages -d dist
```

## Rollback

GitHub Pages → Actions → выбрать прошлый успешный run → Re-run job → Deploy.
