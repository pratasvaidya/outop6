let DATABASE = {};
let appState = {
  selectedProgramKey: null,
  customName: '',
  customTarget: '',
  earlyAdmission: false,
  courses: Array(6).fill(null).map(() => ({ code: '', grade: '', repeat: false, isReq: false }))
};
let dropdownFocusIndex = -1;
let allProgItems = [];
let filterTimer = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function initApp() {
  try {
    const response = await fetch('./data/programs.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    DATABASE = await response.json();
  } catch (error) {
    console.error('Error loading program database:', error);
    showError('Failed to load program data. Please check your connection.');
    return;
  }

  if (!loadURLState()) loadLocalStorage();

  renderCombobox();
  renderCourseList();

  if (appState.selectedProgramKey) {
    applyProgramSelection(appState.selectedProgramKey, false);
  }

  document.getElementById('early-admission-toggle').checked = appState.earlyAdmission;
  handleInputChange();

   document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.search-box')) {
      const menu = document.getElementById('dropdown-menu');
      menu.classList.remove('active');
      menu.scrollTop = 0;
    }
  });

  document.getElementById('dropdown-menu').addEventListener('touchmove', (e) => {
    e.stopPropagation();
  }, { passive: true });}

document.addEventListener('DOMContentLoaded', initApp);

// ── State ─────────────────────────────────────────────────────────────────────

function saveState() {
  appState.courses = Array.from(document.querySelectorAll('.course-row')).map(row => ({
    code: row.querySelector('.code').value.toUpperCase().trim(),
    grade: row.querySelector('.grade').value,
    repeat: false,
    isReq: row.querySelector('.code').classList.contains('is-req')
  }));

  appState.earlyAdmission = document.getElementById('early-admission-toggle').checked;

  if (appState.selectedProgramKey === 'custom') {
    appState.customName = document.getElementById('custom-name').value;
    appState.customTarget = document.getElementById('custom-target').value;
  }

  localStorage.setItem('top6State_v2', JSON.stringify(appState));
  updateURLParams();
}

function loadLocalStorage() {
  const saved = localStorage.getItem('top6State_v2');
  if (!saved) return;
  try {
    appState = JSON.parse(saved);
    if (appState.selectedProgramKey === 'custom') {
      document.getElementById('custom-name').value = appState.customName || '';
      document.getElementById('custom-target').value = appState.customTarget || '';
    }
  } catch (e) {}
}

function updateURLParams() {
  const params = new URLSearchParams();
  if (appState.selectedProgramKey) params.set('prog', appState.selectedProgramKey);
  if (appState.earlyAdmission) params.set('early', '1');

  const courseData = appState.courses
    .filter(c => c.code || c.grade)
    .map(c => `${c.code}:${c.grade}`)
    .join(',');

  if (courseData) params.set('c', courseData);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

function loadURLState() {
  const params = new URLSearchParams(window.location.search);
  const prog = params.get('prog');
  const courseStr = params.get('c');
  const early = params.get('early');

  if (!prog && !courseStr) return false;

  if (prog) appState.selectedProgramKey = prog;
  if (early === '1') appState.earlyAdmission = true;

  if (courseStr) {
    appState.courses = courseStr.split(',').map(item => {
      const parts = item.split(':');
      return { code: parts[0] || '', grade: parts[1] || '', repeat: false, isReq: false };
    });
  }
  return true;
}

function copyShareLink() {
  saveState();
  const url = window.location.href;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url);
  } else {
    const el = document.createElement('textarea');
    el.value = url;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  const btn = document.querySelector('[onclick="copyShareLink()"]');
  const orig = btn.innerText;
  btn.innerText = '✓';
  setTimeout(() => btn.innerText = orig, 1800);
}

// ── Combobox ──────────────────────────────────────────────────────────────────

