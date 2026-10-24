const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function md(s){ // tiny markdown: **bold**, "- " bullets, "## " headings
  let h='',inUl=false;
  for(const raw of String(s??'').split('\n')){
    let l=esc(raw).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
    const li=/^\s*[-*•]\s+(.*)/.exec(l);
    if(li){if(!inUl){h+='<ul>';inUl=true}h+='<li>'+li[1]+'</li>';continue}
    if(inUl){h+='</ul>';inUl=false}
    if(/^#{1,4}\s/.test(l))h+='<h3>'+l.replace(/^#+\s/,'')+'</h3>';
    else if(l.trim())h+='<p>'+l+'</p>';
  }
  return h+(inUl?'</ul>':'');
}
const LS={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const logAdd=(src,topic,tag,note)=>{const l=LS.get('xs_log',[]);l.push({t:Date.now(),src,topic:topic||'(chưa đặt)',tag,note});LS.set('xs_log',l.slice(-300))};
const SRC={tuluan:'Tự luận',tracnghiem:'Trắc nghiệm',vandap:'Vấn đáp',bang:'Chấm bài viết tay'};

const blobToDataUrl=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)});
async function callAI(body){
  const imgs=body.images?await Promise.all(body.images.map(blobToDataUrl)):undefined;
  const r=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,images:imgs})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Lỗi máy chủ ('+r.status+')');
  return d.text;
}
async function ai(prompt,{json=false,images}={}){
  const t=await callAI({prompt,json,images});
  if(!json)return t;
  try{return JSON.parse(t)}catch{throw new Error('AI trả về dữ liệu không đọc được, hãy thử lại.')}
}
async function run(btn,out,fn){
  btn.disabled=true;const t=btn.textContent;btn.textContent='Đang xử lí…';out.innerHTML='<p class="muted">AI đang làm việc…</p>';
  try{await fn()}catch(e){out.innerHTML='<p class="err">'+esc(e.message||e.code||e)+'</p>'}
  btn.disabled=false;btn.textContent=t;
}

