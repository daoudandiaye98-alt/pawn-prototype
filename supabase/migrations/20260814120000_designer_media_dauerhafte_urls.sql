-- Rochade-Fund 2 (Teil O Fix): Werkbilder liefen nach einem Jahr ab.
--
-- rehost() der Rochade UND die regulären Upload-Stellen (Werke, Markenbilder,
-- /start) speicherten signierte designer-media-URLs mit 365 Tagen Gültigkeit
-- dauerhaft in den Tabellen — nach zwölf Monaten wären alle diese Bilder
-- gebrochen. Der Bucket ist über die bestehende Policy "Public read published
-- designer-media by signed URL" (SELECT für anon+authenticated auf alle
-- designer-media-Objekte) ohnehin effektiv öffentlich lesbar; wir machen das
-- ehrlich: Bucket öffentlich, dauerhafte /object/public/-URLs speichern.
-- Der mediathek-Bucket bleibt bewusst privat (Arbeitsmaterial, eigenes Muster).

UPDATE storage.buckets SET public = true WHERE id = 'designer-media';

-- Bestand migrieren: signierte URLs -> dauerhafte öffentliche URLs.
-- /storage/v1/object/sign/designer-media/<pfad>?token=... ->
-- /storage/v1/object/public/designer-media/<pfad>

UPDATE public.products
SET image_url = regexp_replace(image_url, '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1')
WHERE image_url LIKE '%/storage/v1/object/sign/designer-media/%';

UPDATE public.designers
SET
  hero_image_url    = CASE WHEN hero_image_url    LIKE '%/object/sign/designer-media/%' THEN regexp_replace(hero_image_url,    '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1') ELSE hero_image_url    END,
  banner_url        = CASE WHEN banner_url        LIKE '%/object/sign/designer-media/%' THEN regexp_replace(banner_url,        '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1') ELSE banner_url        END,
  portrait_url      = CASE WHEN portrait_url      LIKE '%/object/sign/designer-media/%' THEN regexp_replace(portrait_url,      '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1') ELSE portrait_url      END,
  atelier_image_url = CASE WHEN atelier_image_url LIKE '%/object/sign/designer-media/%' THEN regexp_replace(atelier_image_url, '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1') ELSE atelier_image_url END,
  avatar_url        = CASE WHEN avatar_url        LIKE '%/object/sign/designer-media/%' THEN regexp_replace(avatar_url,        '/storage/v1/object/sign/designer-media/([^?]+)\?.*$', '/storage/v1/object/public/designer-media/\1') ELSE avatar_url        END
WHERE hero_image_url    LIKE '%/object/sign/designer-media/%'
   OR banner_url        LIKE '%/object/sign/designer-media/%'
   OR portrait_url      LIKE '%/object/sign/designer-media/%'
   OR atelier_image_url LIKE '%/object/sign/designer-media/%'
   OR avatar_url        LIKE '%/object/sign/designer-media/%';
