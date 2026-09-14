import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'faq.html', 'privacy-policy.html', 'terms-of-service.html', 'images', 'videos', 'documents']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
