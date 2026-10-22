import crypto from 'node:crypto'
export function drawArtFixture(){
 const majors='00-fool 01-magician 02-high-priestess 03-empress 04-emperor 05-hierophant 06-lovers 07-chariot 08-strength 09-hermit 10-wheel-of-fortune 11-justice 12-hanged-man 13-death 14-temperance 15-devil 16-tower 17-star 18-moon 19-sun 20-judgement 21-world'.split(' ')
 const ranks='ace two three four five six seven eight nine ten page knight queen king'.split(' ')
 const ids=[...majors.map(x=>'tarot-major-'+x),...['wands','cups','swords','pentacles'].flatMap(s=>ranks.map(r=>'tarot-'+s+'-'+r)),...Array.from({length:64},(_,i)=>'hexagram-'+String(i+1).padStart(2,'0'))]
 return{schemaVersion:'tavern-draw-art.v1',revision:'fixture-v1',credits:[{kind:'tarot',title:'Synthetic deck',author:'Test',license:'CC BY 4.0',sourceUrl:'https://example.com/cards',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'},{kind:'hexagram',title:'Synthetic hexagrams',author:'Test',license:'Original',sourceUrl:'',licenseUrl:''}],items:ids.map(id=>{const kind=id.startsWith('tarot-')?'tarot':'hexagram',sha256=crypto.createHash('sha256').update(id).digest('hex');return{id,kind,deckVersion:kind==='tarot'?'rws-text-78-v1':'zhouyi-64-v1',src:'/api/ai/tavern/draw-art/v1/'+id+'-'+sha256.slice(0,16)+'.jpg',width:720,height:1080,bytes:12345,sha256,alt:id}})}
}