function renderCombobox() {
  const catOrder = ['Engineering', 'Science', 'Business', 'Other'];
  allProgItems = [];

  for (const cat of catOrder) {
    const progs = Object.entries(DATABASE)
      .filter(([, p]) => p.cat === cat)
      .map(([key, p]) => ({ key, ...p }))
      .sort((a, b) => a.university.localeCompare(b.university) || a.name.localeCompare(b.name));
    if (progs.length === 0) continue;
    allProgItems.push({ type: 'group', label: cat });
    progs.forEach(p => allProgItems.push({ type: 'item', ...p }));
  }
  allProgItems.push({ type: 'custom' });

  filterPrograms();
}

function showDropdown() {
  document.getElementById('dropdown-menu').classList.add('active');
  dropdownFocusIndex = -1;
  // On mobile, scroll to top so search input stays visible
  if (window.innerWidth <= 580) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function debouncedFilter() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(filterPrograms, 180);
}

function filterPrograms() {
  const query = document.getElementById('program-search').value.toLowerCase().trim();
  const menu = document.getElementById('dropdown-menu');
  menu.innerHTML = '';

  // Pre-build group boundary map to avoid O(n^2) indexOf
  const groupBoundaries = [];
  allProgItems.forEach((entry, i) => {
    if (entry.type === 'group') groupBoundaries.push(i);
  });

  for (let i = 0; i < allProgItems.length; i++) {
    const entry = allProgItems[i];

    if (entry.type === 'group') {
      const boundaryIdx = groupBoundaries.indexOf(i);
      const nextGroupIdx = groupBoundaries[boundaryIdx + 1] ?? allProgItems.length;
      const hasMatch = allProgItems.slice(i + 1, nextGroupIdx).some(e =>
        e.type === 'item' && (!query || `${e.university} ${e.name}`.toLowerCase().includes(query))
      );
      if (!hasMatch) continue;

      const el = document.createElement('div');
      el.className = 'dropdown-group';
      el.innerText = entry.label;
      menu.appendChild(el);
      continue;
    }

    if (entry.type === 'custom') {
      const el = document.createElement('div');
      el.className = 'dropdown-item custom-opt';
      el.innerText = '+ Enter custom target';
      el.onclick = () => selectProgram('custom');
      menu.appendChild(el);
      continue;
    }

    if (query && !`${entry.university} ${entry.name}`.toLowerCase().includes(query)) continue;

    const el = document.createElement('div');
    el.className = 'dropdown-item';
    el.dataset.key = entry.key;
    el.innerHTML = `<span class="item-uni">${entry.university}</span><span class="item-name">${entry.name}</span>`;
    el.onclick = () => selectProgram(entry.key);
    menu.appendChild(el);
  }

  menu.classList.add('active');
  dropdownFocusIndex = -1;
}

function handleSearchKey(e) {
  const menu = document.getElementById('dropdown-menu');
  const visibleItems = Array.from(menu.querySelectorAll('.dropdown-item'));

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    dropdownFocusIndex = Math.min(dropdownFocusIndex + 1, visibleItems.length - 1);
    updateDropdownFocus(visibleItems);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    dropdownFocusIndex = Math.max(dropdownFocusIndex - 1, 0);
    updateDropdownFocus(visibleItems);
  } else if (e.key === 'Enter' && dropdownFocusIndex >= 0) {
    e.preventDefault();
    visibleItems[dropdownFocusIndex]?.click();
  }
}

function updateDropdownFocus(items) {
  items.forEach((item, i) => {
    item.classList.toggle('focused', i === dropdownFocusIndex);
    if (i === dropdownFocusIndex) item.scrollIntoView({ block: 'nearest' });
  });
}

function selectProgram(key) {
  document.getElementById('dropdown-menu').classList.remove('active');
  document.getElementById('program-search').value = '';
  applyProgramSelection(key, true);
  appState.selectedProgramKey = key;
  handleInputChange();
}

