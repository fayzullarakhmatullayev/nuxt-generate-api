# nuxt-generate-api

> ⚡ Instantly generate typed composables and API types from a Swagger/OpenAPI spec for Nuxt projects.

---

## 📦 What is this?

`nuxt-generate-api` is a CLI tool that takes a `swagger.json` file and generates:

- Fully-typed composables: `composables/useApi.ts`
- API type definitions: `types/api.types.ts`
- A typed fetch wrapper: `composables/useApiService.ts`

Built for **Nuxt 3**, using `$fetch`, `useRuntimeConfig`, and TypeScript.

---

## 🛠 Installation

```bash
npm install -D nuxt-generate-api
```

Or use via `npx`:

```bash
npx nuxt-generate-api
```

---

## 🚀 Usage

1. Download your Swagger spec:

> 💡 Tip: If using Swagger UI, open DevTools → Network → refresh → find a `.json` file like `openapi.json`, right-click → "Save as" → `swagger.json`

2. Place the `swagger.json` file in the root of your Nuxt project.

3. Run:

```bash
npx nuxt-generate-api
```

This will generate:

```
/types/api.types.ts           ← All request & response types
/composables/useApi.ts        ← Typed composables (e.g., createUser, getPosts)
/composables/useApiService.ts ← Reusable fetch helper
```

---

## 📁 File Outputs

### `types/api.types.ts`

- Types generated from `components.schemas`
- Request/response interfaces per endpoint

### `composables/useApi.ts`

- Auto-generated composables for each endpoint
- Uses `useApiService<T>()` under the hood

### `composables/useApiService.ts`

- A wrapper around `$fetch` with built-in support for:
  - Query params
  - Request body
  - Runtime API base URL from `useRuntimeConfig`

---

## 🧩 Example

```ts
// In your Nuxt 3 component or composable
const { createUser, getPosts } = useApi();

const result = await createUser({
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

---

## 📌 Requirements

- Node.js v16+
- Nuxt 3 (uses `useRuntimeConfig` and `$fetch`)
- A valid `swagger.json` file

---

## 💡 Roadmap

- [ ] CLI arguments (`--input`, `--output`)
- [ ] Support OpenAPI 3.1
- [ ] Optional `zod` validation output
- [ ] GitHub Action support for CI type generation

---

## 📝 License

MIT

---

## 🙌 Acknowledgements

Created by [Fayzulla Rahmatullayev](https://github.com/fayzullarhmatullayev)  
Inspired by `openapi-typescript`, `swagger-typescript-api`, and `Nuxt` DX best practices.

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/fayzullarhmatullayev/nuxt-generate-api)
