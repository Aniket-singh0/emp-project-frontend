/*
  EMS Web UI (Vanilla JS)
  - Stores JWT in localStorage
  - Calls Spring Boot REST endpoints under /api/**
*/

const API = {
	login: '/api/auth/login',
	register: '/api/auth/register',
	employees: '/api/employees',
	attendanceMark: '/api/attendance/mark',
	attendanceMonthly: '/api/attendance/monthly',
	leavesApply: '/api/leaves/apply',
	leavesDecide: '/api/leaves/decide',
	leaves: '/api/leaves',
	salariesSet: '/api/salaries/set',
	salariesForEmployee: (id) => `/api/salaries/employee/${id}`
};

const store = {
	get token() { return localStorage.getItem('ems_token') || '' },
	set token(v) { localStorage.setItem('ems_token', v || '') },
	get username() { return localStorage.getItem('ems_username') || '' },
	set username(v) { localStorage.setItem('ems_username', v || '') },
	get role() { return localStorage.getItem('ems_role') || '' },
	set role(v) { localStorage.setItem('ems_role', v || '') },
	clear() {
		localStorage.removeItem('ems_token');
		localStorage.removeItem('ems_username');
		localStorage.removeItem('ems_role');
	}
};

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
// -------- Utils --------
// -------- Utils --------
function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, c => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[c]));
}
function statusBadge(status) {
	const map = {
		APPROVED: 'green',
		REJECTED: 'red',
		PENDING: 'orange',
		ACTIVE: 'green',
		INACTIVE: 'gray'
	};
	return `<span class="badge ${map[status] || ''}">${status}</span>`;
}


function toast(msg, type = '') {
	const el = qs('#toast');
	if (!el) return;
	el.className = 'toast ' + (type || '');
	el.textContent = msg;
}

async function apiFetch(url, opts = {}) {
	const headers = opts.headers ? { ...opts.headers } : {};
	if (store.token) headers['Authorization'] = 'Bearer ' + store.token;
	if (opts.json) {
		headers['Content-Type'] = 'application/json';
		opts.body = JSON.stringify(opts.json);
	}
	const res = await fetch(url, { ...opts, headers });

	let data = null;
	const text = await res.text();
	try { data = text ? JSON.parse(text) : null; } catch { data = text; }

	if (!res.ok) {
		const msg = (data && data.message) ? data.message : (typeof data === 'string' ? data : `HTTP ${res.status}`);
		throw new Error(msg);
	}
	return data;
}

// ---------- Login page ----------
async function handleLogin() {
	const u = qs('#username').value.trim();
	const p = qs('#password').value;
	if (!u || !p) return toast('Username & password required', 'err');

	qs('#btnLogin').disabled = true;
	toast('Logging in...');
	try {
		const data = await apiFetch(API.login, { method: 'POST', json: { username: u, password: p } });
		store.token = data.token;
		store.username = data.username;
		store.role = data.role;
		location.href = '/app/dashboard.html';
	} catch (e) {
		toast(e.message || 'Login failed', 'err');
	} finally {
		qs('#btnLogin').disabled = false;
	}
}

async function handleRegister() {
	const u = qs('#r_username').value.trim();
	const p = qs('#r_password').value;
	const role = qs('#r_role').value;
	if (!u || !p) return toast('Username & password required', 'err');

	qs('#btnRegister').disabled = true;
	toast('Registering...');
	try {
		const data = await apiFetch(API.register, { method: 'POST', json: { username: u, password: p, role } });
		toast(typeof data === 'string' ? data : 'Registered', 'ok');
		qs('#r_password').value = '';
	} catch (e) {
		toast(e.message || 'Register failed', 'err');
	} finally {
		qs('#btnRegister').disabled = false;
	}
}

// ---------- Dashboard ----------
function requireAuth() {
	if (!store.token) {
		location.href = '/app/login.html';
		return false;
	}
	return true;
}

