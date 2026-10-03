-- Teil O / 6 — Quellbilder für die Deko-Aufsteller.
-- Die Bilder sind mit Higgsfield erzeugt (Recraft V4.1 utility, weißer Grund, frontal,
-- vollständig im Bild). `quelle_url` ist die Vorlage; die Edge Function `freistellen`
-- macht daraus ein PNG mit Alphakanal in `site-assets/deko/<key>.png` und setzt
-- `cutout_url` sowie `aktiv = true`.
-- `licht_spot` bekommt kein Bild: weiches Licht wird in der 3D-Szene erzeugt.

alter table public.heft_deko add column if not exists quelle_url text;
alter table public.heft_deko add column if not exists notiz text;

update public.heft_deko d
   set quelle_url = 'https://d8j0ntlcm91z4.cloudfront.net/user_3FFmfcWYyfOcmhlCAnaEeDIhxeQ/' || v.datei
  from (values
 ('sockel_weiss','hf_20260912_144547_edede8c2-01aa-4208-85c4-b5c4a72b889f.png'),
 ('sockel_holz','hf_20260912_144657_47540b4f-1804-4381-9c0f-2ac969592caf.png'),
 ('sockel_stein','hf_20260912_144657_eb0633c5-59d8-4035-9f12-c076b144210f.png'),
 ('bogen_papier','hf_20260912_144416_33120b6e-8564-4fd7-b74c-dfe581ccea8e.png'),
 ('bogen_schwarz','hf_20260912_144547_4fd0b8a2-0807-4294-a08c-3fd6b427990c.png'),
 ('rahmen_gold','hf_20260912_144547_bce730ee-a736-4ad6-a637-52f4625fcdc0.png'),
 ('rahmen_schwarz','hf_20260912_144547_16982274-ea23-43ab-863f-b2084b7dc7e9.png'),
 ('vorhang_leinen','hf_20260912_144416_6e54cdcc-ea77-479c-a863-3c562853b62c.png'),
 ('vorhang_samt','hf_20260912_144547_7c576f25-32cb-40db-9c91-5353b3e3eb42.png'),
 ('wand_beton','hf_20260912_144657_8fa96c80-faf0-4ce5-8f2c-d3f5d0b3270e.png'),
 ('wand_terrakotta','hf_20260912_144604_266db407-7d95-4eae-a985-797db9a9fba2.png'),
 ('pflanze_olive','hf_20260912_144416_ad691a10-7e8d-4c65-85dd-f7a721137703.png'),
 ('pflanze_monstera','hf_20260912_144604_b60c361f-d5ca-4e89-a768-f239a8264594.png'),
 ('zweig_magnolie','hf_20260912_144604_385f11ec-f3ae-430a-b31a-8dbe6aee8c3a.png'),
 ('zweig_trocken','hf_20260912_144416_47c558a4-94c5-4af7-938c-7ae32bf921e8.png'),
 ('papier_bogen','hf_20260912_144604_4c168a59-f37d-4949-8441-856fb97216da.png'),
 ('papier_stapel','hf_20260912_144604_a42d2dab-1f59-49ab-bd4f-45e1ac77ff58.png'),
 ('form_kugel','hf_20260912_144417_3ef42300-bc7c-4f19-801e-de00763fddce.png'),
 ('form_saeule','hf_20260912_144604_d3908bad-2afd-4687-b435-b074bae33b0c.png'),
 ('licht_stehlampe','hf_20260912_144604_1a7e0e61-a554-47ff-b6a5-4e7bf6d372c0.png')
  ) as v(key, datei)
 where d.key = v.key;

update public.heft_deko
   set notiz = 'Kein Aufsteller: weiches Licht wird in der 3D-Szene erzeugt, nicht als freigestelltes Bild.'
 where key = 'licht_spot';