function applyProgramSelection(key, autoFillReqs = false) {
  appState.selectedProgramKey = key;
  const display = document.getElementById('selected-program-display');
  const nameSpan = document.getElementById('selected-program-name');
  const uniSpan = document.getElementById('selected-program-uni');
  const progLink = document.getElementById('selected-program-link');
  const customContainer = document.getElementById('custom-inputs');
  const searchContainer = document.getElementById('search-container');

  display.classList.add('active');
  searchContainer.style.display = 'none';

  if (key === 'custom') {
    uniSpan.innerText = '';
    nameSpan.innerText = 'Custom Target';
    progLink.style.display = 'none';
    customContainer.classList.add('active');
  } else {
    const prog = DATABASE[key];
    uniSpan.innerText = prog.university;
    nameSpan.innerText = prog.name;
    if (prog.url) {
      progLink.href = prog.url;
      progLink.style.display = 'inline';
    } else {
      progLink.style.display = 'none';
    }
    customContainer.classList.remove('active');

    if (autoFillReqs && prog.reqs) {
      prog.reqs.forEach(req => {
        if (Array.isArray(req)) return;
        if (!appState.courses.some(c => c.code.toUpperCase() === req)) {
          const emptyIdx = appState.courses.findIndex(c => !c.code);
          if (emptyIdx !== -1) {
            appState.courses[emptyIdx].code = req;
          } else {
            appState.courses.push({ code: req, grade: '', repeat: false, isReq: true });
          }
        }
      });
      renderCourseList();
    }
  }
}

function clearProgram() {
  appState.selectedProgramKey = null;
  appState.courses = [{ code: 'ENG4U', grade: '', repeat: false, isReq: true }];
  document.getElementById('selected-program-display').classList.remove('active');
  document.getElementById('custom-inputs').classList.remove('active');
  document.getElementById('search-container').style.display = 'block';
  renderCourseList();
  handleInputChange();
}

// ── Course rows ───────────────────────────────────────────────────────────────

function normalizeCode(raw) {
  const s = raw.toUpperCase().replace(/\s+/g, '');
  return s.length > 5 ? s.substring(0, 5) : s;
}

function renderCourseList() {
  const container = document.getElementById('course-list');
  container.innerHTML = '';

  appState.courses.forEach((course, index) => {
    const row = document.createElement('div');
    row.className = 'table-grid course-row';
    row.innerHTML = `
      <input type="text" class="code ${course.isReq ? 'is-req' : ''}" placeholder="e.g. ENG4U" value="${course.code}" oninput="handleInputChange()">
      <input type="number" class="grade" placeholder="%" min="0" max="100" value="${course.grade}" oninput="handleInputChange()">
      <button class="remove-course-btn" onclick="removeCourseRow(${index})" aria-label="Remove course">✕</button>
    `;
    container.appendChild(row);
  });
}

function addCourseRow() {
  appState.courses.push({ code: '', grade: '', repeat: false, isReq: false });
  renderCourseList();
}

function removeCourseRow(index) {
  if (appState.courses.length <= 1) return;
  appState.courses.splice(index, 1);
  renderCourseList();
  handleInputChange();
}

// ── Calculation ───────────────────────────────────────────────────────────────

function getProgramDetails() {
  if (!appState.selectedProgramKey) return null;
  if (appState.selectedProgramKey === 'custom') {
    return {
      name: document.getElementById('custom-name').value || 'Custom Program',
      university: '',
      target: parseFloat(document.getElementById('custom-target').value) || 85,
      reqs: [],
      suppApp: false,
      url: null
    };
  }
  return DATABASE[appState.selectedProgramKey];
}

