// Supabase Initialization
if (window.supabase && window.ENV?.SUPABASE_URL && window.ENV?.SUPABASE_ANON_KEY) {
  window.sb = window.supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY
  );
} else {
  console.warn("Supabase config missing. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
}

// Authentication Check
document.addEventListener("DOMContentLoaded", async () => {
  if (!window.sb) {
    window.location.replace("/login.html");
    return;
  }

  const supabase = window.sb;
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.replace("/login.html");
    return;
  }

  const email = session.user.email;

  // Check VIP first
  const { data: vip } = await supabase
    .from("vip_user")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (vip) return;

  // Check normal user
  if (!session) {
    window.location.replace("/login.html");
    return;
  }
});

// Main Application Logic
function getMonitoringHeaders() {
  const email = localStorage.getItem("user_email") || "";
  return email ? { "X-User-Email": email } : {};
}

// State
let allSubjects = []; 
let selectedSubjects = []; 
let filteredSubjects = [];
let staffBySubject = new Map(); // subject code -> {subject info, staff: [{name, count, order}]}
let dragItem = null;
let isDragging = false;
let staffStrictness = "flexible"; // Default: flexible mode for staff
let constraintsStrictness = "flexible"; // Default: strict mode for constraints

// DOM Elements
const page1 = document.getElementById('page1');
const page2 = document.getElementById('page2');
const step1Circle = document.getElementById('step1Circle');
const step2Circle = document.getElementById('step2Circle');
const subjectSearch = document.getElementById('subjectSearch');
let allSubjectsList = document.getElementById('allSubjectsList');
let selectedSubjectsList = document.getElementById('selectedSubjectsList');
const selectedCount = document.getElementById('selectedCount');
const selectedSubjectsSummary = document.getElementById('selectedSubjectsSummary');
const nextToPage2Btn = document.getElementById('nextToPage2');
const backToPage1Btn = document.getElementById('backToPage1');
const backToSubjectsBtn = document.getElementById('backToSubjects');
const generateBtn = document.getElementById('generateBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const staffColumnsContainer = document.getElementById('staffColumnsContainer');
const clearStaffBtn = document.getElementById('clearStaffBtn');
const staffStrictnessToggle = document.getElementById('staffStrictnessToggle');
const staffStrictnessStatus = document.getElementById('staffStrictnessStatus');
const constraintsStrictnessToggle = document.getElementById('constraintsStrictnessToggle');
const constraintsStrictnessStatus = document.getElementById('constraintsStrictnessStatus');

// Staff strictness toggle handler
function updateStaffStrictness() {
  staffStrictness = staffStrictnessToggle.checked ? "strict" : "flexible";
  staffStrictnessStatus.textContent = staffStrictness.toUpperCase();
  staffStrictnessStatus.className = `staff-strictness-status ${staffStrictness}`;
  
  // Update status message
  if (staffStrictness === "strict") {
    statusDiv.textContent = 'Staff STRICT mode: Only preferred staff will be used';
    statusDiv.className = 'status warning';
  } else {
    statusDiv.textContent = 'Staff FLEXIBLE mode: Both preferred and leftover staff considered';
    statusDiv.className = 'status success';
  }
  
  setTimeout(() => {
    if (!statusDiv.className.includes('loading')) {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }
  }, 2000);
}

// Constraints strictness toggle handler
function updateConstraintsStrictness() {
  constraintsStrictness = constraintsStrictnessToggle.checked ? "strict" : "flexible";
  constraintsStrictnessStatus.textContent = constraintsStrictness.toUpperCase();
  constraintsStrictnessStatus.className = `constraints-toggle-status ${constraintsStrictness}`;
  
  // Update status message
  if (constraintsStrictness === "strict") {
    statusDiv.textContent = 'Constraints STRICT mode: All constraints are hard rules';
    statusDiv.className = 'status warning';
  } else {
    statusDiv.textContent = 'Constraints FLEXIBLE mode: Constraints are preferences with priority';
    statusDiv.className = 'status success';
  }
  
  setTimeout(() => {
    if (!statusDiv.className.includes('loading')) {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }
  }, 2000);
}

// Priority Selection
function selectPriority(mode) {
  // Update radio button
  const radio = document.getElementById(`priority_${mode}`);
  if (radio) radio.checked = true;
  
  // Update UI styling
  document.querySelectorAll('.priority-option').forEach(option => {
    option.classList.remove('selected');
  });
  
  const selectedOption = document.querySelector(`.priority-option[onclick="selectPriority('${mode}')"]`);
  if (selectedOption) selectedOption.classList.add('selected');
  
  // Update status message
  if (mode === 'staff') {
    statusDiv.textContent = 'Staff First mode selected';
  } else {
    statusDiv.textContent = 'Constraints First mode selected';
  }
  statusDiv.className = 'status';
  
  setTimeout(() => {
    statusDiv.textContent = '';
  }, 2000);
}

// Subject Loading
async function loadSubjects() {
  try {
    statusDiv.textContent = 'Loading subjects...'; statusDiv.className = 'status loading';
    const response = await fetch('/subjects', {
      headers: getMonitoringHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const subjects = await response.json();
    allSubjects = subjects.filter(s => s.code !== 'ANYTHING');
    renderSubjectLists();
    statusDiv.textContent = `Loaded ${allSubjects.length} subjects`; statusDiv.className = 'status success';
    setTimeout(()=>{ statusDiv.textContent=''; statusDiv.className='status'; }, 3000);
  } catch (error) {
    console.error('Failed to load subjects:', error);
    statusDiv.textContent = 'Failed to load subjects. Is the backend running?'; statusDiv.className = 'status error';
    allSubjectsList.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><p>Failed to load subjects. Please check your connection.</p></div>`;
  }
}

function renderSubjectLists() {
  const searchTerm = subjectSearch.value.toLowerCase();
  filteredSubjects = allSubjects.filter(subject => {
    const matchesSearch = !searchTerm || subject.code.toLowerCase().includes(searchTerm) || subject.name.toLowerCase().includes(searchTerm);
    const isSelected = selectedSubjects.some(s => s.code === subject.code);
    return matchesSearch && !isSelected;
  });

  if (filteredSubjects.length === 0) {
    allSubjectsList.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>No subjects found. Try a different search term.</p></div>`;
  } else {
    allSubjectsList.innerHTML = filteredSubjects.map(subject => `
      <div class="subject-item" data-code="${subject.code}">
        <div class="subject-info"><div class="subject-code">${subject.code}</div><div class="subject-name">${subject.name}</div></div>
        <div class="subject-sections">${subject.sections} sections</div>
      </div>
    `).join('');
  }

  if (selectedSubjects.length === 0) {
    selectedSubjectsList.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><p>No subjects selected yet. Click on subjects from the left list to add them.</p></div>`;
  } else {
    selectedSubjectsList.innerHTML = selectedSubjects.map(subject => `
      <div class="selected-subject-item">
        <div class="subject-details"><strong>${subject.code}</strong><div style="font-size:0.9rem;color:var(--text-secondary);">${subject.name}</div></div>
        <button class="remove-subject" data-code="${subject.code}">Remove</button>
      </div>
    `).join('');
  }

  selectedCount.textContent = `(${selectedSubjects.length})`;
  updateSelectedSummary();
  
  // Load staff when subjects change
  if (selectedSubjects.length > 0) {
    loadStaffFromSubjects();
  } else {
    staffColumnsContainer.innerHTML = '<div class="empty-selection" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);border:2px dashed var(--border);border-radius:10px;">Select subjects first to load staff lists</div>';
  }
}

// Staff Preference Logic
async function loadStaffFromSubjects() {
  staffColumnsContainer.innerHTML = '<div class="empty-selection" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);">Loading staff from selected subjects...</div>';
  
  // Clear existing data
  staffBySubject.clear();
  
  // Load staff for each subject
  for (const subject of selectedSubjects) {
    try {
      const res = await fetch('/staff/' + encodeURIComponent(subject.code), {
        headers: getMonitoringHeaders()
      });
      if (!res.ok) continue;
      const staffArray = await res.json();
      const staffList = [];
      const staffCounts = new Map();
      
      for (const staffName of staffArray) {
        if (staffName && staffName.trim()) {
          const name = staffName.trim();
          staffCounts.set(name, (staffCounts.get(name) || 0) + 1);
        }
      }
      
      // Convert to array of staff with counts and initialize order as 0 (not selected)
      for (const [name, count] of staffCounts) {
        staffList.push({ 
          name, 
          count,
          order: 0 // 0 means not selected/ordered
        });
      }
      
      if (staffList.length > 0) {
        staffList.sort((a, b) => a.name.localeCompare(b.name));
        staffBySubject.set(subject.code, {
          code: subject.code,
          name: subject.name,
          staff: staffList
        });
      }
    } catch (e) {
      console.error('Error loading staff for', subject.code, e);
    }
  }
  
  renderStaffColumns();
}

function renderStaffColumns() {
  if (staffBySubject.size === 0) {
    staffColumnsContainer.innerHTML = '<div class="empty-selection" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-secondary);border:2px dashed var(--border);border-radius:10px;">No staff found for selected subjects</div>';
    return;
  }
  
  const columnsHTML = Array.from(staffBySubject.values()).map(subjectData => {
    // Get selected staff for this subject (order > 0)
    const selectedStaff = subjectData.staff.filter(s => s.order > 0);
    const unselectedStaff = subjectData.staff.filter(s => s.order === 0);
    
    // Sort selected staff by order
    selectedStaff.sort((a, b) => a.order - b.order);
    
    // Combine: selected first, then unselected
    const allStaffForSubject = [...selectedStaff, ...unselectedStaff];
    
    const staffHTML = allStaffForSubject.map(staff => {
      const isSelected = staff.order > 0;
      const orderBadge = isSelected ? `<div class="staff-order-badge">${staff.order}</div>` : '';
      
      return `
        <div class="staff-chip ${isSelected ? 'selected' : ''}" 
             data-subject="${subjectData.code}"
             data-name="${staff.name.replace(/"/g, '&quot;')}"
             draggable="true">
          ${orderBadge}
          <div class="drag-indicator">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </div>
          <div class="staff-info">
            <div class="staff-name">${staff.name}</div>
          </div>
          <div class="staff-count">${staff.count}</div>
          <button class="staff-remove" onclick="removeStaff('${staff.name.replace(/'/g, "\\'")}', '${subjectData.code}')">
            ×
          </button>
        </div>
      `;
    }).join('');
    
    const selectedCount = selectedStaff.length;
    
    return `
      <div class="staff-column">
        <div class="staff-column-header">
          <div class="staff-column-title">
            <span class="staff-subject-code">${subjectData.code}</span>
            <span>${subjectData.name}</span>
          </div>
          <div class="staff-column-count">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5 1.197v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
            <span>${selectedCount} selected</span>
          </div>
        </div>
        <div class="staff-column-content">
          <div class="staff-chips-container" id="staff-list-${subjectData.code}">
            ${staffHTML || '<div class="empty-column">No staff available for this subject</div>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  staffColumnsContainer.innerHTML = columnsHTML;
  
  // Add event listeners for drag and drop
  setupDragAndDrop();
}

function setupDragAndDrop() {
  const chips = document.querySelectorAll('.staff-chip');
  
  chips.forEach(chip => {
    chip.addEventListener('dragstart', handleDragStart);
    chip.addEventListener('dragover', handleDragOver);
    chip.addEventListener('drop', handleDrop);
    chip.addEventListener('dragend', handleDragEnd);
    
    // Also allow click to select/deselect
    chip.addEventListener('click', (e) => {
      // Don't trigger if clicking on remove button or if dragging
      if (e.target.closest('.staff-remove') || isDragging) return;
      
      const staffName = chip.dataset.name;
      const subjectCode = chip.dataset.subject;
      
      // Find the subject
      const subjectData = staffBySubject.get(subjectCode);
      if (!subjectData) return;
      
      // Find the staff in this subject
      const staff = subjectData.staff.find(s => s.name === staffName);
      if (!staff) return;
      
      if (staff.order === 0) {
        // Select this staff - give it the next available order in this subject
        const maxOrder = subjectData.staff.reduce((max, s) => Math.max(max, s.order), 0);
        staff.order = maxOrder + 1;
      } else {
        // Deselect this staff
        staff.order = 0;
        // Update order numbers for remaining selected staff in this subject
        updateOrderNumbersForSubject(subjectCode);
      }
      
      renderStaffColumns();
    });
  });
}

function handleDragStart(e) {
  isDragging = true;
  dragItem = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  if (dragItem !== this) {
    const dragSubject = dragItem.dataset.subject;
    const dropSubject = this.dataset.subject;
    
    // Only allow dragging within the same subject column
    if (dragSubject !== dropSubject) return false;
    
    const subjectCode = dragSubject;
    const subjectData = staffBySubject.get(subjectCode);
    if (!subjectData) return false;
    
    const dragName = dragItem.dataset.name;
    const dropName = this.dataset.name;
    
    // Find the staff objects
    const dragStaff = subjectData.staff.find(s => s.name === dragName);
    const dropStaff = subjectData.staff.find(s => s.name === dropName);
    
    if (!dragStaff || !dropStaff) return false;
    
    // Only allow dragging if BOTH are selected (order > 0)
    if (dragStaff.order === 0 || dropStaff.order === 0) return false;
    
    // Swap orders
    const tempOrder = dragStaff.order;
    dragStaff.order = dropStaff.order;
    dropStaff.order = tempOrder;
    
    renderStaffColumns();
  }
  
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  dragItem = null;
  isDragging = false;
}

function updateOrderNumbersForSubject(subjectCode) {
  const subjectData = staffBySubject.get(subjectCode);
  if (!subjectData) return;
  
  // Get selected staff for this subject
  const selectedStaff = subjectData.staff.filter(s => s.order > 0);
  
  // Sort by current order
  selectedStaff.sort((a, b) => a.order - b.order);
  
  // Reassign order numbers sequentially
  selectedStaff.forEach((staff, index) => {
    staff.order = index + 1;
  });
}

function removeStaff(name, subjectCode) {
  const subjectData = staffBySubject.get(subjectCode);
  if (!subjectData) return;
  
  const staff = subjectData.staff.find(s => s.name === name);
  if (staff) {
    staff.order = 0;
    updateOrderNumbersForSubject(subjectCode);
    renderStaffColumns();
  }
}

// Summary and Event Attachments
function updateSelectedSummary() {
  selectedSubjectsSummary.innerHTML = selectedSubjects.map(subject => `
    <div class="subject-card">
      ${subject.code}
      <button class="remove-btn" data-code="${subject.code}">×</button>
    </div>
  `).join('');
}

function attachSubjectEventListeners() {
  // clone/replace to remove old listeners
  if (allSubjectsList && allSubjectsList.parentNode) {
    const newAll = allSubjectsList.cloneNode(true);
    allSubjectsList.parentNode.replaceChild(newAll, allSubjectsList);
    allSubjectsList = document.getElementById('allSubjectsList'); // reassign
  }

  if (selectedSubjectsList && selectedSubjectsList.parentNode) {
    const newSel = selectedSubjectsList.cloneNode(true);
    selectedSubjectsList.parentNode.replaceChild(newSel, selectedSubjectsList);
    selectedSubjectsList = document.getElementById('selectedSubjectsList'); // reassign
  }

  // use event delegation on the up-to-date variables
  allSubjectsList.addEventListener('click', function(e) {
    const item = e.target.closest('.subject-item');
    if (item && !e.target.closest('.remove-subject')) {
      const code = item.dataset.code;
      const subject = allSubjects.find(s => s.code === code);
      if (subject && !selectedSubjects.some(s => s.code === code)) {
        selectedSubjects.push(subject);
        renderSubjectLists();
      }
    }
  });

  selectedSubjectsList.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-subject')) {
      const code = e.target.dataset.code;
      selectedSubjects = selectedSubjects.filter(s => s.code !== code);
      renderSubjectLists();
    }
  });
}

