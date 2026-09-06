import fs from 'node:fs'
import path from 'node:path'
export function expandedWxml(root,file,seen=new Set()) {
 const absolute=path.resolve(root,file),relative=path.relative(root,absolute)
 if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('WXML include escapes project')
 if(seen.has(absolute))return ''
 seen.add(absolute)
 return fs.readFileSync(absolute,'utf8').replace(/<include\s+src="([^"]+)"\s*\/?>/g,(_match,src)=>expandedWxml(root,path.join(path.dirname(relative),src),seen))
}