function calculateTop6Data() {
  const early = document.getElementById('early-admission-toggle').checked;
  const prog = getProgramDetails();
  const reqList = prog ? prog.reqs : [];

  const allCourses = [];
  const invalidCodes = [];

  document.querySelectorAll('.course-row').forEach(row => {
    const codeInput = row.querySelector('.code');
    const gradeInput = row.querySelector('.grade');
    const code = normalizeCode(codeInput.value);
    const gradeVal = parseFloat(gradeInput.value);

    if (gradeInput.value !== '' && (isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100)) {
      gradeInput.classList.add('input-error');
    } else {
      gradeInput.classList.remove('input-error');
    }

    if (!code || isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100) return;

    const is4U4M = /^[A-Z]{3}4[UM]\d?$/i.test(code);
    const is3U3M = /^[A-Z]{3}3[UM]\d?$/i.test(code);

    if (!is4U4M && !(early && is3U3M)) invalidCodes.push(code);

    allCourses.push({ code, grade: gradeVal, is4U4M, is3U3M });
  });

  const uniqueMap = new Map();
  let duplicatesFound = false;
  allCourses.forEach(c => {
    if (uniqueMap.has(c.code)) {
      duplicatesFound = true;
      if (c.grade > uniqueMap.get(c.code).grade) uniqueMap.set(c.code, c);
    } else {
      uniqueMap.set(c.code, c);
    }
  });

  const cleanCourses = Array.from(uniqueMap.values());
  const validEligible = cleanCourses.filter(c => c.is4U4M || (early && c.is3U3M));

  const top6 = [];
  const usedIndices = new Set();

  reqList.forEach(req => {
    const options = Array.isArray(req) ? req : [req];
    let matchIdx = -1;
    for (const opt of options) {
      const prefix = early ? opt.substring(0, 3) : opt.substring(0, 4);
      const idx = validEligible.findIndex((c, i) => !usedIndices.has(i) && c.code.startsWith(prefix));
      if (idx !== -1) { matchIdx = idx; break; }
    }
    if (matchIdx !== -1) {
      top6.push({ ...validEligible[matchIdx], isPrereq: true });
      usedIndices.add(matchIdx);
    }
  });

  const remaining = validEligible
    .filter((_, i) => !usedIndices.has(i))
    .sort((a, b) => b.grade - a.grade);

  let mCount = top6.filter(c => c.code.charAt(4) === 'M').length;

  for (const course of remaining) {
    if (top6.length >= 6) break;
    const isM = course.code.charAt(4) === 'M';
    if (isM && mCount >= 2) continue;
    if (isM) mCount++;
    top6.push({ ...course, isPrereq: false });
  }

  const top6Codes = new Set(top6.map(c => c.code));
  const excluded = validEligible.filter(c => !top6Codes.has(c.code));
  const sum = top6.reduce((acc, c) => acc + c.grade, 0);
  const avg = top6.length > 0 ? sum / top6.length : 0;

  return {
    avg,
    top6Courses: top6,
    excludedCourses: excluded,
    allCodes: cleanCourses.map(c => c.code),
    hasSix: top6.length >= 6,
    invalidCodes,
    mCourseCount: mCount,
    duplicatesFound
  };
}

// ── Live update ───────────────────────────────────────────────────────────────