/* ---------- whiteboard (iPad / mouse / touch) ---------- */
function board(host){
  host.innerHTML=`<canvas class="board" aria-label="Bảng viết tay"></canvas><div class="bar"><button class="b ghost" data-m="pen">Bút</button><button class="b ghost" data-m="er">Tẩy</button><button class="b ghost" data-m="clr">Xoá bảng</button><span class="muted" style="font-size:12px">Viết bằng Apple Pencil, ngón tay hoặc chuột</span></div>`;
  const c=$('canvas',host),x=c.getContext('2d');let mode='pen',down=false,dirty=false;
  const fit=()=>{const r=c.getBoundingClientRect();if(!r.width)return;const img=dirty?x.getImageData(0,0,c.width,c.height):null;c.width=r.width*2;c.height=r.height*2;x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);if(img)x.putImageData(img,0,0);x.lineCap=x.lineJoin='round'};
  requestAnimationFrame(fit);
  const pt=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
  c.onpointerdown=e=>{if(!c.width||c.width<10)fit();down=true;dirty=true;c.setPointerCapture(e.pointerId);const[a,b]=pt(e);x.beginPath();x.moveTo(a,b)};
  c.onpointermove=e=>{if(!down)return;const[a,b]=pt(e);x.strokeStyle=mode=='pen'?'#111':'#fff';x.lineWidth=mode=='pen'?(e.pointerType=='pen'&&e.pressure?2+e.pressure*5:4):28;x.lineTo(a,b);x.stroke()};
  c.onpointerup=c.onpointercancel=()=>down=false;
  host.onclick=e=>{const m=e.target.dataset?.m;if(!m)return;if(m=='clr'){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);dirty=false}else mode=m};
  // a canvas inside a closed <details> has no size until opened; resize on first reveal
  new ResizeObserver(()=>{if(!dirty)fit()}).observe(c);
  return{used:()=>dirty,blob:()=>new Promise(r=>c.toBlob(r,'image/png'))};
}
async function pdfToBlobs(file){
  if(!window.pdfjsLib)throw new Error('Chưa tải được bộ đọc PDF. Hãy chụp ảnh trang bài làm rồi tải ảnh lên.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
  for(let i=1;i<=Math.min(pdf.numPages,4);i++){
    const p=await pdf.getPage(i),v=p.getViewport({scale:1.4}),cv=document.createElement('canvas');cv.width=v.width;cv.height=v.height;
    await p.render({canvasContext:cv.getContext('2d'),viewport:v}).promise;out.push(await new Promise(r=>cv.toBlob(r,'image/jpeg',.85)));
  }
  return out;
}

/* ---------- 4-step frameworks, taken from the course handout ---------- */
const KIND={
 toan:{name:'Giải toán',steps:[
  ['Tìm hiểu nội dung bài toán','Phân biệt cái đã cho, cái phải tìm, cái phải chứng minh; diễn tả đề bằng công thức, kí hiệu, sơ đồ; tách các thành phần của điều kiện.'],
  ['Xây dựng chương trình giải','Phân tích thành các bài toán đơn giản quen thuộc; chọn kiến thức gần gũi nhất với dữ kiện và dự đoán kết quả; dùng phương pháp đặc thù theo dạng toán.'],
  ['Trình bày lời giải','Trình bày lại lời giải sau khi đã điều chỉnh những chỗ cần thiết.'],
  ['Kiểm tra và nghiên cứu lời giải','Kiểm tra kết quả và lập luận; rút ra tri thức phương pháp; tìm cách giải khác; khai thác kết quả; đề xuất bài tương tự, đặc biệt hoá, khái quát hoá.']]},
 khainiem:{name:'Học khái niệm',steps:[
  ['Trải nghiệm','Học sinh tiếp cận các dấu hiệu bản chất của khái niệm qua biểu tượng trực quan hoặc tình huống thực tiễn.'],
  ['Hình thành định nghĩa','Nhận biết dấu hiệu bản chất (phân tích, so sánh, trừu tượng hoá, khái quát hoá); lĩnh hội thuật ngữ, kí hiệu; phát biểu và ghi nhớ định nghĩa.'],
  ['Củng cố','Nhận diện khái niệm trong trường hợp đơn giản; thể hiện khái niệm trong ngữ cảnh khác và trong mối liên hệ với khái niệm khác.'],
  ['Vận dụng vào thực tiễn','Vận dụng trong tình huống gián tiếp, phức hợp và vấn đề thực tiễn.']]},
 dinhli:{name:'Học định lí',steps:[
  ['Trải nghiệm','Tiếp cận giả thiết và kết luận qua tình huống đời sống hoặc nội bộ toán, khơi gợi nhu cầu kiểm chứng.'],
  ['Hình thành định lí','Phân biệt giả thiết – kết luận; dự đoán và phát biểu; nhận biết luận cứ và cách chứng minh; hiểu cấu trúc logic của định lí.'],
  ['Củng cố','Thực hành vận dụng định lí trong trường hợp đơn giản, đặc trưng.'],
  ['Vận dụng','Vận dụng định lí giải quyết vấn đề toán học hoặc gắn với thực tiễn.']]}
};
const kindOpts=Object.entries(KIND).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
const frameworkHtml=k=>'<div class="steps">'+KIND[k].steps.map((s,i)=>`<div class="card"><span class="tag">Bước ${i+1}</span><h3>${s[0]}</h3><p class="muted" style="margin:0;font-size:13px">${s[1]}</p></div>`).join('')+'</div>';

function genProcess(kind,text,full){
  const K=KIND[kind],frame=K.steps.map((s,i)=>`Bước ${i+1} – ${s[0]}: ${s[1]}`).join('\n');
  const extra=full?`Đây là "bản sao quy trình": mỗi bước phải đầy đủ như dạy thật, gồm ví dụ minh hoạ cụ thể (có số liệu), một hoạt động tương tác cho học sinh, và với bước Củng cố/Vận dụng có 2 bài tập nhỏ kèm gợi ý (không đáp số).`:`Mỗi bước có nội dung hướng dẫn cụ thể cho đối tượng này và một hoạt động tương tác.`;
  return ai(`Dựng quy trình "${K.name}" 4 bước theo khung sau cho đối tượng do người dùng đưa:\n${frame}\n\nĐối tượng: """${text}"""\n\n${extra}\nVới loại giải toán: KHÔNG giải ra đáp số; ở bước 3 chỉ nêu cấu trúc lời giải cần trình bày, bước 4 nêu cách kiểm tra, cách giải khác, bài tương tự.\nTrả về JSON: {"tieu_de":string,"buoc":[{"ten":string,"noi_dung":string (markdown ngắn),"vi_du":string,"hoat_dong":string (câu hỏi/nhiệm vụ cho học sinh)}]} đúng 4 phần tử.`,{json:true});
}
function renderProcess(host,d,topic){
  host.innerHTML=`<h3 style="font:600 20px var(--f-display)">${esc(d.tieu_de)}</h3><div>`+
  (d.buoc||[]).map((b,i)=>`<div class="card" data-i="${i}"><span class="tag">Bước ${i+1}</span><h3>${esc(b.ten)}</h3><div class="msg">${md(b.noi_dung)}</div>${b.vi_du?`<div class="msg"><b>Ví dụ minh hoạ</b>${md(b.vi_du)}</div>`:''}<div class="msg"><b>Hoạt động</b>${md(b.hoat_dong)}</div><textarea placeholder="Trả lời của bạn…"></textarea><div class="bar"><button class="b ghost">Nhận xét câu trả lời</button></div><div class="fb msg"></div></div>`).join('')+'</div>';
  host.onclick=async e=>{
    const btn=e.target.closest('button');if(!btn)return;const card=btn.closest('.card'),b=d.buoc[card.dataset.i],ans=$('textarea',card).value.trim(),fb=$('.fb',card);
    if(!ans){fb.innerHTML='<p class="warn">Hãy viết câu trả lời trước.</p>';return}
    await run(btn,fb,async()=>{fb.innerHTML=md(await ai(`Chủ đề: ${topic}\nBước "${b.ten}". Hoạt động: ${b.hoat_dong}\nHọc sinh trả lời: """${ans}"""\nNhận xét ngắn: đúng/sai ở đâu, gợi ý bước tiếp theo bằng câu hỏi. Không nêu đáp số.`))});
  };
}

/* ---------- tabs ---------- */
const TABS=[];const tab=(id,title,build)=>TABS.push({id,title,build});

tab('quytrinh','Quy trình 4 bước',el=>{
  el.innerHTML=`<h2>Quy trình giải toán, học khái niệm, học định lí</h2><p class="lede">Chọn loại nội dung, nhập chủ đề. AI dựng quy trình 4 bước theo khung của khoá học và dẫn bạn đi qua từng bước.</p>
  <div class="row"><div><label for="q-k">Loại</label><select id="q-k">${kindOpts}</select></div><div style="flex:3 1 300px"><label for="q-t">Bài toán / khái niệm / định lí</label><textarea id="q-t" placeholder="VD: Một hộp có 5 bi đỏ, 3 bi xanh. Lấy ngẫu nhiên 2 bi. Tính xác suất được 2 bi cùng màu."></textarea></div></div>
  <div id="q-f"></div><div class="bar"><button class="b" id="q-go">Dựng quy trình</button></div><div class="out" id="q-o"></div>`;
  const f=$('#q-f',el),show=()=>f.innerHTML='<details open><summary>Khung 4 bước</summary>'+frameworkHtml($('#q-k',el).value)+'</details>';show();$('#q-k',el).onchange=show;
  $('#q-go',el).onclick=e=>{const k=$('#q-k',el).value,t=$('#q-t',el).value.trim();if(!t)return;run(e.target,$('#q-o',el),async()=>{renderProcess($('#q-o',el),await genProcess(k,t,false),t)})};
});

tab('bang','AI Tutor chấm bài',el=>{
  el.innerHTML=`<h2>AI Tutor chấm bài</h2><p class="lede">Chấm theo barem từ ảnh chụp, file PDF hoặc bài viết trên bảng (iPad). AI cho điểm từng ý và đưa chiến lược sửa, không chép lời giải.</p>
  <div><label for="b-p">Đề bài</label><textarea id="b-p"></textarea></div>
  <div><label for="b-b">Barem điểm (sửa được)</label><textarea id="b-b">Ý 1 (2đ): Xác định đúng không gian mẫu / biến cố.
Ý 2 (3đ): Chọn đúng công thức và lập luận.
Ý 3 (3đ): Tính toán chính xác.
Ý 4 (2đ): Kết luận và kiểm tra hợp lí.</textarea></div>
  <div><label for="b-f">Ảnh hoặc PDF bài làm</label><input id="b-f" type="file" accept="image/*,application/pdf" multiple></div>
  <div><label>Hoặc viết trên bảng</label><div id="b-board"></div></div>
  <div class="bar"><button class="b" id="b-go">Chấm điểm</button></div><div class="out" id="b-o"></div>`;
  const bd=board($('#b-board',el));
  $('#b-go',el).onclick=e=>run(e.target,$('#b-o',el),async()=>{
    const imgs=[];for(const f of $('#b-f',el).files)f.type=='application/pdf'?imgs.push(...await pdfToBlobs(f)):imgs.push(f);
    if(bd.used())imgs.push(await bd.blob());
    if(!imgs.length)throw new Error('Hãy tải ảnh/PDF hoặc viết lên bảng.');
    const prob=$('#b-p',el).value;
    const d=await ai(`Chấm bài làm của học sinh trong ảnh đính kèm.\nĐề: """${prob}"""\nBarem: """${$('#b-b',el).value}"""\nChấm từng ý theo barem, nghiêm nhưng công bằng. Chỉ đưa chiến lược sửa lỗi, không viết lời giải hoàn chỉnh.\nJSON: {"chu_de":string,"tong_diem":number,"toi_da":number,"cac_y":[{"y":string,"diem":number,"toi_da":number,"nhan_xet":string}],"loi_sai":[{"nhan":string (tên lỗi ngắn),"mo_ta":string}],"chien_luoc":string}`,{json:true,images:imgs});
    (d.loi_sai||[]).forEach(l=>logAdd('bang',d.chu_de||prob.slice(0,40),l.nhan,l.mo_ta));
    $('#b-o',el).innerHTML=`<p><span class="score">${d.tong_diem}/${d.toi_da}</span> điểm</p>`+(d.cac_y||[]).map(y=>`<div class="card msg"><b>${esc(y.y)} — ${y.diem}/${y.toi_da}</b>${md(y.nhan_xet)}</div>`).join('')+`<h3 style="margin-top:12px">Lỗi sai</h3>`+md((d.loi_sai||[]).map(l=>`- **${l.nhan}**: ${l.mo_ta}`).join('\n'))+`<h3>Chiến lược sửa</h3>`+md(d.chien_luoc);
  });
});

tab('giongnoi','Hỏi đáp giọng nói',el=>{
  el.innerHTML=`<h2>Hỏi đáp bằng giọng nói</h2><p class="lede">Nói hoặc gõ câu hỏi về Xác suất Thống kê. Với bài toán có công thức, hãy viết lên bảng rồi gửi kèm.</p>
  <div class="chat" id="v-c" aria-live="polite"></div>
  <textarea id="v-t" style="min-height:56px" placeholder="Nhập câu hỏi hoặc bấm Nói…"></textarea>
  <div class="bar"><button class="b ghost" id="v-mic">Nói</button><label style="margin:0;display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0"><input type="checkbox" id="v-tts" style="width:auto"> AI đọc to câu trả lời</label><button class="b" id="v-go">Gửi</button></div>
  <details><summary>Bảng viết (cho bài toán)</summary><div id="v-board" style="margin-top:8px"></div><label style="margin-top:8px;text-transform:none;letter-spacing:0;display:flex;gap:6px"><input type="checkbox" id="v-att" style="width:auto" checked> Gửi kèm bảng nếu đã viết</label></details><div class="out" id="v-o"></div>`;
  const bd=board($('#v-board',el)),hist=[],chat=$('#v-c',el);
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){$('#v-mic',el).disabled=true;$('#v-o',el).innerHTML='<p class="muted">Micro không khả dụng trong khung xem này, hãy gõ câu hỏi. Mở file xstk-ai.html bằng Chrome để dùng nhận dạng giọng nói.</p>'}
  else $('#v-mic',el).onclick=()=>{const r=new SR();r.lang='vi-VN';r.onresult=e=>{$('#v-t',el).value=e.results[0][0].transcript};r.onerror=()=>{$('#v-o',el).innerHTML='<p class="warn">Không dùng được micro.</p>'};try{r.start()}catch{}};
  const say=(who,txt)=>{const d=document.createElement('div');d.className='m msg '+who;d.innerHTML=who=='u'?esc(txt):md(txt);chat.append(d);chat.scrollTop=1e9};
  $('#v-go',el).onclick=e=>{const q=$('#v-t',el).value.trim();if(!q)return;$('#v-t',el).value='';say('u',q);run(e.target,$('#v-o',el),async()=>{
    const useBoard=$('#v-att',el).checked&&bd.used();hist.push({role:'user',content:q});
    const a=await callAI({messages:hist,voice:true,images:useBoard?[await bd.blob()]:undefined});hist.push({role:'assistant',content:a});say('a',a);$('#v-o',el).innerHTML='';
    if($('#v-tts',el).checked&&window.speechSynthesis){const u=new SpeechSynthesisUtterance(a.replace(/[*#]/g,''));u.lang='vi-VN';speechSynthesis.speak(u)}
  })};
});

tab('tuluan','Bài tập tự luận tương tự',el=>{
  el.innerHTML=`<h2>5 bài tự luận tương tự</h2><p class="lede">Nhập một bài toán. AI sinh ngẫu nhiên 5 bài tương tự và chỉ cho chiến lược giải.</p>
  <textarea id="t-p" placeholder="Dán đề bài gốc…"></textarea><div class="bar"><button class="b" id="t-go">Tạo 5 bài</button></div><div class="out" id="t-o"></div>`;
  $('#t-go',el).onclick=e=>{const p=$('#t-p',el).value.trim();if(!p)return;run(e.target,$('#t-o',el),async()=>{
    const d=await ai(`Từ bài gốc: """${p}"""\nSinh 5 bài tự luận tương tự (cùng dạng, thay số liệu/bối cảnh, độ khó tăng dần, có tính ngẫu nhiên). Mỗi bài kèm chiến lược giải dạng gạch đầu dòng (không đáp số).\nJSON: {"bai":[{"de":string,"chien_luoc":string}]}`,{json:true});
    $('#t-o',el).innerHTML=(d.bai||[]).map((b,i)=>`<div class="card msg"><span class="tag">Bài ${i+1}</span>${md(b.de)}<details><summary>Xem chiến lược giải</summary>${md(b.chien_luoc)}</details></div>`).join('');
  })};
});

tab('tracnghiem','Trắc nghiệm',el=>{
  el.innerHTML=`<h2>Trắc nghiệm chấm tức thì</h2><p class="lede">Làm bài, nộp là có điểm. Hỏi AI “tại sao đáp án là…” ở từng câu.</p>
  <div class="row"><div style="flex:3 1 240px"><label for="m-t">Chủ đề hoặc đề gốc</label><input id="m-t" placeholder="VD: Xác suất có điều kiện"></div><div><label for="m-n">Số câu</label><select id="m-n"><option>5</option><option>10</option></select></div></div>
  <div class="bar"><button class="b" id="m-go">Tạo đề</button></div><div id="m-q"></div><div class="out" id="m-o"></div>`;
  let Q=[],topic='';
  $('#m-q',el).onclick=ev=>{const b=ev.target.closest('.fb button');if(!b)return;const card=b.closest('.card'),q=Q[card.dataset.i],inp=$('input',card),ans=$('.ans',card);if(!inp.value.trim())return;
    run(b,ans,async()=>{ans.innerHTML=md(await ai(`Câu trắc nghiệm: ${q.de}\nLựa chọn: ${q.lua_chon.join(' | ')}\nĐáp án đúng: ${'ABCD'[q.dung]}.\nHọc sinh hỏi: """${inp.value}"""\nGiải đáp rõ ràng, nêu chỗ hiểu sai nếu có.`))})};
  $('#m-go',el).onclick=e=>{topic=$('#m-t',el).value.trim();if(!topic)return;run(e.target,$('#m-o',el),async()=>{
    const d=await ai(`Tạo ${$('#m-n',el).value} câu trắc nghiệm 4 lựa chọn về: """${topic}""", độ khó hỗn hợp, đáp án đúng phân bố ngẫu nhiên.\nJSON: {"cau":[{"de":string,"lua_chon":[4 string không kèm A/B/C/D],"dung":number (0-3),"giai_thich":string}]}`,{json:true});
    Q=d.cau||[];$('#m-o',el).innerHTML='';
    $('#m-q',el).innerHTML=Q.map((q,i)=>`<div class="card" data-i="${i}"><div><b>Câu ${i+1}.</b> ${esc(q.de)}</div>${q.lua_chon.map((o,j)=>`<label class="opt"><input type="radio" name="q${i}" value="${j}"><span>${'ABCD'[j]}. ${esc(o)}</span></label>`).join('')}<div class="fb msg"></div></div>`).join('')+'<div class="bar" style="margin-top:12px"><button class="b" id="m-sub">Nộp bài</button></div>';
    $('#m-sub',el).onclick=()=>{
      let sc=0;Q.forEach((q,i)=>{const card=$(`.card[data-i="${i}"]`,el),v=card.querySelector('input:checked');card.querySelectorAll('.opt').forEach((o,j)=>{if(j==q.dung)o.classList.add('right');else if(v&&+v.value==j)o.classList.add('wrong')});
        const ok=v&&+v.value==q.dung;if(ok)sc++;else logAdd('tracnghiem',topic,'Sai trắc nghiệm',q.de.slice(0,90));
        $('.fb',card).innerHTML=`<p class="${ok?'ok':'err'}">${ok?'Đúng':'Sai'}. Đáp án: ${'ABCD'[q.dung]}</p>${md(q.giai_thich)}<div class="bar"><input placeholder="Hỏi thêm: tại sao… ?" style="flex:1 1 200px"><button class="b ghost">Hỏi AI</button></div><div class="ans msg"></div>`});
      $('#m-sub',el).disabled=true;$('#m-o',el).innerHTML=`<p><span class="score">${(sc/Q.length*10).toFixed(1)}/10</span> điểm · đúng ${sc}/${Q.length}</p>`;
    };
  })};
});

tab('vandap','Vấn đáp lí thuyết',el=>{
  el.innerHTML=`<h2>Vấn đáp lí thuyết</h2><p class="lede">Trả lời 5 câu hỏi lí thuyết. AI chấm, chỉ ra lỗ hổng kiến thức và sai lầm thường gặp.</p>
  <div><label for="d-t">Chủ đề</label><input id="d-t" placeholder="VD: Biến ngẫu nhiên và kì vọng"></div>
  <div class="bar"><button class="b" id="d-go">Bắt đầu vấn đáp</button></div><div id="d-q"></div><div class="out" id="d-o"></div>`;
  let Q=[],topic='';
  $('#d-go',el).onclick=e=>{topic=$('#d-t',el).value.trim();if(!topic)return;run(e.target,$('#d-o',el),async()=>{
    const d=await ai(`Ra 5 câu hỏi vấn đáp lí thuyết (khái niệm, định lí, điều kiện áp dụng, phân biệt khái niệm dễ nhầm) về: """${topic}""". JSON: {"cau":[string]}`,{json:true});
    Q=d.cau||[];$('#d-o',el).innerHTML='';
    $('#d-q',el).innerHTML=Q.map((q,i)=>`<div class="card"><div><b>Câu ${i+1}.</b> ${esc(q)}</div><textarea style="min-height:64px"></textarea></div>`).join('')+'<div class="bar" style="margin-top:12px"><button class="b" id="d-sub">Nộp và chấm</button></div>';
    $('#d-sub',el).onclick=ev=>run(ev.target,$('#d-o',el),async()=>{
      const A=[...el.querySelectorAll('#d-q textarea')].map(t=>t.value.trim()||'(bỏ trống)');
      const r=await ai(`Chủ đề: ${topic}\nChấm vấn đáp (thang 10):\n${Q.map((q,i)=>`Câu ${i+1}: ${q}\nTrả lời: ${A[i]}`).join('\n')}\nJSON: {"diem":number,"tung_cau":[{"dung":boolean,"nhan_xet":string}],"lo_hong":[string],"sai_lam":[{"nhan":string,"mo_ta":string}],"khac_phuc":string}`,{json:true});
      (r.sai_lam||[]).forEach(s=>logAdd('vandap',topic,s.nhan,s.mo_ta));
      $('#d-o',el).innerHTML=`<p><span class="score">${r.diem}/10</span></p>`+(r.tung_cau||[]).map((c,i)=>`<div class="card msg"><b class="${c.dung?'ok':'err'}">Câu ${i+1}: ${c.dung?'đạt':'chưa đạt'}</b>${md(c.nhan_xet)}</div>`).join('')+'<h3 style="margin-top:12px">Lỗ hổng kiến thức</h3>'+md((r.lo_hong||[]).map(x=>'- '+x).join('\n'))+'<h3>Sai lầm thường gặp</h3>'+md((r.sai_lam||[]).map(s=>`- **${s.nhan}**: ${s.mo_ta}`).join('\n'))+'<h3>Hướng khắc phục</h3>'+md(r.khac_phuc);
    });
  })};
});

function tally(){const L=LS.get('xs_log',[]),c=f=>{const m={};L.forEach(x=>m[f(x)]=(m[f(x)]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1])};return{L,bySrc:c(x=>SRC[x.src]||x.src),byTag:c(x=>x.tag),byTopic:c(x=>x.topic)}}
const bars=rows=>rows.length?rows.slice(0,8).map(([k,n],_,a)=>`<div class="kv"><span>${esc(k)}</span><div class="meter"><i style="width:${n/a[0][1]*100}%"></i></div><b>${n}</b></div>`).join(''):'<p class="muted">Chưa có dữ liệu.</p>';
const logLines=L=>L.slice(-60).map(x=>`[${SRC[x.src]}] ${x.topic} | ${x.tag} | ${x.note}`).join('\n');

tab('thongke','Thống kê lỗi sai',el=>{
  el.innerHTML=`<h2>Thống kê lỗi sai</h2><p class="lede">Tổng hợp lỗi từ vấn đáp, trắc nghiệm, tự luận viết tay. AI nhận định chung và đề ra hướng khắc phục.</p><div id="s-b" style="display:flex;flex-direction:column;gap:6px"></div>
  <div class="bar"><button class="b" id="s-go">AI nhận định và hướng khắc phục</button><button class="b ghost" id="s-clr">Xoá dữ liệu</button></div><div class="out" id="s-o"></div>`;
  const draw=el.draw=()=>{const t=tally();$('#s-b',el).innerHTML=`<p>Tổng <b>${t.L.length}</b> lỗi đã ghi.</p><h3>Theo hình thức</h3>${bars(t.bySrc)}<h3 style="margin-top:12px">Loại lỗi hay gặp</h3>${bars(t.byTag)}<h3 style="margin-top:12px">Chủ đề</h3>${bars(t.byTopic)}`};draw();
  $('#s-go',el).onclick=e=>{const t=tally();if(!t.L.length){$('#s-o',el).innerHTML='<p class="warn">Chưa có lỗi nào. Hãy làm vài bài trắc nghiệm, vấn đáp hoặc nộp bài viết tay.</p>';return}
    run(e.target,$('#s-o',el),async()=>{$('#s-o',el).innerHTML=md(await ai(`Dữ liệu lỗi sai của học sinh (mới nhất ở cuối):\n${logLines(t.L)}\nViết: 1) nhận định chung về nhóm lỗi; 2) nguyên nhân có thể; 3) hướng khắc phục cụ thể cho từng nhóm (bài tập nên luyện, khái niệm cần ôn).`))})};
  let armed=false;$('#s-clr',el).onclick=e=>{if(!armed){armed=true;e.target.textContent='Bấm lần nữa để xoá hết';return}LS.set('xs_log',[]);armed=false;e.target.textContent='Xoá dữ liệu';draw()};
});

tab('bandotuduy','Bản đồ tư duy',el=>{
  el.innerHTML=`<h2>Bản đồ tư duy</h2><p class="lede">Nhập chủ đề, AI vẽ bản đồ tư duy các nội dung cần học.</p>
  <input id="mm-t" placeholder="VD: Biến ngẫu nhiên rời rạc"><div class="bar"><button class="b" id="mm-go">Vẽ bản đồ</button></div><div class="out" id="mm-o"></div>`;
  $('#mm-go',el).onclick=e=>{const t=$('#mm-t',el).value.trim();if(!t)return;run(e.target,$('#mm-o',el),async()=>{
    const d=await ai(`Tạo bản đồ tư duy về "${t}" cho môn Xác suất Thống kê: nút gốc, 4-6 nhánh chính, mỗi nhánh 2-4 ý con (khái niệm, công thức, tính chất, ví dụ, lỗi hay gặp). Nhãn ≤ 40 ký tự.\nJSON đệ quy: {"t":string,"c":[{"t":string,"c":[...]}]}`,{json:true});
    const W=190,H=34,GX=40,GY=10;let y=0;const nodes=[],links=[];
    (function lay(n,dep){n.dep=dep;if(!n.c?.length){n.y=y;y+=H+GY}else{n.c.forEach(k=>lay(k,dep+1));n.y=(n.c[0].y+n.c.at(-1).y)/2}nodes.push(n);n.c?.forEach(k=>links.push([n,k]))})(d,0);
    const w=(Math.max(...nodes.map(n=>n.dep))+1)*(W+GX)-GX,h=y+10;
    const wrap=s=>{s=String(s);if(s.length<=24)return[s];let i=s.lastIndexOf(' ',24);if(i<8)i=24;return[s.slice(0,i),s.slice(i).trim().slice(0,24)]};
    $('#mm-o',el).innerHTML=`<div class="svgwrap"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Bản đồ tư duy ${esc(t)}">`+
      links.map(([a,b])=>{const x1=a.dep*(W+GX)+W,y1=a.y+H/2+5,x2=b.dep*(W+GX),y2=b.y+H/2+5;return `<path d="M${x1} ${y1}C${x1+GX/2} ${y1} ${x2-GX/2} ${y2} ${x2} ${y2}" fill="none" stroke="#7f9a97" stroke-width="1.4"/>`}).join('')+
      nodes.map(n=>{const L=wrap(n.t),root=!n.dep;return `<g transform="translate(${n.dep*(W+GX)},${n.y+5})"><rect width="${W}" height="${H}" rx="7" fill="${root?'#3f6fe0':'#ffffff'}" stroke="#3f6fe0" stroke-width="1.2"/>${L.map((s,i)=>`<text x="${W/2}" y="${L.length>1?14+i*13:H/2+4}" text-anchor="middle" font-size="${L.length>1?11:12}" font-family="Source Sans 3,sans-serif" fill="${root?'#ffffff':'#1b2a2f'}">${esc(s)}</text>`).join('')}</g>`}).join('')+'</svg></div>';
  })};
});

tab('diendan','Diễn đàn',el=>{
  el.innerHTML=`<h2>Diễn đàn học Xác suất Thống kê</h2><p class="lede">Đặt câu hỏi, trả lời, chia sẻ cách giải. Bài đăng được lưu chung cho mọi người mở trang.</p>
  <div><label for="f-n">Tên hiển thị</label><input id="f-n" maxlength="30"></div><div><label for="f-m">Nội dung</label><textarea id="f-m" maxlength="1500"></textarea></div>
  <div class="bar"><button class="b" id="f-go">Đăng bài</button><span id="f-s" class="muted" style="font-size:13px"></span></div><div id="f-l"></div>`;
  $('#f-n',el).value=LS.get('xs_name','');
  let posts=[];
  const draw=()=>{const roots=posts.filter(p=>!p.parent).sort((a,b)=>b.ts-a.ts);
    $('#f-l',el).innerHTML=roots.length?roots.map(p=>`<div class="card" data-id="${esc(p.id)}"><b>${esc(p.name)} <span class="muted" style="font-weight:400;font-size:12px">${new Date(p.ts).toLocaleString('vi-VN')}</span></b><div class="msg">${md(p.text)}</div>${posts.filter(r=>r.parent==p.id).sort((a,b)=>a.ts-b.ts).map(r=>`<div class="msg" style="border-left:3px solid var(--line);padding-left:10px"><b>${esc(r.name)}</b>${md(r.text)}</div>`).join('')}<div class="bar"><input placeholder="Trả lời…" style="flex:1 1 200px"><button class="b ghost">Gửi</button></div></div>`).join(''):'<p class="muted">Chưa có bài nào. Hãy đăng câu hỏi đầu tiên.</p>'};
  const load=async()=>{try{posts=await (await fetch('/api/forum')).json();draw()}catch{$('#f-s',el).textContent='Không tải được diễn đàn.'}};
  const save=async d=>{d.name=($('#f-n',el).value.trim()||'Ẩn danh').slice(0,30);LS.set('xs_name',d.name);
    try{const r=await fetch('/api/forum',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});if(!r.ok)throw new Error((await r.json()).error);$('#f-s',el).textContent='';await load()}catch(e){$('#f-s',el).textContent='Không đăng được: '+e.message}};
  load();setInterval(()=>{if(!el.hidden)load()},15000); // ponytail: polling; swap for SSE/websocket if traffic grows
  $('#f-go',el).onclick=async()=>{const t=$('#f-m',el).value.trim();if(!t)return;await save({text:t});$('#f-m',el).value=''};
  $('#f-l',el).onclick=async e=>{const b=e.target.closest('button');if(!b)return;const c=b.closest('.card'),i=$('input',c);if(i.value.trim()){await save({text:i.value.trim(),parent:c.dataset.id});i.value=''}};
});

tab('hoso','Hồ sơ học tập',el=>{
  el.innerHTML=`<h2>Hồ sơ AI học Xác suất Thống kê</h2><p class="lede">Hồ sơ cá nhân tự cập nhật từ mọi hoạt động. AI chẩn đoán lỗi sai lặp lại và đề xuất kế hoạch bổ trợ.</p>
  <div class="row"><div><label for="h-n">Họ tên</label><input id="h-n"></div><div><label for="h-l">Lớp / trình độ</label><input id="h-l" placeholder="VD: Lớp 12, Đại học năm 1"></div></div><div id="h-s"></div>
  <div class="bar"><button class="b" id="h-go">Chẩn đoán và đề xuất bổ trợ</button></div><div class="out" id="h-o"></div>`;
  $('#h-n',el).value=LS.get('xs_name','');$('#h-l',el).value=LS.get('xs_lvl','');
  const t=tally();$('#h-s',el).innerHTML=`<p>Số lỗi ghi nhận: <b>${t.L.length}</b></p><h3>Chủ đề cần chú ý</h3>${bars(t.byTopic)}<h3 style="margin-top:12px">Loại lỗi lặp lại</h3>${bars(t.byTag)}`;
  $('#h-go',el).onclick=e=>{LS.set('xs_name',$('#h-n',el).value);LS.set('xs_lvl',$('#h-l',el).value);
    if(!t.L.length){$('#h-o',el).innerHTML='<p class="warn">Hồ sơ chưa có dữ liệu. Hãy luyện tập ở các tính năng khác trước.</p>';return}
    run(e.target,$('#h-o',el),async()=>{$('#h-o',el).innerHTML=md(await ai(`Học sinh: ${$('#h-n',el).value||'(chưa tên)'}, trình độ: ${$('#h-l',el).value||'?'}.\nLịch sử lỗi:\n${logLines(t.L)}\nViết hồ sơ: **Điểm mạnh** (nếu suy ra được), **Lỗi sai lặp lại và nguyên nhân**, **Kế hoạch bổ trợ 2 tuần** (từng buổi: nội dung ôn, loại bài luyện, tiêu chí đạt).`))})};
});

tab('saochep','Sao chép quy trình',el=>{
  el.innerHTML=`<h2>Bản sao quy trình</h2><p class="lede">Dán một bài toán, khái niệm hoặc định lí. AI tạo trợ lí dạy riêng cho nó: quy trình 4 bước đầy đủ, có ví dụ minh hoạ, củng cố và tương tác như đối tượng gốc.</p>
  <div><label for="c-k">Loại</label><select id="c-k">${kindOpts}</select></div><textarea id="c-t" placeholder="VD (định lí): Luật số lớn – với dãy biến ngẫu nhiên độc lập cùng phân phối có kì vọng μ, trung bình mẫu hội tụ về μ…"></textarea>
  <div class="bar"><button class="b" id="c-go">Tạo bản sao quy trình</button></div><div class="out" id="c-o"></div>`;
  $('#c-go',el).onclick=e=>{const t=$('#c-t',el).value.trim();if(!t)return;run(e.target,$('#c-o',el),async()=>{renderProcess($('#c-o',el),await genProcess($('#c-k',el).value,t,true),t)})};
});

/* ---------- shell ---------- */
const main=$('#main'),home=$('#home'),work=$('#work'),built={};
// [icon, mô tả ngắn, chữ trên nút] cho thẻ ở trang chủ
const META={
  quytrinh:['🧭','Dựng quy trình 4 bước cho bài toán, khái niệm hoặc định lí và đi qua từng bước.','🚀 Dựng quy trình'],
  bang:['📝','Chấm điểm theo barem từ ảnh chụp, file PDF hoặc bài viết tay trên bảng.','✍️ Nộp bài chấm'],
  giongnoi:['🎤','Hỏi đáp bằng giọng nói, viết công thức lên bảng khi cần.','🎧 Bắt đầu hỏi'],
  tuluan:['✏️','AI sinh 5 bài tự luận tương tự, chỉ kèm chiến lược giải.','🧩 Tạo 5 bài'],
  tracnghiem:['✅','Làm trắc nghiệm, có điểm ngay và hỏi AI vì sao đúng, sai.','⚡ Làm trắc nghiệm'],
  vandap:['💬','Trả lời câu hỏi lí thuyết, AI chỉ ra lỗ hổng kiến thức.','🎯 Vào vấn đáp'],
  thongke:['📊','Tổng hợp các câu sai và hướng khắc phục từng nhóm lỗi.','📈 Xem thống kê'],
  bandotuduy:['🗺️','Bản đồ tư duy giúp nhìn toàn cảnh một chủ đề.','🌿 Vẽ bản đồ'],
  diendan:['💡','Trao đổi, hỏi đáp và chia sẻ cách giải cùng bạn học.','🗨️ Vào diễn đàn'],
  hoso:['🏆','Hồ sơ cá nhân: lỗi hay mắc và kế hoạch bổ trợ 2 tuần.','🔥 Mở hồ sơ'],
  saochep:['🧬','Dán một bài, khái niệm hoặc định lí để nhân bản quy trình 4 bước.','🪄 Tạo bản sao'],
};
$('#cards').innerHTML=TABS.map((t,i)=>{const m=META[t.id];return `<a class="fcard c${i%4}" href="#${t.id}"><span class="lab">TÍNH NĂNG ${i+1}</span><span class="ico" aria-hidden="true">${m[0]}</span><h3>${t.title}</h3><p>${m[1]}</p><span class="go">${m[2]}</span></a>`}).join('');
function show(){
  const t=TABS.find(t=>t.id==location.hash.slice(1));
  home.hidden=!!t;work.hidden=!t;window.scrollTo(0,0);
  document.title=t?t.title+' · Xác Suất AI':'Xác Suất AI';
  if(!t)return;
  main.querySelectorAll('section').forEach(s=>s.hidden=s.dataset.id!=t.id);
  if(!built[t.id]){const s=document.createElement('section');s.className='tab';s.dataset.id=t.id;main.append(s);built[t.id]=s;t.build(s)}
  else if(t.id=='thongke')built[t.id].draw();
  else if(t.id=='hoso')t.build(built[t.id]);
}
addEventListener('hashchange',show);show();
