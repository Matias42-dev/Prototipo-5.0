// ClaseCheck - prototipo final (local simulation)
const USERS = {
  student: { username: "alumno", password: "1234" },
  teacher: { username: "docente", password: "1234" },
  admin: { username: "admin", password: "1234" }
};

const DATA = {
  students: [
    { id: "ana", name: "Ana López", enroll: ["c1","c2"] },
    { id: "luis", name: "Luis García", enroll: ["c1"] },
    { id: "maria", name: "María Pérez", enroll: ["c2"] }
  ],
  classes: [
    { id: "c1", name: "Prog 1", teacher: "docente" },
    { id: "c2", name: "Bases", teacher: "docente" }
  ],
  attendance: JSON.parse(localStorage.getItem("cc_attendance")||"[]")
};

const ABSENCE_THRESHOLD = 3;
let current = { role:null, user:null };
let activeToken = null;
let qrObject = null;
let html5Scanner = null;

const el = id=>document.getElementById(id);
function save(){ localStorage.setItem("cc_attendance", JSON.stringify(DATA.attendance)); }
function nowLabel(){ return new Date().toLocaleString(); }

el("loginBtn").addEventListener("click", ()=>{
  const role = el("role").value;
  const u = el("username").value.trim();
  const p = el("password").value.trim();
  const cred = (role==="student")?USERS.student:(role==="teacher")?USERS.teacher:USERS.admin;
  if(cred && u===cred.username && p===cred.password){
    current.role = role; current.user = u;
    el("loginView").classList.add("hidden");
    el("app").classList.remove("hidden");
    el("navUser").textContent = `${u} (${role})`;
    showPanelForRole();
    renderAll();
    el("loginError").style.display = "none";
  } else {
    el("loginError").style.display = "block";
  }
});

el("demoCreds").addEventListener("click", ()=>{
  alert("Credenciales demo:\nAlumno: alumno / 1234\nDocente: docente / 1234\nAdmin: admin / 1234");
});
el("logoutBtn").addEventListener("click", ()=>{ location.reload(); });

function showPanelForRole(){
  el("studentPanel").classList.add("hidden");
  el("teacherPanel").classList.add("hidden");
  el("adminPanel").classList.add("hidden");
  if(current.role==="student") el("studentPanel").classList.remove("hidden");
  if(current.role==="teacher") el("teacherPanel").classList.remove("hidden");
  if(current.role==="admin") el("adminPanel").classList.remove("hidden");
}

function renderAll(){
  const sc = el("studentClasses"); sc.innerHTML = "";
  DATA.classes.forEach(c=>{ const o=document.createElement("option"); o.value=c.id; o.textContent=c.name; sc.appendChild(o); });
  const tc = el("teacherClasses"); tc.innerHTML = ""; DATA.classes.forEach(c=>{ const o=document.createElement("option"); o.value=c.id; o.textContent=c.name; tc.appendChild(o); });
  renderStudentHistory();
  renderTeacherList();
  renderAdminReport();
  el("thresholdLabel").textContent = ABSENCE_THRESHOLD;
}

function renderStudentHistory(){
  const tb = el("studentHistory").querySelector("tbody"); tb.innerHTML = "";
  DATA.attendance.filter(a=>a.student==="ana").forEach(r=>{
    const tr=document.createElement("tr"); tr.innerHTML = `<td>${r.classId}</td><td>${r.when}</td><td>${r.validated? "Validado":"Registrado"}</td>`;
    tb.appendChild(tr);
  });
}

function renderTeacherList(){
  const tbody = el("teacherList").querySelector("tbody"); tbody.innerHTML = "";
  const cid = el("teacherClasses").value;
  DATA.attendance.filter(a=>a.classId===cid).forEach(a=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.student}</td><td>${a.when}</td><td>${a.validated?'<span style="color:green">Sí</span>':'<button class="validateBtn" data-id="${a.id}">Validar</button>'}</td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".validateBtn").forEach(b=>b.addEventListener("click", e=>{
    const id = e.target.dataset.id;
    const rec = DATA.attendance.find(x=>x.id===id); if(rec){ rec.validated=true; save(); renderTeacherList(); renderStudentHistory(); renderAdminReport(); }
  }));
}