function handleInputChange() {
  saveState();
  const data = calculateTop6Data();
  const prog = getProgramDetails();
  const reqs = prog ? prog.reqs : [];

  const avgVal = data.avg > 0 ? `${data.avg.toFixed(1)}%` : '—';
  const avgClass = data.avg >= 90 ? 'avg-high' : data.avg >= 80 ? 'avg-mid' : data.avg > 0 ? 'avg-low' : '';

  const avgEl = document.getElementById('live-avg');
  avgEl.innerText = avgVal;
  avgEl.className = avgClass;

  const sbAvg = document.getElementById('scoreboard-avg');
  if (sbAvg) { sbAvg.innerText = avgVal; sbAvg.className = 'scoreboard-avg-num ' + avgClass; }

  document.querySelectorAll('.course-row').forEach(row => {
    const codeInput = row.querySelector('.code');
    const code = normalizeCode(codeInput.value);
    const codeBase = code.substring(0, 4);
    codeInput.classList.toggle('is-req', !!code && reqs.some(r =>
      Array.isArray(r) ? r.some(opt => opt.startsWith(codeBase)) : r.startsWith(codeBase)
    ));
  });
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function showError(msg) {
  const b = document.getElementById('error-banner');
  b.innerText = msg;
  b.style.display = 'block';
}

function hideError() {
  document.getElementById('error-banner').style.display = 'none';
}

function runAnalysis() {
  hideError();

  const prog = getProgramDetails();
  if (!prog) {
    showError('Select a program or enter a custom target first.');
    return;
  }

  const data = calculateTop6Data();
  const early = document.getElementById('early-admission-toggle').checked;

  const summary = document.getElementById('prereq-summary');
  const pills = document.getElementById('prereq-pills');
  pills.innerHTML = '';

  if (prog.reqs.length === 0) {
    summary.innerText = 'No specific prerequisites listed for this program.';
  } else {
    summary.innerText = `Prerequisites for ${prog.name}:`;
    prog.reqs.forEach(req => {
      const pill = document.createElement('span');
      const isOr = Array.isArray(req);
      const options = isOr ? req : [req];
      const has = options.some(opt => {
        const prefix = early ? opt.substring(0, 3) : opt.substring(0, 4);
        return data.allCodes.some(c => c.startsWith(prefix));
      });
      const label = isOr ? options.join(' or ') : req;
      pill.className = has ? 'pill valid' : 'pill missing';
      pill.innerText = has ? `✓ ${label}` : `✕ ${label}`;
      pills.appendChild(pill);
    });
  }

  const leftWarnings = document.getElementById('left-warnings');
  leftWarnings.innerHTML = '';

  prog.reqs.forEach(req => {
    const options = Array.isArray(req) ? req : [req];
    const matched = data.top6Courses.find(c =>
      options.some(opt => c.code.startsWith(opt.substring(0, 4)))
    );
    if (matched && matched.grade < 70) {
      leftWarnings.innerHTML += `<div class="warning-box danger">⚠ ${matched.code} is below the typical 70% prerequisite minimum.</div>`;
    }
  });

  if (!data.hasSix) {
    leftWarnings.innerHTML += `<div class="warning-box warn">Fewer than 6 courses — add ${6 - data.top6Courses.length} more for an accurate average.</div>`;
  }
  if (data.invalidCodes.length > 0) {
    leftWarnings.innerHTML += `<div class="warning-box warn">Unrecognized codes: ${data.invalidCodes.join(', ')}. Use Ontario format (e.g. ENG4U).</div>`;
  }
  if (data.mCourseCount > 2) {
    leftWarnings.innerHTML += `<div class="warning-box info">Only the top 2 'M' courses count. Others are excluded from your average.</div>`;
  }
  if (data.duplicatesFound) {
    leftWarnings.innerHTML += `<div class="warning-box info">Duplicate codes found — highest grade used for each.</div>`;
  }

  renderTop6Breakdown(data, prog);

  const gapMetric = document.getElementById('gap-metric');
  const gapAnalysis = document.getElementById('gap-analysis');
  const rightWarnings = document.getElementById('right-warnings');
  rightWarnings.innerHTML = '';

  const diff = data.avg - prog.target;
  gapMetric.className = 'metric-value';

  if (diff >= 2) {
    gapMetric.classList.add('metric-success');
    gapMetric.innerText = `+${diff.toFixed(1)}%`;
    gapAnalysis.innerText = 'Comfortably above the historical cutoff.';
  } else if (diff >= 0) {
    gapMetric.classList.add('metric-success');
    gapMetric.innerText = `+${diff.toFixed(1)}%`;
    gapAnalysis.innerText = 'At target — competitive, but a higher average adds safety margin.';
  } else if (diff >= -3) {
    gapMetric.classList.add('metric-warn');
    gapMetric.innerText = `${diff.toFixed(1)}%`;
    gapAnalysis.innerText = 'Borderline. A strong supplementary application is critical.';
  } else {
    gapMetric.classList.add('metric-danger');
    gapMetric.innerText = `${diff.toFixed(1)}%`;
    gapAnalysis.innerText = 'Below target. Consider alternate universities or upgrading courses.';
  }

  if (prog.target && appState.selectedProgramKey !== 'custom') {
    rightWarnings.innerHTML += `<div class="warning-box info">Historical cutoff range: <strong>${getGradeRangeLabel(prog.target)}</strong>. Cutoffs shift year to year.</div>`;
  }
  if (prog.suppApp) {
    const reason = prog.suppReason || 'supplementary application';
    const details = {
      'AIF + video interview': 'This program requires an Admission Information Form (AIF) and a video interview. Grades are one factor — Waterloo reviews the full application.',
      'AIF': 'This program requires an Admission Information Form (AIF). Grades alone do not determine admission.',
      'Supplementary application': 'This program requires a supplementary application. Grades are reviewed alongside additional criteria.',
      'Audition': 'Admission requires a live or recorded audition. Academic grades are a secondary factor.',
      'Portfolio/interview': 'Admission requires a portfolio and/or interview. Grades are a secondary factor.',
      'Portfolio': 'Admission requires a portfolio. Academic grades alone are not sufficient.',
    };
    const msg = details[reason] || `This program requires a ${reason} in addition to grades.`;
    rightWarnings.innerHTML += `<div class="warning-box warn">⚠ <strong>${reason} required.</strong> ${msg}</div>`;
  }
  rightWarnings.innerHTML += `<div class="warning-box warn">Admission cutoffs shift every year based on applicant volume. Treat the gap as directional, not a guarantee.</div>`;
  if (prog.url && appState.selectedProgramKey !== 'custom') {
    rightWarnings.innerHTML += `<div class="warning-box info"><a href="${prog.url}" target="_blank" rel="noopener" class="prog-link">View full program details on OUInfo ↗</a></div>`;
  }

  document.getElementById('results-panel').classList.add('active');
}

function getGradeRangeLabel(target) {
  if (target >= 95) return '95–100%';
  if (target >= 90) return '90–95%';
  if (target >= 85) return '85–90%';
  if (target >= 80) return '80–85%';
  if (target >= 75) return '75–80%';
  return 'Below 75%';
}

function renderTop6Breakdown(data, prog) {
  const container = document.getElementById('top6-breakdown');
  if (!container) return;
  container.innerHTML = '';

  if (data.top6Courses.length === 0) {
    container.innerHTML = '<p class="breakdown-empty">Enter grades and run analysis to see your Top 6.</p>';
    return;
  }

  const maxGrade = Math.max(...data.top6Courses.map(c => c.grade), 100);

  data.top6Courses.forEach((course, i) => {
    const row = document.createElement('div');
    row.className = `score-row ${course.isPrereq ? 'row-req' : 'row-filler'}`;
    const barPct = ((course.grade / maxGrade) * 100).toFixed(1);
    const barClass = course.isPrereq ? 'bar-req' : 'bar-filler';
    row.innerHTML = `
      <span class="score-rank">${i + 1}</span>
      <span class="score-code">
        ${course.code}
        ${course.isPrereq ? '<span class="score-tag">req</span>' : ''}
      </span>
      <div class="score-bar-track">
        <div class="score-bar-fill ${barClass}" data-pct="${barPct}"></div>
      </div>
      <span class="score-grade">${course.grade.toFixed(0)}%</span>
    `;
    container.appendChild(row);
  });

  if (data.excludedCourses.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'breakdown-divider';
    divider.innerText = 'Not in Top 6';
    container.appendChild(divider);

    data.excludedCourses.forEach(course => {
      const row = document.createElement('div');
      row.className = 'score-row row-excluded';
      const barPct = ((course.grade / maxGrade) * 100).toFixed(1);
      row.innerHTML = `
        <span class="score-rank">—</span>
        <span class="score-code">${course.code}</span>
        <div class="score-bar-track">
          <div class="score-bar-fill bar-excluded" data-pct="${barPct}"></div>
        </div>
        <span class="score-grade">${course.grade.toFixed(0)}%</span>
      `;
      container.appendChild(row);
    });
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.score-bar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    });
  });
}