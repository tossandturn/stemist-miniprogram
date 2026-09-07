function sourceMatches(task,book){return book==='public'?task.sourceKind==='public-topic'||task.source==='Public topics':!book||task.book===Number(book)}
function sourceLabel(task){return task.sourceKind==='public-topic'||task.source==='Public topics'?'公开话题':task.book?'Cambridge '+task.book:task.source||'IELTS 练习'}
module.exports={sourceMatches,sourceLabel}