function canHR() {
	return (store.role || '').includes('ADMIN') || (store.role || '').includes('HR');
}

function setHeader() {
	const userPill = qs('#userPill');
	if (userPill) userPill.textContent = `${store.username || 'User'} • ${store.role || ''}`;
}

function wireTabs() {
	const tabs = qsa('[data-tab]');
	const panes = qsa('[data-pane]');
	function show(name) {
		tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
		panes.forEach(p => p.style.display = (p.dataset.pane === name) ? 'block' : 'none');
	}
	tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
	const firstVisible = tabs.find(t => t.style.display !== 'none');
	show(firstVisible?.dataset.tab || tabs[0]?.dataset.tab || 'leaves');
}

function wireLogout() {
	const b = qs('#btnLogout');
	if (!b) return;
	b.addEventListener('click', () => { store.clear(); location.href = '/app/login.html'; });
}

// -------- Employees --------
let empPage = 0;
let empSize = 10;

async function loadEmployees() {
	const search = qs('#emp_search')?.value?.trim() || '';
	const url = new URL(API.employees, location.origin);
	if (search) url.searchParams.set('search', search);
	url.searchParams.set('page', String(empPage));
	url.searchParams.set('size', String(empSize));

	const page = await apiFetch(url.pathname + url.search, { method: 'GET' });
	if(!page || !page.content){
	  toast('Employee data load failed (auth / API issue)', 'err');
	  return;
	}

	const rows = page.content;

	const tbody = qs('#emp_tbody');
	tbody.innerHTML = '';

	rows.forEach(e => {
	  const tr = document.createElement('tr');
	  tr.innerHTML = `
	    <td>${e.id ?? ''}</td>
	    <td>${esc(e.fullName ?? '')}</td>
	    <td>${esc(e.department || '')}</td>
	    <td>${esc(e.email || '')}</td>
	    <td>${esc(e.phone || '')}</td>
	    <td>${esc(e.joinDate || '')}</td>
	    <td>
	      <button class="btn" data-act="edit" data-id="${e.id}">Edit</button>
	      <button class="btn danger" data-act="del" data-id="${e.id}">Deactivate</button>
	      <button class="btn danger" data-act="purge" data-id="${e.id}" data-hr-only>Purge</button>
	    </td>
	  `;
	  tbody.appendChild(tr);
	});

	const pnum = (page.number ?? 0) + 1;
	const totalPages = page.totalPages || 1;
	const total = page.totalElements ?? rows.length;
	qs('#emp_page').textContent = `Page ${pnum} of ${totalPages} • Total ${total}`;

	tbody.querySelectorAll('button[data-act="del"]').forEach(btn =>
	  btn.addEventListener('click', () =>
	    deactivateEmployee(Number(btn.dataset.id))
	  )
	);

	tbody.querySelectorAll('button[data-act="edit"]').forEach(btn =>
	  btn.addEventListener('click', () =>
	    fillEmpForm(Number(btn.dataset.id), rows)
	  )
	);

	tbody.querySelectorAll('button[data-act="purge"]').forEach(btn =>
	  btn.addEventListener('click', () => purgeEmployee(Number(btn.dataset.id)))
	);

}

function fillEmpForm(id, rows){
  const e = rows.find(x => x.id === id);
  if(!e) return toast('Employee not found', 'err');

  qs('#emp_id').value   = e.id || '';
  qs('#emp_name').value = e.fullName || '';
  qs('#emp_dept').value = e.department || '';
  qs('#emp_email').value= e.email || '';
  qs('#emp_phone').value= e.phone || '';
  qs('#emp_join').value = e.joinDate || '';

  toast('Employee loaded for update', 'ok');
}


function clearEmpForm(){
  ['#emp_id','#emp_name','#emp_dept','#emp_email','#emp_phone','#emp_join']
    .forEach(s => qs(s).value = '');
}

