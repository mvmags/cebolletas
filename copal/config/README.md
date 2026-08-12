# Supabase environments

The browser selects its Supabase project from the hostname:

- `localhost`, `127.0.0.1`, and `[::1]` load `development.js`.
- Every other hostname loads `production.js`.

Create the local development configuration once:

```bash
cp copal/config/development.example.js copal/config/development.js
```

Replace both placeholders in `development.js` with the development project's
URL and publishable key. The file is ignored by Git. Never use a secret or
`service_role` key in these browser configuration files.

Serve the repository over HTTP; opening `index.html` with a `file://` URL is not
supported:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/copal/`
- `http://localhost:8080/copal/manage/`

In the browser console, this expression should return the development project
reference while running locally:

```js
(await import("/copal/config/environment.js")).default
```
