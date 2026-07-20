export function renderErrorPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kinga — Error</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #05080f; color: #e2e8f0; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; padding: 2rem; border: 1px solid #1e293b; border-radius: 0.5rem; background: #0f172a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong</h1>
    <p>Please refresh the page or try again later.</p>
    <a href="/" style="color:#38bdf8">Return home</a>
  </div>
</body>
</html>`;
}
