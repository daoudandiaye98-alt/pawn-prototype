
-- =============================================================
-- ZUG C — Fashion Brain: Ontology, Trends, Memory
-- =============================================================

-- ------------- 1. FASHION ONTOLOGY -------------
DO $$ BEGIN
  CREATE TYPE public.ontology_kind AS ENUM ('category','silhouette','material','color','attribute','style');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.fashion_ontology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  kind public.ontology_kind NOT NULL,
  world text[] NOT NULL DEFAULT ARRAY['Mode']::text[],
  parent_term text,
  synonyms text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fashion_ontology TO anon, authenticated;
GRANT ALL ON public.fashion_ontology TO service_role;
ALTER TABLE public.fashion_ontology ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ontology_public_read" ON public.fashion_ontology FOR SELECT USING (true);
CREATE POLICY "ontology_admin_write" ON public.fashion_ontology FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_ontology_updated BEFORE UPDATE ON public.fashion_ontology
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ontology_kind ON public.fashion_ontology(kind);
CREATE INDEX IF NOT EXISTS idx_ontology_synonyms ON public.fashion_ontology USING GIN(synonyms);

-- Seed
INSERT INTO public.fashion_ontology (term, kind, world, synonyms) VALUES
-- Categories Mode
('mantel','category','{Mode}','{coat,overcoat,paletot}'),
('trenchcoat','category','{Mode}','{trench}'),
('blazer','category','{Mode}','{sakko,jacket}'),
('jacke','category','{Mode}','{jacket}'),
('lederjacke','category','{Mode}','{leather jacket,biker}'),
('kleid','category','{Mode}','{dress,robe}'),
('abendkleid','category','{Mode}','{evening dress,gown}'),
('rock','category','{Mode}','{skirt}'),
('hose','category','{Mode}','{trousers,pants,cordhose,jeans}'),
('anzug','category','{Mode}','{suit}'),
('hemd','category','{Mode}','{shirt,bluse,blouse}'),
('t-shirt','category','{Mode}','{tee,shirt}'),
('strick','category','{Mode}','{knit,pullover,pulli,sweater,cardigan,strickjacke}'),
('mantel-cape','category','{Mode}','{cape,poncho}'),
('tasche','category','{Mode}','{bag,handtasche,shopper,tote,clutch}'),
('rucksack','category','{Mode}','{backpack}'),
('schuh','category','{Mode}','{shoe,shoes,boots,stiefel,sneaker,loafer,pumps}'),
('gürtel','category','{Mode}','{belt}'),
('schal','category','{Mode}','{scarf,tuch}'),
('mütze','category','{Mode}','{hat,beanie,cap}'),
('schmuck','category','{Mode}','{jewelry,ring,kette,ohrring,earring,necklace}'),
-- Categories Interior
('leuchte','category','{Interior}','{lamp,lampe,pendel,pendant,floor lamp,tischlampe}'),
('tisch','category','{Interior}','{table,esstisch,coffee table,couchtisch}'),
('stuhl','category','{Interior}','{chair,dining chair}'),
('sessel','category','{Interior}','{armchair}'),
('sofa','category','{Interior}','{couch}'),
('regal','category','{Interior}','{shelf,shelves,bücherregal}'),
('kommode','category','{Interior}','{dresser,sideboard}'),
('bett','category','{Interior}','{bed}'),
('spiegel','category','{Interior}','{mirror}'),
('vase','category','{Interior}','{vessel}'),
('teppich','category','{Interior}','{rug,carpet}'),
('kissen','category','{Interior}','{cushion,pillow}'),
('decke','category','{Interior}','{blanket,throw}'),
('keramik','category','{Interior}','{ceramic,pottery,schale,bowl}'),
-- Categories Kunst
('gemälde','category','{Kunst}','{painting}'),
('skulptur','category','{Kunst}','{sculpture}'),
('edition','category','{Kunst}','{print,druck,editionsdruck}'),
('fotografie','category','{Kunst}','{photograph,photography,foto}'),
('tapisserie','category','{Kunst}','{tapestry,wandteppich}'),
('zeichnung','category','{Kunst}','{drawing}'),
('collage','category','{Kunst}','{collage}'),
('installation','category','{Kunst}','{installation}'),
('objekt','category','{Kunst}','{object}'),
-- Silhouettes
('oversized','silhouette','{Mode,Interior}','{oversize,weit,voluminös}'),
('tailliert','silhouette','{Mode}','{fitted,taillenbetont}'),
('skulptural','silhouette','{Mode,Interior,Kunst}','{sculptural,plastisch}'),
('fließend','silhouette','{Mode}','{fluid,drapiert,flowing,drapey}'),
('kastig','silhouette','{Mode,Interior}','{boxy,geradlinig}'),
('asymmetrisch','silhouette','{Mode,Kunst}','{asymmetric,unregelmäßig}'),
('drapiert','silhouette','{Mode}','{draped}'),
('cropped','silhouette','{Mode}','{kurz,verkürzt}'),
('bodenlang','silhouette','{Mode}','{floor length,lang,maxi}'),
('a-linie','silhouette','{Mode}','{a-line}'),
('gerade','silhouette','{Mode,Interior}','{straight,gradlinig}'),
('organisch','silhouette','{Interior,Kunst}','{organic,geschwungen}'),
('minimalistisch','silhouette','{Mode,Interior,Kunst}','{minimalist}'),
('monolithisch','silhouette','{Interior,Kunst}','{monolithic,massiv}'),
-- Materials
('wolle','material','{Mode,Interior}','{wool,merino}'),
('seide','material','{Mode}','{silk}'),
('leinen','material','{Mode,Interior}','{linen}'),
('baumwolle','material','{Mode}','{cotton}'),
('kaschmir','material','{Mode}','{cashmere}'),
('alpaka','material','{Mode}','{alpaca}'),
('mohair','material','{Mode}','{mohair}'),
('cord','material','{Mode}','{corduroy,cordhose}'),
('samt','material','{Mode,Interior}','{velvet}'),
('leder','material','{Mode,Interior}','{leather}'),
('veganes leder','material','{Mode}','{vegan leather,kunstleder}'),
('denim','material','{Mode}','{jeans}'),
('tweed','material','{Mode}','{tweed}'),
('eiche','material','{Interior}','{oak}'),
('nussbaum','material','{Interior}','{walnut}'),
('esche','material','{Interior}','{ash}'),
('kirsche','material','{Interior}','{cherry}'),
('stahl','material','{Interior,Kunst}','{steel}'),
('edelstahl','material','{Interior,Kunst}','{stainless steel}'),
('messing','material','{Interior,Kunst}','{brass}'),
('bronze','material','{Interior,Kunst}','{bronze}'),
('kupfer','material','{Interior,Kunst}','{copper}'),
('aluminium','material','{Interior,Kunst}','{aluminum}'),
('glas','material','{Interior,Kunst}','{glass}'),
('keramik','material','{Interior,Kunst}','{ceramic,steinzeug,porzellan,porcelain}'),
('marmor','material','{Interior,Kunst}','{marble}'),
('travertin','material','{Interior}','{travertine}'),
('beton','material','{Interior,Kunst}','{concrete}'),
('papier','material','{Kunst}','{paper}'),
('öl auf leinwand','material','{Kunst}','{oil on canvas,ölfarbe}'),
('acryl','material','{Kunst}','{acrylic}'),
('gouache','material','{Kunst}','{gouache}'),
('tinte','material','{Kunst}','{ink,tusche}'),
('holz','material','{Interior,Kunst}','{wood}'),
('rattan','material','{Interior}','{rattan,korb}'),
-- Colors
('schwarz','color','{Mode,Interior,Kunst}','{black,noir}'),
('weiß','color','{Mode,Interior,Kunst}','{white,blanc,ivory,off-white}'),
('ecru','color','{Mode,Interior}','{écru,natur,natural,undyed}'),
('creme','color','{Mode,Interior}','{cream,creamy}'),
('grau','color','{Mode,Interior,Kunst}','{gray,grey}'),
('anthrazit','color','{Mode,Interior}','{anthracite,charcoal}'),
('camel','color','{Mode,Interior}','{tan,beige}'),
('braun','color','{Mode,Interior}','{brown}'),
('cognac','color','{Mode,Interior}','{cognac,rost,rust}'),
('bordeaux','color','{Mode,Interior}','{burgundy,wein,wine}'),
('marine','color','{Mode,Interior}','{navy,dunkelblau}'),
('petrol','color','{Mode,Interior}','{teal}'),
('oliv','color','{Mode,Interior}','{olive,khaki}'),
('safran','color','{Mode,Interior,Kunst}','{saffron,senf,mustard}'),
('rosé','color','{Mode,Interior}','{rose,blush,puder,powder}'),
('koralle','color','{Mode,Interior,Kunst}','{coral}'),
('taupe','color','{Mode,Interior}','{taupe,greige}'),
-- Attributes / Styles
('minimal','attribute','{Mode,Interior,Kunst}','{minimalistisch,reduziert,minimalism,pur}'),
('brutalistisch','attribute','{Interior,Kunst,Mode}','{brutalist,roh,raw}'),
('romantisch','attribute','{Mode,Kunst}','{romantic,verspielt}'),
('streng','attribute','{Mode,Interior,Kunst}','{strict,strikt,formal}'),
('ruhig','attribute','{Mode,Interior,Kunst}','{calm,leise,quiet,zurückhaltend}'),
('spannungsvoll','attribute','{Mode,Interior,Kunst}','{dramatic,dramatisch,laut,expressiv}'),
('handgefertigt','attribute','{Mode,Interior,Kunst}','{handmade,handcrafted,handwerk,craft}'),
('limitiert','attribute','{Mode,Interior,Kunst}','{limited,limited edition,unikat,one of a kind,ooak}'),
('upcycled','attribute','{Mode,Interior}','{recycled,repurposed,zero waste}'),
('nachhaltig','attribute','{Mode,Interior,Kunst}','{sustainable,eco,bio,organic}'),
('vintage','attribute','{Mode,Interior}','{secondhand,retro}'),
('archivisch','attribute','{Mode,Kunst}','{archival,archive}'),
('editorial','attribute','{Mode,Kunst}','{editorial}'),
('utilitaristisch','attribute','{Mode,Interior}','{utility,workwear,funktional,functional}'),
('sinnlich','attribute','{Mode,Kunst}','{sensual,tactile,haptic,taktil}'),
('grafisch','attribute','{Mode,Interior,Kunst}','{graphic,geometrisch,geometric}'),
('poetisch','style','{Mode,Kunst}','{poetic}'),
('gotisch','style','{Mode,Kunst}','{gothic}'),
('avantgarde','style','{Mode,Kunst}','{avant-garde,experimentell,experimental}'),
('couture','style','{Mode}','{haute couture}'),
('street','style','{Mode}','{streetwear,urban}'),
('archivmode','style','{Mode}','{archive fashion}'),
('mid-century','style','{Interior}','{mid century,mcm,mitte des jahrhunderts}'),
('bauhaus','style','{Interior,Kunst}','{bauhaus}'),
('japandi','style','{Interior}','{wabi sabi,wabi-sabi}'),
('konzeptuell','style','{Kunst,Mode}','{conceptual}'),
('abstrakt','style','{Kunst}','{abstract}'),
('figürlich','style','{Kunst}','{figurative}'),
('monochrom','attribute','{Mode,Interior,Kunst}','{monochrome,ton in ton}'),
('kontrastreich','attribute','{Mode,Interior,Kunst}','{high contrast,kontrast}'),
('fließend-schwer','attribute','{Mode}','{heavy drape}')
ON CONFLICT (term) DO NOTHING;

