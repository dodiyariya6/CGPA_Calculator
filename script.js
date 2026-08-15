/* ============================================================
   GradeLedger — SGPA / CGPA Calculator
   Semester history (Sem 1–8 SGPA + credits, and subjects) is
   auto-saved to localStorage so it survives reloads. If storage
   is unavailable (e.g. a sandboxed preview blocks it), the app
   falls back silently to in-memory-only state.
   ============================================================ */

const STORAGE_KEY = 'gradeledger:history:v1';

const GRADES = [
  { label: 'O', val: 10 },
  { label: 'A+', val: 9 },
  { label: 'A', val: 8 },
  { label: 'B+', val: 7 },
  { label: 'B', val: 6 },
  { label: 'C', val: 5 },
  { label: 'F', val: 0 }
];

const state = {
  subjects: [],   // { id, name, grade, credits }
  semesters: [],  // { id, sgpa, credits }
  nextSubjectId: 0,
  nextSemId: 0,
  darkMode: false
};

/* ---------- persistence (history) ---------- */
function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // storage blocked/unavailable — behave as before
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      subjects: state.subjects,
      nextSubjectId: state.nextSubjectId,
      semesters: state.semesters,
      nextSemId: state.nextSemId,
      darkMode: state.darkMode
    }));
  } catch (e) {
    /* ignore — nothing we can do if storage is unavailable/full */
  }
}

function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  resetCGPA();
}

/* ---------- boot ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const saved = loadPersistedState();
  const hasSaved = saved && ((saved.subjects && saved.subjects.length) || (saved.semesters && saved.semesters.length));

  if (hasSaved) {
    state.subjects = saved.subjects || [];
    state.nextSubjectId = saved.nextSubjectId || 0;
    state.semesters = saved.semesters || [];
    state.nextSemId = saved.nextSemId || 0;
    state.darkMode = !!saved.darkMode;

    if (!state.subjects.length) { addSubject(); addSubject(); addSubject(); }
    else { renderSubjects(); calcSGPA(); }

    if (!state.semesters.length) { for (let i = 0; i < 8; i++) addSem(); }
    else { renderSemesters(); calcCGPA(); }

    if (state.darkMode) {
      document.getElementById('darkToggle').checked = true;
      document.body.setAttribute('data-theme', 'dark');
    }
  } else {
    addSubject(); addSubject(); addSubject();
    for (let i = 0; i < 8; i++) addSem(); // Sem 1–8 by default
  }
});

/* ---------- tabs & theme ---------- */
function switchTab(name, btn) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('pane-' + name).classList.add('active');
  btn.classList.add('active');
}

function toggleDark() {
  state.darkMode = document.getElementById('darkToggle').checked;
  document.body.setAttribute('data-theme', state.darkMode ? 'dark' : '');
  persistState();
}

/* ---------- shared helpers ---------- */
function gradeLabel(v) {
  if (v >= 9.5) return 'Outstanding';
  if (v >= 8.5) return 'Excellent';
  if (v >= 7.5) return 'Very Good';
  if (v >= 6.5) return 'Good';
  if (v >= 5.5) return 'Average';
  if (v >= 4.5) return 'Pass';
  return 'Needs Improvement';
}

function gradeSymbol(points) {
  const g = GRADES.find(g => g.val === points);
  return g ? g.label : points;
}

function gradeSelectHTML(id, selectedVal) {
  const opts = GRADES.map(g =>
    `<option value="${g.val}" ${g.val == selectedVal ? 'selected' : ''}>${g.label} (${g.val})</option>`
  ).join('');
  return `<select id="${id}" onchange="onSubjectChange(${id.split('-')[1]})">${opts}</select>`;
}

/* ============================================================
   SGPA — subjects
   ============================================================ */
function addSubject(name = '', grade = 10, credits = 4) {
  const id = state.nextSubjectId++;
  state.subjects.push({ id, name, grade, credits });
  renderSubjects();
  calcSGPA();
  persistState();
}

function removeSubject(id) {
  state.subjects = state.subjects.filter(s => s.id !== id);
  if (state.subjects.length === 0) { addSubject(); return; }
  renderSubjects();
  calcSGPA();
  persistState();
}

function onSubjectChange(id) {
  const row = state.subjects.find(s => s.id === id);
  if (!row) return;
  row.name = document.getElementById('sname-' + id).value;
  row.grade = parseFloat(document.getElementById('sgrade-' + id).value);
  row.credits = document.getElementById('scred-' + id).value;
  calcSGPA();
  persistState();
}

function renderSubjects() {
  const list = document.getElementById('subjectList');
  list.innerHTML = state.subjects.map(s => `
    <div class="subject-row" id="sub-${s.id}">
      <input type="text" id="sname-${s.id}" value="${s.name}" placeholder="Subject" oninput="onSubjectChange(${s.id})"/>
      ${gradeSelectHTML('sgrade-' + s.id, s.grade)}
      <input type="number" id="scred-${s.id}" value="${s.credits}" min="1" max="10" placeholder="Credits" oninput="onSubjectChange(${s.id})"/>
      <button class="icon-btn del-btn" onclick="removeSubject(${s.id})" title="Remove">✕</button>
    </div>
  `).join('');
}