// Navigation
nextToPage2Btn.addEventListener('click', () => {
  if (selectedSubjects.length === 0) { statusDiv.textContent = 'Please select at least one subject to continue.'; statusDiv.className = 'status error'; setTimeout(()=>{ statusDiv.textContent=''; statusDiv.className='status'; },3000); return; }
  page1.classList.remove('active'); page1.style.display='none'; page2.classList.add('active'); page2.style.display='block'; step1Circle.classList.remove('active'); step1Circle.classList.add('completed'); step2Circle.classList.add('active'); window.scrollTo({ top:0, behavior:'smooth' });
});

backToPage1Btn.addEventListener('click', () => { page2.classList.remove('active'); page2.style.display='none'; page1.classList.add('active'); page1.style.display='block'; step2Circle.classList.remove('active'); step1Circle.classList.add('active'); step1Circle.classList.remove('completed'); window.scrollTo({ top:0, behavior:'smooth' }); });
backToSubjectsBtn.addEventListener('click', () => { page2.classList.remove('active'); page2.style.display='none'; page1.classList.add('active'); page1.style.display='block'; step2Circle.classList.remove('active'); step1Circle.classList.add('active'); window.scrollTo({ top:0, behavior:'smooth' }); });

subjectSearch.addEventListener('input', () => { renderSubjectLists(); });

