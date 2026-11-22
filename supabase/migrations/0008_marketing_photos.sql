-- 0008: fotos de Marketing (subidas por el negocio y mejoradas con IA vía fal.ai).

-- Las fotos viven en el bucket público "branding", carpeta <negocio>/marketing/. Las fotos que devuelve la IA
-- (2K, JPG) pueden pasar de 2 MB: se sube el límite del bucket a 6 MB. Logo y portada siguen validados a 2 MB en la app.
update storage.buckets set file_size_limit = 6291456 where id = 'branding';

-- Nuevo tipo de registro: una foto mejorada con IA (cuenta para la cuota mensual de imágenes del plan).
alter table public.marketing_generations drop constraint if exists marketing_generations_kind_check;
alter table public.marketing_generations add constraint marketing_generations_kind_check
  check (kind in ('post','data_post','calendar','review_reply','photo_edit'));
