// Keep keyboard focus within an open biography, including on long member profiles.
document.getElementById('bio-overlay').addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const items=[...e.currentTarget.querySelectorAll('button,a[href],[tabindex="0"]')].filter(n=>n.getClientRects().length);
 const first=items[0],last=items.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
});
