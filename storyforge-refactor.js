/* StoryForge V4.6 — image architecture + case overlay editor patch */
(() => {
  'use strict';

  const PATCH_VERSION = '4.6-image-editor-2';
  const P01_IMAGE = './assets/bd/p01/c01.jpg';

  function canonicalCase(pid, cid) {
    return (SEED_OFFICIEL.planches.find(p => p.id === pid)?.cases || []).find(c => c.id === cid);
  }

  function normalizeImageEditorModel() {
    for (const p0 of SEED_OFFICIEL.planches || []) {
      for (const c0 of p0.cases || []) {
        c0.overlays = Array.isArray(c0.overlays) ? c0.overlays : [];
        if (c0.id === 'P01-1') c0.image = P01_IMAGE;
        else if (!Object.prototype.hasOwnProperty.call(c0, 'image')) c0.image = null;
        (c0.textes || []).forEach((t, ti) => {
          t.id ||= `${c0.id}-T${String(ti + 1).padStart(2, '0')}`;
          t.preserve_exact = !!t.preserve_exact;
        });
      }
    }
    for (const p of SEED.planches || []) {
      for (const c of p.cases || []) {
        const c0 = canonicalCase(p.id, c.id);
        if (c.id === 'P01-1' && c.image === './assets/bd/p01/c01.png') c.image = P01_IMAGE;
        if (!Object.prototype.hasOwnProperty.call(c, 'image')) c.image = c0?.image ?? null;
        c.overlays = Array.isArray(c.overlays) ? c.overlays : [];
        (c.textes || []).forEach((t, ti) => {
          const canonicalId = c0?.textes?.[ti]?.id;
          if (canonicalId && (!t.id || /^texte-/.test(t.id))) t.id = canonicalId;
          t.id ||= `${c.id}-T${String(ti + 1).padStart(2, '0')}`;
          t.preserve_exact = !!t.preserve_exact;
        });
        c.overlays.forEach((o, oi) => {
          o.id ||= `${c.id}-OV${String(oi + 1).padStart(2, '0')}`;
          o.type ||= 'text';
          o.x = clamp(Number(o.x ?? .1), 0, 1);
          o.y = clamp(Number(o.y ?? .1), 0, 1);
          o.width = clamp(Number(o.width ?? .32), .08, 1);
          o.height = clamp(Number(o.height ?? .18), .06, 1);
          o.font_size = clamp(Number(o.font_size ?? .045), .02, .12);
          o.align ||= 'center';
        });
      }
    }
    persist();
  }

  // Correction 1: case images are stored exactly as selected, without resize/recompression.
  compressImage = async file => file;

  async function resolveImageRefPatch(ref) {
    if (!ref) return null;
    if (!String(ref).startsWith('idb://')) return ref;
    return mediaUrl(String(ref).slice(6));
  }
  window.resolveImageRef = resolveImageRefPatch;

  async function replaceCaseImagePatch(cid, file) {
    const entry = caseEntry(cid); if (!entry || !file) return;
    const mid = uid('image');
    await dbPut({id:mid, ownerType:'case', ownerId:cid, blob:file, mime:file.type || 'application/octet-stream', name:file.name || 'image', createdAt:new Date().toISOString()});
    entry.c.image = `idb://${mid}`;
    persist(); refresh(); toast('Image originale enregistrée dans IndexedDB');
  }
  window.replaceCaseImage = replaceCaseImagePatch;

  window.removeCaseImage = function(pid, cid) {
    const c = caseById(pid, cid); if (!c || !c.image) return;
    if (!confirm('Supprimer l’image courante de cette case ? Le fichier source ne sera pas effacé.')) return;
    c.image = null; persist(); renderPlanche(pid); toast('Image déréférencée');
  };

  async function migrateLegacyCaseMediaPatch() {
    let changed = false;
    for (const p of SEED.planches || []) for (const c of p.cases || []) {
      const key = ownerKey('case', c.id), list = MEDIA_META[key] || [], active = list.find(x => x.active) || list[0];
      const canonicalImage = canonicalCase(p.id, c.id)?.image ?? null;
      if (active && !active.builtin && (!c.image || c.image === canonicalImage)) { c.image = `idb://${active.id}`; changed = true; }
      if (Object.prototype.hasOwnProperty.call(MEDIA_META, key)) { delete MEDIA_META[key]; changed = true; }
    }
    if (changed) { persist(); saveMediaMeta(); toast('Images de cases migrées vers le nouveau modèle'); }
  }
  window.migrateLegacyCaseMedia = migrateLegacyCaseMediaPatch;

  function overlayTextPatch(c, o) {
    if (o.text_ref) return (c.textes || []).find(t => t.id === o.text_ref)?.contenu || '[Texte canonique introuvable]';
    return o.content || '';
  }
  window.overlayText = overlayTextPatch;

  window.overlayHTML = function(p, c, o) {
    const text = overlayTextPatch(c,o), height = o.type === 'speech' ? `height:${o.height*100}%;` : '';
    return `<div class="overlay ${esc(o.type)}" data-overlay-id="${attr(o.id)}" style="left:${o.x*100}%;top:${o.y*100}%;width:${o.width*100}%;${height}font-size:clamp(10px,${o.font_size*100}cqw,36px);text-align:${esc(o.align)}" onpointerdown="startOverlayDrag(event,'${p.id}','${c.id}','${o.id}','move')">${esc(text)}${o.type==='speech'?`<span class="resize-handle" onpointerdown="startOverlayDrag(event,'${p.id}','${c.id}','${o.id}','resize')"></span>`:''}</div>`;
  };

  window.renderStoryboard = function(p, el) {
    el.innerHTML = `<div class="grid2">${(p.cases||[]).map(c => {
      const choice=choiceFor(p,c), hasImage=!!c.image;
      return `<article class="case"><div class="art" data-case-art="${c.id}"><div class="case-canvas" data-case-canvas="${c.id}">${(c.overlays||[]).map(o=>overlayHTML(p,c,o)).join('')}</div>${hasImage?'':`<span class="ghost">${esc(c.numero)}</span>`}<span class="num">${esc(c.numero)}</span><button class="addimg" onclick="pickCaseImage('${c.id}')">${hasImage?'Remplacer':'Ajouter une image'}</button></div>${(c.textes||[]).length?`<div class="bubbles">${c.textes.map(bubbleHTML).join('')}</div>`:''}${choice?.bloque_generation_du_texte?`<div class="sensitive"><b>⚠ Texte verrouillé par choix éditorial</b><br>${esc(choice.regle)}</div>`:''}<div class="desc">${c.description?esc(c.description):'<i>Description volontairement absente.</i>'}</div><div class="foot">${(c.personnages||[]).map(x=>`<span class="pchip">${esc(x)}</span>`).join('')}${caseBadge(c,p.id)}</div><details class="caseedit"><summary>Modifier la case ▾</summary>${caseEditor(p,c)}</details></article>`;
    }).join('')}<button class="addcase" onclick="addCase('${p.id}')">+ Ajouter une case</button></div>`;
    hydrateCaseArt(p);
  };

  window.caseEditor = function(p,c) {
    return `<label class="field"><span>Titre</span><input value="${attr(c.titre||'')}" oninput="setCaseField('${p.id}','${c.id}','titre',this.value)"></label><label class="field"><span>Description / mise en image</span><textarea oninput="setCaseField('${p.id}','${c.id}','description',this.value)">${esc(c.description||'')}</textarea></label><label class="field"><span>Note</span><textarea oninput="setCaseField('${p.id}','${c.id}','notes',this.value)">${esc(c.notes||'')}</textarea></label><h5>Personnages et gardiens</h5><div class="toolbar">${[...(SEED.personnages||[]),...(SEED.gardiens||[])].map(x=>`<label class="switch"><input type="checkbox" ${c.personnages.includes(x.id)?'checked':''} onchange="toggleCasePerson('${p.id}','${c.id}','${x.id}',this.checked)"> ${esc(x.nom||x.id)}</label>`).join('')}</div><div class="case-guardian">${GUARDIANS.map(([gid,label])=>`<label>${label}<select onchange="setCaseGuardian('${p.id}','${c.id}','${gid}',this.value)">${guardianOverrideOptions(c,gid)}</select></label>`).join('')}</div><h5>Textes</h5><div>${(c.textes||[]).map((t,i)=>textEditor(p,c,t,i)).join('')}</div><button class="smallbtn" style="width:100%" onclick="addText('${p.id}','${c.id}')">+ Ajouter un bloc de texte</button><h5>Image courante</h5><div class="toolbar"><button onclick="pickCaseImage('${c.id}')">${c.image?'Remplacer l’image':'Ajouter une image'}</button>${c.image?`<button onclick="removeCaseImage('${p.id}','${c.id}')">Supprimer l’image</button>`:''}<button class="primary" onclick="openPrompt('${p.id}','${c.id}')">Assembler le prompt IA</button></div><h5>Éditeur visuel</h5><div class="muted">Les dialogues liés utilisent le texte exact du manuscrit. Un contenu libre n’est permis que sans référence canonique.</div><div class="toolbar"><button onclick="addOverlay('${p.id}','${c.id}','text')">+ Texte</button><button onclick="addOverlay('${p.id}','${c.id}','speech')">+ Bulle de dialogue</button></div><div>${(c.overlays||[]).map(o=>overlayEditor(p,c,o)).join('')}</div>${c.source_verbatim?`<details><summary class="muted">Voir la source verbatim</summary><p class="muted">${esc(c.source_verbatim)}</p></details>`:''}`;
  };

  window.overlayEditor = function(p,c,o) {
    const refs=(c.textes||[]).map(t=>`<option value="${attr(t.id)}" ${o.text_ref===t.id?'selected':''}>${esc(t.id)} · ${esc(t.contenu).slice(0,70)}</option>`).join('');
    return `<div class="overlayrow"><div class="overlaygrid"><label>Type<select onchange="setOverlayField('${p.id}','${c.id}','${o.id}','type',this.value,true)"><option value="text" ${o.type==='text'?'selected':''}>Texte</option><option value="speech" ${o.type==='speech'?'selected':''}>Bulle de dialogue</option></select></label><label>Source<select onchange="setOverlayTextRef('${p.id}','${c.id}','${o.id}',this.value)"><option value="">Texte libre</option>${refs}</select></label>${o.text_ref?`<label class="wide">Contenu canonique<textarea readonly>${esc(overlayTextPatch(c,o))}</textarea></label>`:`<label class="wide">Contenu libre<textarea oninput="setOverlayField('${p.id}','${c.id}','${o.id}','content',this.value)">${esc(o.content||'')}</textarea></label>`}<label>Largeur<input type="range" min="0.08" max="0.9" step="0.01" value="${o.width}" onchange="setOverlayField('${p.id}','${c.id}','${o.id}','width',Number(this.value),true)"></label>${o.type==='speech'?`<label>Hauteur<input type="range" min="0.06" max="0.7" step="0.01" value="${o.height}" onchange="setOverlayField('${p.id}','${c.id}','${o.id}','height',Number(this.value),true)"></label>`:''}<label>Taille<input type="range" min="0.02" max="0.12" step="0.005" value="${o.font_size}" onchange="setOverlayField('${p.id}','${c.id}','${o.id}','font_size',Number(this.value),true)"></label><label>Alignement<select onchange="setOverlayField('${p.id}','${c.id}','${o.id}','align',this.value,true)"><option value="left" ${o.align==='left'?'selected':''}>Gauche</option><option value="center" ${o.align==='center'?'selected':''}>Centre</option><option value="right" ${o.align==='right'?'selected':''}>Droite</option></select></label></div><div class="toolbar"><button onclick="removeOverlay('${p.id}','${c.id}','${o.id}')">Supprimer</button></div></div>`;
  };

  // Correction 2: preserve_exact is a real UI lock.
  window.textEditor = function(p,c,t,i) {
    const people=[...(SEED.personnages||[]),...(SEED.gardiens||[])], locked=!!t.preserve_exact;
    return `<div class="textrow ${locked?'locked':''}"><div class="textgrid"><select ${locked?'disabled':''} onchange="setTextField('${p.id}','${c.id}','${t.id}','type',this.value)">${TEXT_TYPES.map(x=>`<option value="${x[0]}" ${t.type===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select><select ${locked?'disabled':''} onchange="setTextField('${p.id}','${c.id}','${t.id}','personnage_id',this.value||null)"><option value="">Sans personnage</option>${people.map(x=>`<option value="${x.id}" ${t.personnage_id===x.id?'selected':''}>${esc(x.nom||x.id)}</option>`).join('')}</select><textarea ${locked?'readonly':''} oninput="setTextField('${p.id}','${c.id}','${t.id}','contenu',this.value)">${esc(t.contenu||'')}</textarea></div><div class="textactions">${locked?'<span class="lockmark">🔒 preserve_exact — verrouillé</span>':`<label class="switch"><input type="checkbox" onchange="setTextField('${p.id}','${c.id}','${t.id}','preserve_exact',this.checked,true)"> 🔒 preserve_exact</label><button class="smallbtn" onclick="moveText('${p.id}','${c.id}',${i},-1)">↑</button><button class="smallbtn" onclick="moveText('${p.id}','${c.id}',${i},1)">↓</button><button class="smallbtn" onclick="removeText('${p.id}','${c.id}','${t.id}')">×</button>`}</div></div>`;
  };

  window.addOverlay = function(pid,cid,type) {
    const c=caseById(pid,cid),used=new Set((c.overlays||[]).map(o=>o.text_ref).filter(Boolean)),available=(c.textes||[]).find(t=>!used.has(t.id));
    c.overlays||=[]; c.overlays.push({id:uid('ov'),type,text_ref:available?.id||null,...(available?{}:{content:''}),x:.12,y:.12,width:type==='speech'?.38:.32,height:.2,font_size:.045,align:'center'}); persist();renderPlanche(pid);
  };
  window.setOverlayField = function(pid,cid,oid,k,v,rerender=false){const o=(caseById(pid,cid).overlays||[]).find(x=>x.id===oid);if(!o)return;o[k]=v;persist();if(rerender)renderPlanche(pid);};
  window.setOverlayTextRef = function(pid,cid,oid,ref){const o=(caseById(pid,cid).overlays||[]).find(x=>x.id===oid);if(!o)return;if(ref){o.text_ref=ref;delete o.content;}else{delete o.text_ref;o.content='';}persist();renderPlanche(pid);};
  window.removeOverlay = function(pid,cid,oid){if(!confirm('Supprimer cet élément visuel ?'))return;const c=caseById(pid,cid);c.overlays=(c.overlays||[]).filter(x=>x.id!==oid);persist();renderPlanche(pid);};
  window.startOverlayDrag = function(ev,pid,cid,oid,mode){ev.preventDefault();ev.stopPropagation();const c=caseById(pid,cid),o=(c?.overlays||[]).find(x=>x.id===oid),node=ev.target.closest('.overlay'),canvas=node?.parentElement;if(!o||!node||!canvas)return;const rect=canvas.getBoundingClientRect(),sx=ev.clientX,sy=ev.clientY,start={x:o.x,y:o.y,width:o.width,height:o.height};const move=e=>{const dx=(e.clientX-sx)/rect.width,dy=(e.clientY-sy)/rect.height;if(mode==='resize'){o.width=clamp(start.width+dx,.08,1-o.x);o.height=clamp(start.height+dy,.06,1-o.y);node.style.width=o.width*100+'%';node.style.height=o.height*100+'%';}else{o.x=clamp(start.x+dx,0,1-o.width);o.y=clamp(start.y+dy,0,1-(o.type==='speech'?o.height:.06));node.style.left=o.x*100+'%';node.style.top=o.y*100+'%';}};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);persist();};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});};

  window.hydrateCaseArt = async function(p){for(const c of p.cases||[]){const node=document.querySelector(`[data-case-canvas="${c.id}"]`);if(!c.image||!node)continue;try{const u=await resolveImageRefPatch(c.image);if(!u)throw 0;const img=document.createElement('img');img.src=u;img.alt=`Case ${c.numero}`;img.onerror=()=>toast('Image inaccessible — utilise Preview dans Acode');img.onclick=()=>pickCaseImage(c.id);node.prepend(img);}catch(e){toast('Image inaccessible — utilise Preview dans Acode');}}};
  window.hydratePageThumbs = async function(pages){for(const p of pages){const c=(p.cases||[]).find(x=>x.image);if(!c)continue;const u=await resolveImageRefPatch(c.image),node=document.querySelector(`[data-thumb="${p.id}"]`);if(node&&u)node.innerHTML=`<img src="${u}" alt="">`;}};
  window.pickCaseImage = function(cid){mediaTarget=cid;document.getElementById('pickImg').click();};
  window.renderPageFiles = function(p,el){el.innerHTML=(p.cases||[]).map(c=>`<div class="fileline">🖼 Case ${esc(c.numero)}<span class="st">${c.image?esc(c.image):'aucune image'}</span><button onclick="pickCaseImage('${c.id}')">${c.image?'Remplacer':'Ajouter'}</button></div>`).join('')+`<div class="fileline">⎙ Imprimer la planche<span class="st">texte + images</span><button onclick="printStoryboard('${p.id}')">OK</button></div>`;};

  // Correction 3: reset really preserves each case's current image reference.
  window.resetWorkingSeed = function(){
    if(!confirm('Annuler toutes les modifications de texte, structure, statuts et notes ? Les images courantes seront conservées.'))return;
    const images=new Map();for(const p of SEED.planches||[])for(const c of p.cases||[])if(c.image)images.set(c.id,c.image);
    SEED=clone(SEED_OFFICIEL);normalizeImageEditorModel();for(const p of SEED.planches||[])for(const c of p.cases||[])if(images.has(c.id))c.image=images.get(c.id);
    META={statuts:{},notes:{},filters:{q:'',chapitre:'',personnage:'',gardien:'',statut:''}};persist();refresh();toast('Seed canonique restauré · images conservées');
  };

  function installStyles(){const s=document.createElement('style');s.textContent=`.case-canvas{position:absolute;inset:0;overflow:hidden;container-type:inline-size;touch-action:none}.case-canvas>img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:0}.overlay{position:absolute;z-index:1;min-height:28px;padding:6px 8px;color:#17120e;line-height:1.2;cursor:move;user-select:none;touch-action:none;overflow:hidden}.overlay.text{background:#f5ead7e8;border:1px solid #6f604d;border-radius:5px}.overlay.speech{background:#fff;border:2px solid #241c14;border-radius:48%/38%}.overlay.speech::after{content:"";position:absolute;left:18%;bottom:-10px;width:16px;height:16px;background:#fff;border-right:2px solid #241c14;border-bottom:2px solid #241c14;transform:skew(-22deg)}.overlay .resize-handle{position:absolute;right:2px;bottom:2px;width:14px;height:14px;border-radius:50%;background:var(--orange);border:2px solid #241c14;cursor:nwse-resize}.overlayrow{background:#fffaf1;border:1px solid #ddd0ba;border-radius:10px;padding:9px;margin:8px 0}.overlaygrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.overlaygrid label{font-size:10px;font-weight:800;color:#756651}.overlaygrid .wide{grid-column:1/-1}.overlayrow input,.overlayrow select,.overlayrow textarea{width:100%;min-height:40px;border:1px solid #cdbfa7;border-radius:8px;background:#fffaf1;color:#241c14;padding:7px}.overlayrow textarea{min-height:64px}.textrow textarea[readonly]{background:#efe7da;color:#5d5142}.case .art{position:relative}`;document.head.appendChild(s);}

  function replaceImagePickerListener(){const old=document.getElementById('pickImg');if(!old)return;const fresh=old.cloneNode(true);old.replaceWith(fresh);fresh.addEventListener('change',async e=>{const file=e.target.files[0];if(file&&mediaTarget){try{await replaceCaseImagePatch(mediaTarget,file);}catch(err){alert('Image non enregistrée. Ouvre StoryForge avec Preview dans Acode puis réessaie.');}}e.target.value='';mediaTarget=null;});}

  async function bootPatch(){
    installStyles(); normalizeImageEditorModel(); replaceImagePickerListener();
    try{await openDB();await migrateLegacyCaseMediaPatch();}catch(e){console.warn('IndexedDB indisponible',e);}
    refresh(); console.info('StoryForge patch actif', PATCH_VERSION);
  }
  bootPatch();
})();