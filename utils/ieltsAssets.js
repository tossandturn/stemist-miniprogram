const {assetUrl,createProtectedAssetLoader}=require('./protectedAsset')

const remote=image=>{try{return assetUrl(String(image?.protectedUrl||image?.url||''),'ielts')}catch{return''}}
function pendingIeltsImages(images){return(Array.isArray(images)?images:[]).slice(0,20).map(image=>({...image,protectedUrl:remote(image),url:''})).filter(image=>image.protectedUrl)}
async function hydrateIeltsImages(images,loader){return Promise.all(pendingIeltsImages(images).map(async image=>({...image,url:await loader.load(image.protectedUrl)})))}
function persistableIeltsImages(images){return(Array.isArray(images)?images:[]).slice(0,20).map(image=>{const value={...image,url:remote(image)};delete value.protectedUrl;delete value.loaded;delete value.failed;return value})}
function createIeltsAssetLoader(options={}){return createProtectedAssetLoader({...options,authority:'ielts'})}

module.exports={createIeltsAssetLoader,pendingIeltsImages,hydrateIeltsImages,persistableIeltsImages}