async function saveEmployee(){
  const id = qs('#emp_id').value.trim();

  const payload = {
    fullName: qs('#emp_name').value.trim(),
    department: qs('#emp_dept').value.trim(),
    email: qs('#emp_email').value.trim(),
    phone: qs('#emp_phone').value.trim(),
    joinDate: qs('#emp_join').value
  };

  if(!payload.fullName) return toast('Name required', 'err');
  if(!payload.email) return toast('Email required', 'err');

  try{
    if(id){
      // 🔥 UPDATE
      await apiFetch(`/api/employees/${id}`, { method:'PUT', json: payload });
      toast('Employee updated', 'ok');
    } else {
      // 🔥 CREATE
      await apiFetch('/api/employees', { method:'POST', json: payload });
      toast('Employee created', 'ok');
    }

    clearEmpForm();
    await loadEmployees();
  } catch(e){
    toast(e.message, 'err');
  }
}

async function deactivateEmployee(id){
  if(!confirm(`Deactivate employee ${id}?`)) return;

  try{
    await apiFetch(`/api/employees/${id}`, { method:'DELETE' });
    toast('Employee deactivated', 'ok');
    await loadEmployees();
  } catch(e){
    toast(e.message, 'err');
  }
}

async function purgeEmployee(id){
  if(!confirm(`⚠️ Permanently delete employee ${id}? This cannot be undone!`)) return;

  try{
    await apiFetch(`/api/employees/purge/${id}`, { method:'DELETE' });
    toast('Employee permanently deleted', 'ok');
    await loadEmployees();
  } catch(e){
    toast(e.message, 'err');
  }
}


// -------- Attendance --------
async function markAttendance() {
	const employeeId = qs('#att_empId').value.trim();
	const date = qs('#att_date').value;
	const status = qs('#att_status').value;
	if (!employeeId || !date) return toast('EmployeeId & Date required', 'err');

	const url = new URL(API.attendanceMark, location.origin);
	url.searchParams.set('employeeId', employeeId);
	url.searchParams.set('date', date);
	url.searchParams.set('status', status);

	try {
		await apiFetch(url.pathname + url.search, { method: 'POST' });
		toast('Attendance marked', 'ok');
	} catch (e) {
		toast(e.message, 'err');
	}
}

async function loadMonthlyAttendance() {
	const employeeId = qs('#att_rep_empId').value.trim();
	const from = qs('#att_from').value;
	const to = qs('#att_to').value;
	if (!employeeId || !from || !to) return toast('EmployeeId, From, To required', 'err');

	const url = new URL(API.attendanceMonthly, location.origin);
	url.searchParams.set('employeeId', employeeId);
	url.searchParams.set('from', from);
	url.searchParams.set('to', to);

	try {
		const list = await apiFetch(url.pathname + url.search, { method: 'GET' });
		const tbody = qs('#att_tbody');
		tbody.innerHTML = '';
		(list || []).forEach(a => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
			  <td>${a.id ?? ''}</td>
			  <td>${esc(a.attDate || a.date || '')}</td>
			  <td>${esc(a.status || a.attStatus || '')}</td>
			  <td>${a.employee?.id ?? a.employeeId ?? ''}</td>
			`;

			tbody.appendChild(tr);
		});
		toast('Attendance loaded', 'ok');
	} catch (e) {
		toast(e.message, 'err');
	}
}

// -------- Leaves --------
async function applyLeave() {
	const employeeId = qs('#lv_empId').value.trim();
	const from = qs('#lv_from').value;
	const to = qs('#lv_to').value;
	const reason = qs('#lv_reason').value.trim();
	if (!employeeId || !from || !to) return toast('EmployeeId, From, To required', 'err');

	const url = new URL(API.leavesApply, location.origin);
	url.searchParams.set('employeeId', employeeId);
	url.searchParams.set('from', from);
	url.searchParams.set('to', to);
	if (reason) url.searchParams.set('reason', reason);

	try {
		await apiFetch(url.pathname + url.search, { method: 'POST' });
		toast('Leave applied', 'ok');
		await loadLeaves();
	} catch (e) {
		toast(e.message, 'err');
	}
}

async function decideLeave() {
	const leaveId = qs('#lv_id').value.trim();
	const status = qs('#lv_status').value;
	if (!leaveId) return toast('LeaveId required', 'err');

	const url = new URL(API.leavesDecide, location.origin);
	url.searchParams.set('leaveId', leaveId);
	url.searchParams.set('status', status);

	try {
		await apiFetch(url.pathname + url.search, { method: 'POST' });
		toast('Leave updated', 'ok');
		await loadLeaves();
	} catch (e) {
		toast(e.message, 'err');
	}
}

async function loadLeaves() {
	try {
		const list = await apiFetch(API.leaves, { method: 'GET' });
		const tbody = qs('#lv_tbody');
		tbody.innerHTML = '';
		(list || []).forEach(l => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
	    <td>${l.id ?? ''}</td>
	    <td>${l.employee?.id ?? ''}</td>
	    <td>${esc(l.fromDate || '')}</td>
	    <td>${esc(l.toDate || '')}</td>
	    <td>${statusBadge(l.leaveStatus)}</td>
	    <td>${esc(l.reason || '')}</td>
	  `;

			tbody.appendChild(tr);
		});
	} catch (e) {
		toast(e.message, 'err');
	}
}