function calcSGPA() {
  let totalPts = 0, totalCred = 0;
  const breakdown = [];

  state.subjects.forEach(s => {
    const grade = parseFloat(s.grade) || 0;
    const cred = parseFloat(s.credits);
    const name = s.name || 'Subject';
    if (!isNaN(cred) && cred > 0) {
      totalPts += grade * cred;
      totalCred += cred;
      breakdown.push({ name, grade, cred, pts: grade * cred });
    }
  });

  const resultBox = document.getElementById('sgpaResult');
  if (!breakdown.length || totalCred === 0) {
    resultBox.style.display = 'none';
    return;
  }

  const sgpa = totalPts / totalCred;
  document.getElementById('sgpaValue').textContent = sgpa.toFixed(2);
  document.getElementById('sgpaTotalCredits').textContent = totalCred;
  document.getElementById('sgpaPct').textContent = (sgpa * 9.5).toFixed(1) + '%';
  document.getElementById('sgpaGrade').textContent = gradeLabel(sgpa);
  resultBox.style.display = 'block';

  document.getElementById('sgpaBreakdownBody').innerHTML = breakdown.map(b =>
    `<tr><td>${b.name}</td><td>${gradeSymbol(b.grade)} (${b.grade})</td><td>${b.cred}</td><td>${b.pts.toFixed(1)}</td></tr>`
  ).join('');
  document.getElementById('sgpaBreakdownFoot').innerHTML =
    `<tr style="font-weight:700;color:var(--accent)"><td colspan="2">Total</td><td>${totalCred}</td><td>${totalPts.toFixed(1)}</td></tr>`;
}

function resetSGPA() {
  state.subjects = [];
  state.nextSubjectId = 0;
  document.getElementById('sgpaResult').style.display = 'none';
  addSubject(); addSubject(); addSubject();
  persistState();
}

/* ============================================================
   CGPA — semesters
   ============================================================ */
function addSem(sgpa = '', credits = '') {
  const id = state.nextSemId++;
  state.semesters.push({ id, sgpa, credits });
  renderSemesters();
  calcCGPA();
  persistState();
}

function removeSem(id) {
  state.semesters = state.semesters.filter(s => s.id !== id);
  if (state.semesters.length === 0) { addSem(); return; }
  renderSemesters();
  calcCGPA();
  persistState();
}

function onSemChange(id) {
  const row = state.semesters.find(s => s.id === id);
  if (!row) return;
  row.sgpa = document.getElementById('ssgpa-' + id).value;
  row.credits = document.getElementById('scrd-' + id).value;
  calcCGPA();
  persistState();
}

function renderSemesters() {
  const list = document.getElementById('semList');
  list.innerHTML = state.semesters.map((s, i) => `
    <div class="sem-row" id="sem-${s.id}">
      <div class="sem-badge">${i + 1}</div>
      <input type="number" id="ssgpa-${s.id}" value="${s.sgpa}" min="0" max="10" step="0.01" placeholder="0.00–10" oninput="onSemChange(${s.id})"/>
      <input type="number" id="scrd-${s.id}"  value="${s.credits}" min="1" placeholder="Credits" oninput="onSemChange(${s.id})"/>
      <button class="icon-btn del-btn" onclick="removeSem(${s.id})" title="Remove">✕</button>
    </div>
  `).join('');
}

function calcCGPA() {
  let totalPts = 0, totalCred = 0;
  const breakdown = [];

  state.semesters.forEach((s, i) => {
    const sgpa = parseFloat(s.sgpa);
    const cred = parseFloat(s.credits);
    if (!isNaN(sgpa) && !isNaN(cred) && cred > 0 && sgpa >= 0) {
      totalPts += sgpa * cred;
      totalCred += cred;
      breakdown.push({ name: 'Sem ' + (i + 1), sgpa, cred, pts: sgpa * cred });
    }
  });

  const resultBox = document.getElementById('cgpaResult');
  if (!breakdown.length || totalCred === 0) {
    resultBox.style.display = 'none';
    return;
  }

  const cgpa = totalPts / totalCred;
  document.getElementById('cgpaValue').textContent = cgpa.toFixed(2);
  document.getElementById('cgpaTotalCredits').textContent = totalCred;
  document.getElementById('cgpaPct').textContent = (cgpa * 9.5).toFixed(1) + '%';
  document.getElementById('cgpaGrade').textContent = gradeLabel(cgpa);
  resultBox.style.display = 'block';

  document.getElementById('cgpaBreakdownBody').innerHTML = breakdown.map(b =>
    `<tr><td>${b.name}</td><td>${b.sgpa.toFixed(2)}</td><td>${b.cred}</td><td>${b.pts.toFixed(2)}</td></tr>`
  ).join('');
  document.getElementById('cgpaBreakdownFoot').innerHTML =
    `<tr style="font-weight:700;color:var(--accent)"><td colspan="2">Total</td><td>${totalCred}</td><td>${totalPts.toFixed(2)}</td></tr>`;
}

function resetCGPA() {
  state.semesters = [];
  state.nextSemId = 0;
  document.getElementById('cgpaResult').style.display = 'none';
  for (let i = 0; i < 8; i++) addSem(); // Sem 1–8
  persistState();
}

/* ============================================================
   Converter
   ============================================================ */
function convertCGPA() {
  const v = parseFloat(document.getElementById('cgpaConv').value);
  const el = document.getElementById('convResult');
  el.textContent = (!isNaN(v) && v >= 0 && v <= 10)
    ? '→ ' + (v * 9.5).toFixed(2) + '%  — ' + gradeLabel(v)
    : '';
}