clearStaffBtn.addEventListener('click', () => {
  // Clear all selections from all subjects
  staffBySubject.forEach(subjectData => {
    subjectData.staff.forEach(staff => {
      staff.order = 0;
    });
  });
  renderStaffColumns();
});

// Generation
async function generateTimetables(page = 1) {
  if (selectedSubjects.length === 0) { 
    statusDiv.textContent = 'Please select at least one subject first.'; 
    statusDiv.className = 'status error'; 
    return; 
  }
  
  // Build preferred staff list in JSON format
  let staffPreferences = [];
  
  staffBySubject.forEach((subjectData, subjectCode) => {
    // Get selected staff for this subject, sorted by order
    const selectedStaff = subjectData.staff
      .filter(staff => staff.order > 0)
      .sort((a, b) => a.order - b.order)
      .map(staff => staff.name);
    
    if (selectedStaff.length > 0) {
      staffPreferences.push({
        subject: subjectCode,
        staff: selectedStaff
      });
    }
  });
  
  // Get priority mode
  const priorityMode = document.querySelector('input[name="priority_mode"]:checked').value;
  
  // Get staff strictness from toggle
  const staffStrictnessVal = staffStrictnessToggle.checked ? "strict" : "flexible";
  
  // Get constraints strictness from toggle
  const constraintsStrictnessVal = constraintsStrictnessToggle.checked ? "strict" : "flexible";
  
  const constraints = {
    selected_subjects: selectedSubjects.map(s => s.code).join(','),
    allow_morning: document.getElementById('allow_morning').value,
    allow_evening: document.getElementById('allow_evening').value,
    allow_sat: document.getElementById('allow_sat').value,
    max_classes: document.getElementById('max_classes').value,
    need_free_day: document.getElementById('need_free_day').value,
    free_day: document.getElementById('free_day').value,
    limit: '1000',
    page: page.toString(),
    preferred_staff: JSON.stringify(staffPreferences),  // Send as JSON string
    priority_mode: priorityMode,  // Add priority mode
    staff_strictness: staffStrictnessVal,  // Add staff strictness
    constraints_strictness: constraintsStrictnessVal  // NEW: Add constraints strictness
  };

  generateBtn.disabled = true; 
  generateBtn.innerHTML = '<div class="spinner"></div> Generating...'; 
  statusDiv.textContent = page===1 ? 'Generating timetables...' : `Loading page ${page}...`; 
  statusDiv.className='status loading'; 
  
  if (page===1) {
    let modeText = priorityMode === 'staff' ? 'Staff First' : 'Constraints First';
    let staffStrictnessText = staffStrictnessVal === 'strict' ? 'STRICT' : 'FLEXIBLE';
    let constraintsStrictnessText = constraintsStrictnessVal === 'strict' ? 'STRICT' : 'FLEXIBLE';
    resultDiv.innerHTML = `
      <div style="text-align:center;padding:40px;background:#0f172a;border-radius:12px;border:1px solid #1f2937;">
        <h3 style="color:#e5e7eb;"> Running Search</h3>
        <p style="color:#9ca3af;">
          Exploring ALL possible combinations with ${modeText} priority...
          <br><strong>Staff:</strong> ${staffStrictnessText} mode
          <br><strong>Constraints:</strong> ${constraintsStrictnessText} mode
          ${staffPreferences.length > 0 ? `<br><small>Staff filtering active for ${staffPreferences.length} subjects</small>` : ''}
        </p>
      </div>
    `;
  }

  try {
    const formData = new FormData(); 
    Object.entries(constraints).forEach(([k,v]) => formData.append(k,v));
    const response = await fetch('/generate', { 
      method:'POST', 
      headers: getMonitoringHeaders(),
      body: new URLSearchParams(Array.from(formData.entries())) 
    });
    
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const html = await response.text(); 
    resultDiv.innerHTML = html; 
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    if (html.includes('No Valid Timetables Found')) { 
      statusDiv.textContent = 'No valid timetables found with current constraints.'; 
      statusDiv.className='status warning'; 
    } else { 
      statusDiv.textContent = page===1 ? 'Timetables generated successfully!' : `Loaded page ${page}`; 
      statusDiv.className='status success'; 
    }
  } catch (error) {
    console.error('Generation error:', error);
    resultDiv.innerHTML = `
      <div style="background:#0f172a;border-radius:12px;border:1px solid #ef4444;padding:20px;">
        <h4 style="color:#ef4444;">Error Generating Timetables</h4>
        <p style="color:#9ca3af;">Something went wrong:</p>
        <pre style="background:#020617;padding:10px;border-radius:6px;color:#ef4444;overflow:auto;">${error.message}</pre>
        <p style="color:#9ca3af;">Check backend server and output.txt file.</p>
      </div>
    `;
    statusDiv.textContent = 'Error generating timetables'; 
    statusDiv.className='status error';
  } finally {
    generateBtn.disabled = false; 
    generateBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      Generate Timetables
    `;
    if (statusDiv.className.includes('success')) { 
      setTimeout(()=>{ 
        if (!statusDiv.className.includes('loading')) { 
          statusDiv.textContent=''; 
          statusDiv.className='status'; 
        } 
      },5000); 
    }
  }
}

function loadPage(page) { generateTimetables(page); }

// Initialization and Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Setup Strictness initial states
  updateStaffStrictness();
  updateConstraintsStrictness();

  loadSubjects();
  attachSubjectEventListeners();
  generateBtn.addEventListener('click', () => generateTimetables(1));
  subjectSearch.addEventListener('keydown', (e) => { if (e.key==='Enter') renderSubjectLists(); });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key==='Enter' && page2.classList.contains('active')) { e.preventDefault(); if (!generateBtn.disabled) generateTimetables(1); }
    if (e.ctrlKey && e.key==='ArrowRight' && page1.classList.contains('active')) { e.preventDefault(); nextToPage2Btn.click(); }
    if (e.ctrlKey && e.key==='ArrowLeft' && page2.classList.contains('active')) { e.preventDefault(); backToPage1Btn.click(); }
  });

  // Logout Logic
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (!window.sb) {
      alert("System not ready. Please refresh and try again.");
      return;
    }

    const supabase = window.sb;
    const email = localStorage.getItem("user_email");
    
    if (email) {
      try {
        const { error } = await supabase.rpc("release_slot", {
          p_email: email
        });
        
        if (error) {
          console.error("release_slot failed:", error);
          await supabase.from("normal_user").delete().eq("email", email);
        } else {
          console.log("release_slot success for:", email);
        }
      } catch (e) {
        console.error("Delete error:", e);
      }
    }

    await supabase.auth.signOut();
    localStorage.clear();
    window.location.replace("/login.html");
  });

  // Session Expiry Monitoring
  (async () => {
    if (!window.supabase || !window.ENV) return;

    const supabase = window.sb;
    const expiresAt = parseInt(localStorage.getItem("session_expires_at"));
    const email = localStorage.getItem("user_email");

    if (!expiresAt || !email) return;

    async function checkExpiry() {
      const left = Math.ceil((expiresAt - Date.now()) / 1000);
      if (left <= 0) {
        try {
          await supabase.from("normal_user").delete().eq("email", email);
        } catch (e) {}
        await supabase.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("/login.html");
      }
    }

    checkExpiry();
    setInterval(checkExpiry, 1000);
  })();

  // Global Event Listeners
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("remove-btn")) return;
    const code = e.target.dataset.code;
    selectedSubjects = selectedSubjects.filter(s => s.code !== code);
    renderSubjectLists();
  });
});

// Global Window Exports
window.loadPage = loadPage;
window.removeStaff = removeStaff;
window.selectPriority = selectPriority;
