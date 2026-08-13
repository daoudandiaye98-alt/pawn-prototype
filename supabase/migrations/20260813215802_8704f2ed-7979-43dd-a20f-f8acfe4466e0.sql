UPDATE public.products
SET image_url = regexp_replace(image_url, '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1')
WHERE image_url ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/';

UPDATE public.designers
SET
  hero_image_url    = CASE WHEN hero_image_url    ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/' THEN regexp_replace(hero_image_url,    '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1') ELSE hero_image_url    END,
  banner_url        = CASE WHEN banner_url        ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/' THEN regexp_replace(banner_url,        '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1') ELSE banner_url        END,
  portrait_url      = CASE WHEN portrait_url      ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/' THEN regexp_replace(portrait_url,      '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1') ELSE portrait_url      END,
  atelier_image_url = CASE WHEN atelier_image_url ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/' THEN regexp_replace(atelier_image_url, '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1') ELSE atelier_image_url END,
  avatar_url        = CASE WHEN avatar_url        ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/' THEN regexp_replace(avatar_url,        '^.*/storage/v1/object/(?:sign|public|authenticated)/designer-media/([^?#]+).*$', '\1') ELSE avatar_url        END
WHERE hero_image_url    ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/'
   OR banner_url        ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/'
   OR portrait_url      ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/'
   OR atelier_image_url ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/'
   OR avatar_url        ~ '/storage/v1/object/(sign|public|authenticated)/designer-media/';