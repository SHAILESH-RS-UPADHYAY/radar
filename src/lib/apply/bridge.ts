// ============================
// RADAR FILL — the autofill bridge (a bookmarklet)
// ============================
// INFILTRATE copies a "fill packet" (your answers for that exact form, plus the tailored PDF when there is one) to the
// clipboard. On the employer's page, the RADAR FILL bookmark reads it, fills text fields, dropdowns, radios and
// checkboxes by their form names, attaches the PDF to the resume input, and scrolls to Submit and marks it.
// It never presses Submit: you review and send the application yourself.

import type { FilledField } from './answers';

export interface FillPacket {
  radar: 1;
  job: string;
  /** label and type let the extension find a field by its label when the name is unknown, and pick from comboboxes. */
  fields: { name: string; label: string; type: string; value: string | string[]; submit?: string }[];
  resume?: { name: string; data: string };
  /** Every question RADAR read on this form, answered or not: the extension asks RADAR only about the others. */
  asked?: string[];
  /** More answers follow (the AI is still drafting): the extension keeps the tab ready for them. */
  partial?: boolean;
}

/** The packet for one form: only fields that have an answer; select values carry what the form submits. */
export function fillPacket(
  job: string,
  fields: FilledField[],
  resume?: FillPacket['resume'],
  extra: Pick<FillPacket, 'asked' | 'partial'> = {},
): FillPacket {
  return {
    radar: 1,
    job,
    ...extra,
    fields: fields
      .filter((f) => f.type !== 'file' && (Array.isArray(f.value) ? f.value.length : f.value))
      .map((f) => {
        const i = f.type === 'select' && typeof f.value === 'string' ? (f.options || []).indexOf(f.value) : -1;
        return {
          name: f.name,
          label: f.label,
          type: f.type,
          value: f.value,
          ...(i >= 0 && f.values?.[i] ? { submit: f.values[i] } : {}),
        };
      }),
    ...(resume ? { resume } : {}),
  };
}

// Runs on the employer's page. Plain ES2019, no imports: it is pasted into a javascript: URL.
const SOURCE = `(async()=>{
const say=(t,ok)=>{let b=document.getElementById('radar-fill');if(!b){b=document.createElement('div');b.id='radar-fill';document.body.appendChild(b)}
b.textContent=t;b.style.cssText='position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);padding:10px 16px;font:600 12px/1.4 monospace;letter-spacing:.08em;background:#000;border:1px solid '+(ok?'#00FF41':'#FF5555')+';color:'+(ok?'#00FF41':'#FF5555')+';box-shadow:0 0 24px rgba(0,255,65,.35)';setTimeout(()=>b.remove(),9000)};
let p;try{p=JSON.parse(await navigator.clipboard.readText())}catch(e){return say('RADAR FILL: copy the fill packet in INFILTRATE first, then allow clipboard access.',false)}
if(!p||p.radar!==1)return say('RADAR FILL: the clipboard does not hold a RADAR fill packet.',false);
const set=(el,v)=>{const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
const txt=e=>((e.closest('label')||{}).textContent||e.value||'').trim();
let n=0;
for(const f of p.fields){const q='[name="'+CSS.escape(f.name)+'"],[id="'+CSS.escape(f.name)+'"]';const els=[...document.querySelectorAll(q)];if(!els.length)continue;const el=els[0];const want=[].concat(f.value);
if(el.type==='file')continue;
if(el.type==='radio'||el.type==='checkbox'){for(const e of els){if(want.some(w=>w===e.value||w===txt(e))&&!e.checked){e.click();n++}}continue}
if(el.tagName==='SELECT'){const o=[...el.options].find(o=>o.value===f.submit||o.textContent.trim()===want[0]||o.value===want[0]);if(o){set(el,o.value);n++}continue}
set(el,want.join(', '));n++}
if(p.resume){const fi=document.querySelector('input[type=file][name="resume"],input[type=file][id="resume"],input[type=file][name*="resume" i],input[type=file][id*="resume" i]')||document.querySelector('input[type=file]');
if(fi){const bin=atob(p.resume.data),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const dt=new DataTransfer();dt.items.add(new File([u],p.resume.name,{type:'application/pdf'}));fi.files=dt.files;fi.dispatchEvent(new Event('change',{bubbles:true}));n++}}
const s=[...document.querySelectorAll('button[type=submit],input[type=submit],button')].find(b=>/submit|apply|send/i.test(b.textContent||b.value||''));
if(s){s.scrollIntoView({behavior:'smooth',block:'center'});s.style.outline='3px solid #00FF41';s.style.boxShadow='0 0 28px #00FF41'}
say('RADAR FILL: '+n+' fields filled for '+p.job+'. Check them, then press Submit yourself.',true)})();`;

/** The bookmark to drag to the bookmarks bar. */
export const BRIDGE_HREF = 'javascript:' + encodeURIComponent(SOURCE.replace(/\n/g, ''));
