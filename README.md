# Security

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

PHP view conversion
-------------------

This repository originally used Vue single-file components. I converted the main UI components into simple PHP view templates under the `views/` folder and added an `app.php` entry that loads the correct view based on `?page=`.

How to run locally
------------------

1. From the repository root run a PHP built-in server (requires PHP installed):

	php -S localhost:8000

2. Open http://localhost:8000/app.php?page=home (or `?page=login`, `?page=signup`, `?page=dashboard`).

Notes
-----
- The API endpoints used by the original app are in `api/` (login.php, register.php). The views post JSON to `/api/*.php` expecting the same API contract as before.
- Authentication/session is stored in the browser's localStorage to preserve the original SPA behavior. For a server-side session, integrate `$_SESSION` handling in the API and views.
