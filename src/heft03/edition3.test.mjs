import test from 'node:test';
import assert from 'node:assert/strict';
import {Magazine,parseRoute,routeHash} from './model.mjs';
import {products,houses,counts} from './data.mjs';
import {searchProducts,searchCount,housePresentation,presentationExport,fromHouseTheme} from './presentation.mjs';
import {extendedView} from './extra-views.mjs';
test('deep-link opening starts with closed cover and finishes at requested chapter',()=>{
 const r=parseRoute('#/haus/drape/2',counts,houses),m=new Magazine(r);
 assert.equal(m.status,'intro');assert.equal(m.pose().open,0);assert.equal(m.pose().fold,0);
 m.tick(.7);assert.equal(m.pose().open,0);
 m.tick(6);assert.equal(m.status,'ready');assert.deepEqual(m.route,r);assert.equal(m.pose().read,1);
 assert.equal(new Magazine(r,true).status,'ready');
});
test('folded stage remains closed during the sheet change',()=>{
 const m=new Magazine({section:'mode',index:0},true);m.go({section:'mode',index:1});m.tick(1.125);
 assert.equal(m.pose().fold,0);assert.equal(m.route.index,1);
});
test('search filters survive round trip and find material and house',()=>{
 const r={section:'suche',index:0,q:'Wolle',world:'mode',house:'drape',max:'500',available:'1',sort:'price-up'};
 assert.deepEqual(parseRoute(routeHash(r),counts,houses),r);
 assert.deepEqual(searchProducts(r).map(p=>p.id),['coat']);
 assert.deepEqual(searchProducts({...r,max:'200'}),[]);
 assert.equal(searchCount({q:'unauffindbar'}),1);
 assert.equal(searchCount({}),3);
});
test('single result uses one page and an intentional end page',()=>{
 const html=extendedView({section:'suche',index:0,q:'Plissé'},{});
 assert.equal((html.match(/class="search-piece"/g)||[]).length,1);
 assert.match(html,/den nächsten Fund/);
});
test('all search pages contain at most two pieces and preserve editorial order',()=>{
 const ids=searchProducts({}).map(p=>p.id),seen=[];
 for(let i=0;i<searchCount({});i++){const html=extendedView({section:'suche',index:i},{});seen.push(...[...html.matchAll(/class="search-piece" data-product="([^"]+)"/g)].map(m=>m[1]));}
 assert.deepEqual(seen,ids);
 assert.deepEqual(searchProducts({available:'1'}).some(p=>p.id==='noir'),false);
 assert.equal(searchProducts({sort:'price-up'})[0].id,'vessel');
});
test('house customization stays scoped and exports existing theme fields',()=>{
 const before=JSON.stringify(products),state={presentations:{drape:{theme:'galerie',title:'My world',accent:'#334455'}}};
 assert.equal(housePresentation('drape',state).accent,'#334455');
 assert.equal(housePresentation('forme',state).theme,'atelier');
 const exported=presentationExport('drape',state);assert.equal(exported.houseTheme.farbwelt.accent,'#334455');
 assert.equal(fromHouseTheme(exported.houseTheme).accent,'#334455');
 assert.deepEqual(exported.display.productIds,houses.drape.products);assert.equal(JSON.stringify(products),before);
});
test('all new chapters render and escape personal input',()=>{
 const state={saved:[],style:'<script>alert(1)</script>',profile:{name:'<img>',email:'test@example.test'},goal:'',measurements:{},consent:false};
 for(const section of ['dna','konto','frag-pawn'])for(let i=0;i<counts[section];i++){
  const html=extendedView({section,index:i},state);assert.ok(html);assert.equal((html.match(/class="paper-page /g)||[]).length,2);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img>'));
 }
});

