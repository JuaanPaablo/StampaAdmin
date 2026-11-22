import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/urls';

export default function sitemap(): MetadataRoute.Sitemap {
  const u = appUrl();
  return [
    { url: `${u}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${u}/privacidad`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${u}/terminos`, changeFrequency: 'yearly', priority: 0.2 }
  ];
}