-- ------------- 2. TREND SNAPSHOTS + MOMENTUM -------------
CREATE TABLE IF NOT EXISTS public.trend_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL DEFAULT CURRENT_DATE,
  term text NOT NULL,
  world text NOT NULL,
  views int NOT NULL DEFAULT 0,
  likes int NOT NULL DEFAULT 0,
  saves int NOT NULL DEFAULT 0,
  purchases int NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day, term, world)
);

GRANT SELECT ON public.trend_snapshots TO authenticated;
GRANT ALL ON public.trend_snapshots TO service_role;
ALTER TABLE public.trend_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trends_admin_read" ON public.trend_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'designer'));

CREATE INDEX IF NOT EXISTS idx_trend_day ON public.trend_snapshots(day DESC);
CREATE INDEX IF NOT EXISTS idx_trend_term_world ON public.trend_snapshots(term, world, day DESC);

-- Momentum function: 7-day EMA + linear forecast
CREATE OR REPLACE FUNCTION public.trend_momentum(_world text)
RETURNS TABLE(
  term text,
  world text,
  latest_score numeric,
  ema7 numeric,
  slope numeric,
  momentum text,
  forecast14 numeric,
  history numeric[]
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH last14 AS (
    SELECT ts.term, ts.world, ts.day, ts.score
    FROM public.trend_snapshots ts
    WHERE ts.world = _world
      AND ts.day >= CURRENT_DATE - INTERVAL '14 days'
  ),
  agg AS (
    SELECT
      l.term,
      l.world,
      array_agg(l.score ORDER BY l.day) AS scores,
      max(l.day) AS last_day,
      avg(l.score) FILTER (WHERE l.day >= CURRENT_DATE - INTERVAL '7 days') AS ema7_val,
      avg(l.score) FILTER (WHERE l.day >= CURRENT_DATE - INTERVAL '14 days'
                             AND l.day <  CURRENT_DATE - INTERVAL '7 days') AS prev7_val
    FROM last14 l
    GROUP BY l.term, l.world
  )
  SELECT
    a.term,
    a.world,
    COALESCE(a.scores[array_length(a.scores,1)], 0)::numeric AS latest_score,
    COALESCE(a.ema7_val, 0)::numeric AS ema7,
    COALESCE(a.ema7_val,0) - COALESCE(a.prev7_val,0) AS slope,
    CASE
      WHEN COALESCE(a.ema7_val,0) - COALESCE(a.prev7_val,0) > GREATEST(0.5, COALESCE(a.prev7_val,0)*0.1) THEN 'steigend'
      WHEN COALESCE(a.prev7_val,0) - COALESCE(a.ema7_val,0) > GREATEST(0.5, COALESCE(a.prev7_val,0)*0.1) THEN 'fallend'
      ELSE 'stabil'
    END AS momentum,
    GREATEST(0, COALESCE(a.ema7_val,0) + (COALESCE(a.ema7_val,0) - COALESCE(a.prev7_val,0)) * 2)::numeric AS forecast14,
    a.scores AS history
  FROM agg a
  ORDER BY COALESCE(a.ema7_val,0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trend_momentum(text) TO authenticated;

-- ------------- 3. USER MEMORY -------------
CREATE TABLE IF NOT EXISTS public.user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.user_memory TO authenticated;
GRANT ALL ON public.user_memory TO service_role;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_owner_read" ON public.user_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "memory_owner_update" ON public.user_memory FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_owner_delete" ON public.user_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_memory_updated BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
