import { describe, expect, it } from 'vitest';
import { newPhotoId, PHOTO_ID_RE, recommendStyles, stylePrompt, upcomingSeason, validateMarketingPhoto } from './photos';
import { features } from '../plans';
import { createMemoryRepo } from '../repo/memory';

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('fotos de marketing', () => {
  it('ids con formato fijo (sirven en la URL de la imagen)', () => {
    const id = newPhotoId('jpg', 1795330000000);
    expect(PHOTO_ID_RE.test(id)).toBe(true);
    expect(PHOTO_ID_RE.test('../otro/m-1.jpg')).toBe(false);
    expect(PHOTO_ID_RE.test('m-1795330000000-abc123.webp')).toBe(false);
  });

  it('valida tipo y firma real del archivo', () => {
    expect(validateMarketingPhoto({ bytes: JPG, contentType: 'image/jpeg' })).toBeNull();
    expect(validateMarketingPhoto({ bytes: PNG, contentType: 'image/png' })).toBeNull();
    expect(validateMarketingPhoto({ bytes: PNG, contentType: 'image/jpeg' })).toMatch(/no parece/);
    expect(validateMarketingPhoto({ bytes: JPG, contentType: 'image/webp' })).toMatch(/JPG o PNG/);
  });

  it('las instrucciones exigen conservar el producto y no agregar texto', () => {
    for (const s of ['profesional', 'ambiente', 'estudio', 'temporada'] as const) {
      const p = stylePrompt(s, 'restaurante', 'navidad');
      expect(p).toMatch(/Keep the main subject exactly the same/);
      expect(p).toMatch(/Do not add any text/);
    }
    expect(stylePrompt('temporada', 'cafeteria', 'san_valentin')).toMatch(/Valentine/);
  });

  it('recomienda la temporada cercana y el retoque para comida', () => {
    expect(upcomingSeason(new Date('2026-11-22T12:00:00Z'))).toBe('navidad');
    expect(upcomingSeason(new Date('2026-12-30T12:00:00Z'))).toBe('fin_de_ano');
    expect(upcomingSeason(new Date('2026-03-10T12:00:00Z'))).toBeNull();
    const rec = recommendStyles('restaurante', new Date('2026-11-22T12:00:00Z'));
    expect(rec.map((r) => r.style)).toEqual(['temporada', 'profesional', 'estudio']);
    expect(recommendStyles('gimnasio', new Date('2026-03-10T12:00:00Z')).map((r) => r.style)).toEqual(['profesional', 'ambiente']);
  });

  it('cuota de fotos por plan', () => {
    expect([features('basico').aiImages, features('standard').aiImages, features('pro').aiImages]).toEqual([5, 20, 60]);
  });

  it('el repo guarda, lista y resuelve solo fotos del propio negocio', async () => {
    const repo = createMemoryRepo();
    const [a, b] = await repo.listBusinesses();
    const p = await repo.uploadMarketingPhoto(a.id, { bytes: JPG, contentType: 'image/jpeg' });
    expect((await repo.listMarketingPhotos(a.id))[0].id).toBe(p.id);
    expect(await repo.marketingPhotoUrl(a.id, p.id)).toMatch(/^data:image\/jpeg/);
    expect(await repo.marketingPhotoUrl(b.id, p.id)).toBeNull();
    await expect(repo.uploadMarketingPhoto(a.id, { bytes: PNG, contentType: 'image/jpeg' })).rejects.toThrow();
  });

  it('las fotos con IA no gastan la cuota de textos', async () => {
    const repo = createMemoryRepo();
    const [a] = await repo.listBusinesses();
    await repo.recordMarketing(a.id, { kind: 'photo_edit', output: {} });
    await repo.recordMarketing(a.id, { kind: 'post', output: {} });
    expect(await repo.countMarketingSince(a.id, '2000-01-01T00:00:00Z', ['photo_edit'])).toBe(1);
    expect(await repo.countMarketingSince(a.id, '2000-01-01T00:00:00Z', ['post', 'data_post'])).toBe(1);
  });
});
