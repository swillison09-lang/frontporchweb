const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const hero=document.querySelector('.opening')||document.querySelector('.hero');
let scheduled=false;
function frame(){scheduled=false;if(reduce.matches)return;const y=hero.getBoundingClientRect().top;hero.style.setProperty('--drift',Math.max(-75,Math.min(75,-y*.1))+'px');}
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(frame)}},{passive:true});
document.querySelectorAll('form').forEach(f=>{const note=document.createElement('p');note.className='demo-form-note';note.textContent='Interactive demo only. No message is sent.';f.append(note);});
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.links.open,.nav-links.open').forEach(n=>n.classList.remove('open'));document.querySelectorAll('.burger').forEach(b=>b.setAttribute('aria-expanded','false'));}));
