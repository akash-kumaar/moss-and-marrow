import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const out=process.env.QA_OUTPUT || 'node_modules/.moss-qa';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
const url=process.env.QA_URL || 'http://localhost:5200';
try {
 for (const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[360,800]]) {
  const page=await browser.newPage({viewport:{width,height}, hasTouch:width<500});
  await page.goto(url);
  await page.locator('.cinema h1').waitFor();
  await page.locator('.cinema-media img').evaluate(img=>img.decode());
  await page.waitForTimeout(1000);
  await page.screenshot({path:out+'/home-'+width+'.png'});
  assert.equal(await page.evaluate(()=>innerWidth),width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===360){
   await page.getByRole('button',{name:'Open navigation'}).click();
   await page.locator('#mobile-navigation').getByRole('link',{name:'Menu',exact:true}).click();
   await page.waitForURL('**/menu');
  }
  await page.close();
  console.log('Homepage '+width+' × '+height);
 }
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 await p.route('**/api/v1/menu',route=>route.fulfill({status:503,body:'{}'}));
 await p.goto(url+'/menu');
 await p.getByRole('searchbox').fill('Double Espresso');
 await p.getByRole('button',{name:'View Double Espresso details'}).click();
 await p.getByRole('button',{name:'Increase quantity',exact:true}).click();
 await p.getByRole('button',{name:/Add to bag/}).click();
 await p.getByRole('button',{name:/View bag, 2 items/}).click();
 const bag=p.getByRole('dialog',{name:'Your bag'});
 await bag.getByText('₹300').waitFor();
 await bag.getByRole('button',{name:'Decrease Double Espresso'}).click();
 await bag.getByText('₹150',{exact:true}).waitFor();
 await p.screenshot({path:out+'/bag.png'});
 await bag.getByRole('button',{name:'Clear bag'}).click();
 await bag.getByText('Your bag is empty.',{exact:false}).waitFor();
 await p.keyboard.press('Escape');
 await bag.waitFor({state:'hidden'});
 console.log('Menu search, dish quantity, bag subtotal, clear and Escape passed');
 for(const route of ['/story','/locations','/locations/indiranagar','/gallery','/reservations','/contact','/private-dining','/checkout']){
   await p.goto(url+route);
   await p.locator('main h1').waitFor();
   await p.locator('main img').evaluateAll(async images=>{const visible=images.filter(img=>img.getBoundingClientRect().top<innerHeight); for(const img of visible) img.loading='eager'; await Promise.race([Promise.allSettled(visible.map(img=>img.decode())),new Promise(resolve=>setTimeout(resolve,2000))]);});
   await p.screenshot({animations:'disabled',path:out+'/'+route.slice(1).replaceAll('/','-')+'.png'});
 }
 await p.goto(url);
 await p.getByRole('button',{name:'Cinematic Journey',exact:true}).click();
 await p.getByLabel('Journey speed').selectOption('swift');
 await p.getByRole('button',{name:'Play cinematic journey'}).click();
 for(const stage of ['Avocado','Feta','Lemon']) await p.locator('.build-copy h3').filter({hasText:stage}).waitFor({timeout:22000});
 await p.getByRole('button',{name:'Play cinematic journey'}).waitFor({timeout:45000});
 assert.equal(await p.locator('.journey-chapter').textContent(),'The final table');
 console.log('Cinematic Journey played ingredient stages and ended at the footer');
 await p.getByRole('button',{name:'Toss the ingredients'}).click();
 await p.locator('.footer-food.tossed').waitFor();
 await p.evaluate(()=>window.scrollTo(0,0));
 await p.waitForFunction(()=>document.querySelector('.journey-chapter').textContent==='A welcome');
 await p.getByRole('button',{name:'Play cinematic journey'}).click();
 await p.mouse.move(100,200);
 await p.mouse.wheel(0,200);
 await p.getByRole('button',{name:'Play cinematic journey'}).waitFor();
 for(const [fraction,stage] of [[.85,'Lemon'],[.32,'Avocado'],[0,'Sourdough']]){
   await p.locator('#assembly').evaluate((el,f)=>window.scrollTo(0,el.offsetTop+(el.offsetHeight-innerHeight)*f),fraction);
   await p.locator('.build-copy h3').filter({hasText:stage}).waitFor();
 }
 console.log('Footer toss, wheel interruption and reverse assembly passed');
} finally {await browser.close()}
