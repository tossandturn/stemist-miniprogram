function imageRequestIntent(value){
 const text=String(value||'').trim()
 if(/(?:不要|别|不用|不需要|先不|暂不).{0,16}(?:画|生成|图片|配图)/i.test(text))return false
 if(/(?:图片|画图|生成图).{0,16}(?:收费|费用|成本|多少钱|要钱|怎么收费)|(?:如何|怎么)(?:生成|画)/i.test(text))return false
 return /(?:画出来|画一下|画一张|画一幅|画个|给我画|帮我画|请画|生成一张|生成一幅|生成图片|生成配图)/i.test(text)
  ||/(?:我想看|给我看|给我看看|展示|看一下).{0,80}(?:图片|插图|图像|画面|场景图|长什么样|样子|肖像)/i.test(text)
}
module.exports={imageRequestIntent}
