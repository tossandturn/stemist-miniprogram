function tracksForPaper(paper,items){
 if(paper?.module!=='listening'||!Array.isArray(items))return[]
 const tracks=items.filter(a=>a.taskId===paper.id&&a.book===paper.book&&a.test===paper.test).sort((a,b)=>a.track-b.track)
 // Never guess between ambiguous track mappings or use practice Test numbering.
 if(new Set(tracks.map(a=>a.track)).size!==tracks.length||tracks.some(a=>a.trackCount!==tracks[0].trackCount))return[]
 return tracks
}
module.exports={tracksForPaper}