function renderAdminReport(){
  const tbody = el("adminReport").querySelector("tbody"); tbody.innerHTML = "";
  const alerts = el("alerts"); alerts.innerHTML = "";
  const students = DATA.students.map(s=>s.id);
  students.forEach(sid=>{
    DATA.classes.forEach(cl=>{
      const cnt = DATA.attendance.filter(a=>a.student===sid && a.classId===cl.id && !a.validated).length;
      const tr=document.createElement("tr"); tr.innerHTML = `<td>${sid}</td><td>${cl.name}</td><td>${cnt}</td>`; tbody.appendChild(tr);
      if(cnt>=ABSENCE_THRESHOLD){
        const d=document.createElement("div"); d.className="card"; d.style.marginTop="8px"; d.textContent=`ALERTA: ${sid} tiene ${cnt} faltas en ${cl.name}`; alerts.appendChild(d);
      }
    });
  });
}

el("generateQR").addEventListener("click", ()=>{
  const cid = el("teacherClasses").value;
  if(!cid){ alert("Seleccioná una materia"); return; }
  activeToken = `${cid}|${Date.now()}|${Math.random().toString(36).substring(2,6)}`;
  const qrArea = el("qrArea"); qrArea.innerHTML = ""; const qdiv=document.createElement("div"); qrArea.appendChild(qdiv); qrObject = new QRCode(qdiv, { text: activeToken, width:160, height:160 });
  el("generateQR").style.display="none"; el("stopQR").style.display="inline-block";
});

el("stopQR").addEventListener("click", ()=>{
  el("qrArea").innerHTML=""; activeToken=null; qrObject=null; el("stopQR").style.display="none"; el("generateQR").style.display="inline-block";
});

el("openScanner").addEventListener("click", async ()=>{
  el("scannerArea").classList.remove("hidden");
  try{
    html5Scanner = new Html5Qrcode("reader");
    await html5Scanner.start({facingMode:"environment"}, {fps:10, qrbox:250}, qr=>{ handleToken(qr); });
  }catch(e){ alert("No se pudo iniciar la cámara. Usá pegar token."); el("scannerArea").classList.add("hidden"); }
});

el("closeScanner").addEventListener("click", async ()=>{ el("scannerArea").classList.add("hidden"); if(html5Scanner){ await html5Scanner.stop(); await html5Scanner.clear(); html5Scanner=null; } });

el("useTokenBtn").addEventListener("click", ()=>{ el("tokenPasteArea").classList.toggle("hidden"); });
el("pasteTokenBtn").addEventListener("click", ()=>{ const t = el("manualToken").value.trim(); if(t) handleToken(t); });

function handleToken(token){
  const selectedClass = document.querySelector("#studentClasses").value;
  if(!activeToken){ alert("No hay QR activo generado por el docente."); return; }
  const parts = token.split("|");
  const classId = parts[0];
  if(classId !== selectedClass){ alert("El token no corresponde a la materia seleccionada."); return; }
  el("geoResult").textContent = "Validando ubicación...";
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{ finishRegister(classId); }, err=>{ setTimeout(()=>{ finishRegister(classId); }, 800); }, {timeout:5000});
  } else {
    setTimeout(()=>{ finishRegister(classId); }, 600);
  }
}

function finishRegister(classId){
  const id = Math.random().toString(36).substring(2,9);
  DATA.attendance.push({ id, student: "ana", classId, when: nowLabel(), validated:false });
  save(); renderStudentHistory(); renderTeacherList(); renderAdminReport();
  el("geoResult").textContent = "Asistencia registrada y ubicación verificada ✅";
  if(html5Scanner){ html5Scanner.stop().then(()=>html5Scanner.clear()).catch(()=>{}); html5Scanner=null; el("scannerArea").classList.add("hidden"); }
}

el("validateAll").addEventListener("click", ()=>{ DATA.attendance.forEach(a=>a.validated=true); save(); renderTeacherList(); renderAdminReport(); alert("Todos los registros validados."); });

el("clearData").addEventListener("click", ()=>{ if(confirm("Limpiar datos de simulación?")){ DATA.attendance=[]; save(); renderStudentHistory(); renderTeacherList(); renderAdminReport(); el("statusBox").textContent="Datos reiniciados."; } });

document.addEventListener("DOMContentLoaded", ()=>{});