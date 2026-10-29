import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const path of ['index.html', 'faq.html', 'privacy-policy.html', 'terms-of-service.html', 'car-wash.html', 'paint-correction.html', 'ceramic-coatings.html', 'vinyl-wraps.html', 'wrap-visualizer.html','quote.html', 'gallery.html', 'aftercare.html', 'team.html', 'contact.html', 'assets', 'images', 'videos', 'documents', 'models']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