async function loadLeavesForEmployee() {
	const employeeId = qs('#lv_empId').value.trim();
	if (!employeeId) return toast('EmployeeId required', 'err');

	try {
		const list = await apiFetch(`/api/leaves/employee/${employeeId}`, { method: 'GET' });
		const tbody = qs('#lv_tbody');
		tbody.innerHTML = '';
		(list || []).forEach(l => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
        <td>${l.id ?? ''}</td>
        <td>${l.employee?.id ?? ''}</td>
        <td>${esc(l.fromDate || '')}</td>
        <td>${esc(l.toDate || '')}</td>
        <td>${esc(l.status || '')}</td>
        <td>${esc(l.reason || '')}</td>
      `;
			tbody.appendChild(tr);
		});
		toast('Leaves loaded (employee)', 'ok');
	} catch (e) {
		toast(e.message, 'err');
	}
}

// -------- Salaries --------

// ✅ Manual Set Salary (Monthly salary save)
async function setSalary() {
	const employeeId = qs('#sal_empId').value.trim();
	const monthYear = qs('#sal_month').value.trim();
	const basic = qs('#sal_basic').value.trim();
	const bonus = qs('#sal_bonus').value.trim();
	const deduction = qs('#sal_d').value.trim(); // ✅ correct id

	if (!employeeId || !monthYear || !basic) {
		return toast('EmployeeId, Month(YYYY-MM), Basic required', 'err');
	}

	const url = new URL(API.salariesSet, location.origin);
	url.searchParams.set('employeeId', employeeId);
	url.searchParams.set('monthYear', monthYear);
	url.searchParams.set('basic', basic);

	if (bonus) url.searchParams.set('bonus', bonus);
	if (deduction) url.searchParams.set('deduction', deduction);

	try {
		await apiFetch(url.pathname + url.search, { method: 'POST' });
		toast('Salary saved', 'ok');
		await loadSalary(); // auto refresh table
	} catch (e) {
		toast(e.message || 'Salary save failed', 'err');
	}
}

// ✅ Load salary list for one employee
async function loadSalary() {
	const employeeId = qs('#sal_empId').value.trim();
	if (!employeeId) return toast('EmployeeId required to load salary', 'err');

	try {
		const list = await apiFetch(API.salariesForEmployee(employeeId), { method: 'GET' });

		const tbody = qs('#sal_tbody');
		tbody.innerHTML = '';

		(list || []).forEach(s => {
			const tr = document.createElement('tr');
			tr.innerHTML = `
        <td>${s.id ?? ''}</td>
        <td>${s.employee?.id ?? ''}</td>
        <td>${esc(s.monthYear || '')}</td>
        <td>${esc(s.basic ?? '')}</td>
        <td>${esc(s.bonus ?? '')}</td>
        <td>${esc(s.deduction ?? '')}</td>
        <td>${esc(s.net ?? '')}</td>
      `;
			tbody.appendChild(tr);
		});

		toast('Salary loaded', 'ok');
	} catch (e) {
		toast(e.message || 'Salary load failed', 'err');
	}
}

// ✅ Auto Generate salary from Attendance (basic user input, net auto)
async function generateSalaryAuto() {
	const employeeId = qs('#sal_empId').value.trim();
	const monthYear = qs('#sal_month').value.trim();
	const basic = qs('#sal_basic').value.trim();
	const bonus = qs('#sal_bonus').value.trim();
	const deduction = qs('#sal_d').value.trim();

	if (!employeeId || !monthYear || !basic) {
		return toast('EmployeeId, Month & Basic required', 'err');
	}

	const url = new URL('/api/salaries/generate', location.origin);
	url.searchParams.set('employeeId', employeeId);
	url.searchParams.set('monthYear', monthYear);
	url.searchParams.set('basic', basic);

	if (bonus) url.searchParams.set('bonus', bonus);
	if (deduction) url.searchParams.set('deduction', deduction);

	try {
		await apiFetch(url.pathname + url.search, { method: 'POST' });
		toast('Salary generated successfully', 'ok');
		await loadSalary();
	} catch (e) {
		toast(e.message || 'Salary generation failed', 'err');
	}
}



// -------- Boot --------
document.addEventListener('DOMContentLoaded', () => {
	// Login
	if (qs('#btnLogin')) {
		qs('#btnLogin').addEventListener('click', handleLogin);
		qs('#password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
	}
	if (qs('#btnRegister')) {
		qs('#btnRegister').addEventListener('click', handleRegister);
	}

	// Dashboard
	if (qs('#dashboardRoot')) {
		if (!requireAuth()) return;

		setHeader();
		wireLogout();
		wireTabs();

		// Role-based UI hide
		if (!canHR()) {
			qsa('[data-hr-only]').forEach(x => x.style.display = 'none');
		}

		// Employees
		qs('#btnEmpSearch')?.addEventListener('click', () => { empPage = 0; loadEmployees(); });
		qs('#btnEmpPrev')?.addEventListener('click', () => { empPage = Math.max(0, empPage - 1); loadEmployees(); });
		qs('#btnEmpNext')?.addEventListener('click', () => { empPage = empPage + 1; loadEmployees(); });
		qs('#btnEmpSave')?.addEventListener('click', saveEmployee);
		qs('#btnEmpClear')?.addEventListener('click', clearEmpForm);

		// Attendance
		qs('#btnAttMark')?.addEventListener('click', markAttendance);
		qs('#btnAttReport')?.addEventListener('click', loadMonthlyAttendance);

		// Leaves
		qs('#btnLvApply')?.addEventListener('click', applyLeave);
		qs('#btnLvDecide')?.addEventListener('click', decideLeave);
		qs('#btnLvLoadAll')?.addEventListener('click', loadLeaves);
		qs('#btnLvLoadEmp')?.addEventListener('click', loadLeavesForEmployee);

		// ✅ Salary (IMPORTANT: only one listener for Auto button)
		qs('#btnSalSet')?.addEventListener('click', setSalary);
		qs('#btnSalLoad')?.addEventListener('click', loadSalary);
		qs('#btnSalAuto')?.addEventListener('click', generateSalaryAuto);

		// First loads
		loadEmployees().catch(e => toast(e.message, 'err'));
		loadLeaves().catch(() => { });
	}
});
