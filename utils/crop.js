function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)) }

function computeCropRect({ viewport, box, imageWidth, imageHeight }) {
  const width = Number(imageWidth)
  const height = Number(imageHeight)
  if (!viewport || !box || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('裁剪图片尺寸无效')
  const fitScale = Math.min(Number(viewport.width) / width, Number(viewport.height) / height)
  if (!Number.isFinite(fitScale) || fitScale <= 0) throw new Error('裁剪区域尚未准备好')
  const renderedWidth = width * fitScale
  const renderedHeight = height * fitScale
  const offsetX = Number(viewport.left) + (Number(viewport.width) - renderedWidth) / 2
  const offsetY = Number(viewport.top) + (Number(viewport.height) - renderedHeight) / 2
  const sourceScale = fitScale
  const left = Math.max(offsetX, Number(box.left)), top = Math.max(offsetY, Number(box.top))
  const right = Math.min(offsetX + renderedWidth, Number(box.left) + Number(box.width))
  const bottom = Math.min(offsetY + renderedHeight, Number(box.top) + Number(box.height))
  if (![left,top,right,bottom].every(Number.isFinite) || right <= left || bottom <= top) throw new Error('请把照片移回裁剪框内。')
  const sx = clamp(Math.round((left - offsetX) / sourceScale), 0, width - 1)
  const sy = clamp(Math.round((top - offsetY) / sourceScale), 0, height - 1)
  const sw = clamp(Math.round((right - offsetX) / sourceScale) - sx, 1, width - sx)
  const sh = clamp(Math.round((bottom - offsetY) / sourceScale) - sy, 1, height - sy)
  return { sx, sy, sw, sh, sourceScale }
}

function resizedCropSize(width, height, maximum = 1600) {
  const sourceWidth = Math.max(1, Number(width))
  const sourceHeight = Math.max(1, Number(height))
  const scale = Math.min(1, Number(maximum) / Math.max(sourceWidth, sourceHeight))
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) }
}

function moveCropSelection(box,dx,dy,corner,bounds){
  const minWidth=Math.min(88,bounds.width),minHeight=Math.min(88,bounds.height)
  if(corner==='move')return {...box,left:clamp(box.left+dx,0,bounds.width-box.width),top:clamp(box.top+dy,0,bounds.height-box.height)}
  let left=box.left,top=box.top,right=left+box.width,bottom=top+box.height
  if(corner.includes('w'))left=clamp(left+dx,0,right-minWidth)
  if(corner.includes('e'))right=clamp(right+dx,left+minWidth,bounds.width)
  if(corner.includes('n'))top=clamp(top+dy,0,bottom-minHeight)
  if(corner.includes('s'))bottom=clamp(bottom+dy,top+minHeight,bounds.height)
  return {left,top,width:right-left,height:bottom-top}
}

module.exports = { computeCropRect, resizedCropSize, moveCropSelection }
