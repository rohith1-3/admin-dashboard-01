/*
  Scout Portal prototype
  - Dashboard (Scout Upcoming Events)
  - Events: create, approve, list, conflict warning
  - Registrations: register/unregister before close date
  - SMC/BOR: submit and list upcoming + historic
  - Adult Leaders: directory, roles, training
  - Admin: seed data, medical validity, training, approvals
  Data persists in localStorage. No backend.
*/

(function () {
  const STORAGE_KEY = 'scout-portal-data-v1';

  const state = load();
  ensureSeed();

  // Current user control
  const currentUserSelect = document.getElementById('currentUser');
  function getCurrentUserId() {
    return currentUserSelect.value || state.users[0].id;
  }

  function setCurrentUserOptions() {
    currentUserSelect.innerHTML = '';
    state.users.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role})`;
      currentUserSelect.appendChild(opt);
    });
    currentUserSelect.value = state.currentUserId || state.users[0].id;
  }

  currentUserSelect.addEventListener('change', () => {
    state.currentUserId = getCurrentUserId();
    save();
    renderSidebar();
    render();
  });

  // Storage helpers
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Models
  function ensureSeed() {
    if (!state.users) state.users = [];
    if (!state.events) state.events = [];
    if (!state.registrations) state.registrations = [];
    if (!state.smcbor) state.smcbor = [];
    if (!state.adultLeaderSignups) state.adultLeaderSignups = [];
    if (!state.currentUserId) state.currentUserId = null;

    if (state.users.length === 0) {
      const users = [
        { id: uid(), name: 'Alex Scout', email: 'alex@troop.org', role: 'scout', details: {}, medicalValidUntil: Gear.today(365), training: {} },
        { id: uid(), name: 'Jamie Scout', email: 'jamie@troop.org', role: 'scout', details: {}, medicalValidUntil: Gear.today(200), training: {} },
        { id: uid(), name: 'Casey ASM', email: 'casey@troop.org', role: 'asm', details: { patrols: ['Bears', 'Wolves'] }, medicalValidUntil: Gear.today(400), training: { YPT: 'Complete' } },
        { id: uid(), name: 'Riley Committee', email: 'riley@troop.org', role: 'committee', details: { position: 'Treasurer' }, medicalValidUntil: Gear.today(500), training: { YPT: 'Complete' } },
        { id: uid(), name: 'Morgan MBC', email: 'morgan@troop.org', role: 'mbc', details: { meritBadges: ['Camping', 'First Aid'] }, medicalValidUntil: Gear.today(500), training: { YPT: 'Complete' } },
      ];
      state.users = users;
      state.currentUserId = users[0].id;

      const ev1 = {
        id: uid(), name: 'Fall Campout', fromDate: Gear.today(30), toDate: Gear.today(32), closeDate: Gear.today(25), location: 'Camp Pine', scoutInCharge: 'Alex Scout',
        logistics: 'Bring tents, water, mess kit', signupLimit: 40, approved: true, createdBy: users[2].id,
      };
      const ev2 = {
        id: uid(), name: 'Service Project', fromDate: Gear.today(10), toDate: Gear.today(10), closeDate: Gear.today(8), location: 'City Park', scoutInCharge: 'Jamie Scout',
        logistics: 'Work gloves, water bottle', signupLimit: 25, approved: true, createdBy: users[3].id,
      };
      const ev3 = {
        id: uid(), name: 'PLC Meeting', fromDate: Gear.today(5), toDate: Gear.today(5), closeDate: Gear.today(4), location: 'Scout Hut', scoutInCharge: 'SPL',
        logistics: 'Notebook and pen', signupLimit: 20, approved: false, createdBy: users[2].id,
      };
      state.events = [ev1, ev2, ev3];
    }
    save();
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Filtering helpers
  function isPast(dateStr) {
    const d = new Date(dateStr);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return d < t; // strictly before today
  }

  function overlaps(aFrom, aTo, bFrom, bTo) {
    const a1 = new Date(aFrom), a2 = new Date(aTo || aFrom);
    const b1 = new Date(bFrom), b2 = new Date(bTo || bFrom);
    return a1 <= b2 && b1 <= a2;
  }

  // Sidebar status
  function renderSidebar() {
    const user = state.users.find((u) => u.id === getCurrentUserId());
    const sidebar = document.getElementById('sidebar');
    const medValid = user.medicalValidUntil ? new Date(user.medicalValidUntil) : null;
    const medValidStr = user.medicalValidUntil ? Gear.fmtDate(user.medicalValidUntil) : 'Not set';
    const medOk = medValid && medValid >= new Date();
    const trainingItems = Object.entries(user.training || {});

    sidebar.innerHTML = '';
    sidebar.append(
      Gear.el('div', { class: 'panel' },
        Gear.el('h3', null, 'Calendar'),
        Gear.el('div', { class: 'placeholder' }, 'Calendar view (coming soon)')
      ),
      Gear.el('div', { class: 'panel' },
        Gear.el('h3', null, 'Medical Record'),
        Gear.el('p', { class: medOk ? 'good' : 'bad' }, medOk ? `Valid up to ${medValidStr}` : `Invalid (was ${medValidStr})`)
      ),
      Gear.el('div', { class: 'panel' },
        Gear.el('h3', null, 'Training Status'),
        trainingItems.length === 0
          ? Gear.el('p', null, 'No training records')
          : Gear.el('ul', null, trainingItems.map(([k, v]) => Gear.el('li', null, `${k}: ${v}`)))
      ),
    );
  }

  // Register/Unregister actions
  function registrationStatus(eventId, userId) {
    const regs = state.registrations.filter((r) => r.eventId === eventId && r.userId === userId);
    if (regs.length === 0) return { status: 'not-registered' };
    const last = regs[regs.length - 1];
    return last.cancelled ? { status: 'not-registered' } : { status: 'registered', record: last };
  }

  function canModifyRegistration(event) {
    return !isPast(event.closeDate);
  }

  function handleRegister(event) {
    const userId = getCurrentUserId();
    // Enforce signup limit if set
    if (event.signupLimit) {
      const activeCount = state.registrations.filter((r) => r.eventId === event.id && !r.cancelled).length;
      if (activeCount >= event.signupLimit) {
        alert('Signup limit reached for this event.');
        return;
      }
    }
    state.registrations.push({ id: uid(), eventId: event.id, userId, date: new Date().toISOString(), cancelled: false });
    save();
    render();
  }

  function handleUnregister(event) {
    const userId = getCurrentUserId();
    const { record } = registrationStatus(event.id, userId);
    if (!record) return;
    record.cancelled = true;
    record.cancelledDate = new Date().toISOString();
    save();
    render();
  }

  // Dashboard — Scout Upcoming Events
  function renderDashboard() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    app.appendChild(Gear.el('h1', null, 'Scout Upcoming Events'));

    const upcomingApproved = state.events
      .filter((e) => e.approved && !isPast(e.toDate))
      .sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate));

    const table = Gear.el('table', { class: 'table' },
      Gear.el('thead', null,
        Gear.el('tr', null,
          ...['Event Name', 'From Date', 'To Date', 'Location', 'Scout-in-Charge', 'Close date', 'Registration Status'].map(h => Gear.el('th', null, h))
        )
      ),
      Gear.el('tbody', null,
        upcomingApproved.length === 0
          ? Gear.el('tr', null, Gear.el('td', { colspan: '7' }, 'No upcoming events'))
          : upcomingApproved.map((ev) => {
              const stat = registrationStatus(ev.id, getCurrentUserId());
              const canChange = canModifyRegistration(ev);
              let action = null;
              if (canChange) {
                if (stat.status === 'registered') {
                  action = Gear.el('button', { class: 'btn secondary', onclick: () => handleUnregister(ev) }, 'Un-register');
                } else {
                  action = Gear.el('button', { class: 'btn primary', onclick: () => handleRegister(ev) }, 'Register');
                }
              } else {
                action = Gear.el('span', { class: 'muted' }, 'Closed');
              }
              return Gear.el('tr', null,
                Gear.el('td', null, ev.name),
                Gear.el('td', null, Gear.fmtDate(ev.fromDate)),
                Gear.el('td', null, Gear.fmtDate(ev.toDate)),
                Gear.el('td', null, ev.location),
                Gear.el('td', null, ev.scoutInCharge),
                Gear.el('td', null, Gear.fmtDate(ev.closeDate)),
                Gear.el('td', null,
                  Gear.el('div', { class: 'flex between' },
                    Gear.el('span', null, stat.status === 'registered' ? 'Registered' : 'Not registered'),
                    action
                  )
                ),
              );
            })
      )
    );
    app.appendChild(table);

    // Upcoming SMC/BOR signed up
    const smcBorPanel = Gear.el('div', { class: 'panel mt' },
      Gear.el('div', { class: 'panel-head' },
        Gear.el('h2', null, 'Upcoming SMC/BOR (Your signups)'),
        Gear.el('div', null,
          Gear.el('button', { class: 'btn link', onclick: () => showHistory('smcbor') }, 'Show historic data'),
          Gear.el('button', { class: 'btn', onclick: () => Gear.navigate('/smc-bor') }, 'Submit SMC/BOR')
        )
      ),
      renderSmcBorList(getCurrentUserId(), true)
    );
    app.appendChild(smcBorPanel);

    // Parents / Adult leaders Signup panel (simple volunteer signup list)
    const adultPanel = Gear.el('div', { class: 'panel mt' },
      Gear.el('div', { class: 'panel-head' },
        Gear.el('h2', null, 'Parents / Adult Leaders Signup'),
        Gear.el('div', null,
          Gear.el('button', { class: 'btn link', onclick: () => showHistory('adultLeaderSignups') }, 'Show historic data'),
          Gear.el('button', { class: 'btn', onclick: () => addAdultSignup() }, 'New Signup')
        )
      ),
      renderAdultSignups(true)
    );
    app.appendChild(adultPanel);
  }

  function showHistory(key) {
    const data = state[key] || [];
    const modal = modalContainer();
    const list = Gear.el('ul', { class: 'list' },
      ...data.map((item) => {
        if (key === 'smcbor') {
          return Gear.el('li', null, `${item.type} on ${Gear.fmtDate(item.date)} — ${userName(item.userId)} (${item.status || 'pending'})`);
        }
        if (key === 'adultLeaderSignups') {
          return Gear.el('li', null, `${userName(item.userId)} — ${item.role || 'Volunteer'} (${Gear.fmtDate(item.date)})`);
        }
        return Gear.el('li', null, JSON.stringify(item));
      })
    );
    modal.body.append(
      Gear.el('h3', null, 'Historic Data'),
      list,
      Gear.el('div', { class: 'right mt' }, Gear.el('button', { class: 'btn', onclick: () => modal.close() }, 'Close'))
    );
  }

  function renderSmcBorList(userId, upcomingOnly) {
    const entries = state.smcbor
      .filter((s) => s.userId === userId)
      .filter((s) => !upcomingOnly || !isPast(s.date))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (entries.length === 0) return Gear.el('p', { class: 'muted' }, 'No entries');
    return Gear.el('ul', { class: 'list' },
      ...entries.map((s) => Gear.el('li', null, `${s.type} on ${Gear.fmtDate(s.date)} — ${s.status || 'pending'}`))
    );
  }

  function addAdultSignup() {
    const modal = modalContainer();
    const role = Gear.el('input', { type: 'text', placeholder: 'Role (e.g., Driver, Quartermaster Helper)' });
    const date = Gear.el('input', { type: 'date', value: Gear.today() });
    modal.body.append(
      Gear.el('h3', null, 'New Adult/Parent Signup'),
      formRow('Role', role),
      formRow('Date', date),
      Gear.el('div', { class: 'right mt' },
        Gear.el('button', { class: 'btn secondary', onclick: () => modal.close() }, 'Cancel'),
        Gear.el('button', {
          class: 'btn primary', onclick: () => {
            state.adultLeaderSignups.push({ id: uid(), userId: getCurrentUserId(), role: role.value || 'Volunteer', date: date.value || Gear.today() });
            save(); modal.close(); render();
          }
        }, 'Save')
      )
    );
  }

  function renderAdultSignups(upcomingOnly) {
    const entries = state.adultLeaderSignups
      .filter((s) => !upcomingOnly || !isPast(s.date))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (entries.length === 0) return Gear.el('p', { class: 'muted' }, 'No signups');
    return Gear.el('ul', { class: 'list' },
      ...entries.map((s) => Gear.el('li', null, `${Gear.fmtDate(s.date)} — ${userName(s.userId)} (${s.role})`))
    );
  }

  // Events page
  function renderEvents() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(Gear.el('h1', null, 'Events'));

    // Create event form
    const name = Gear.el('input', { type: 'text', placeholder: 'Event name' });
    const fromDate = Gear.el('input', { type: 'date', value: Gear.today(14) });
    const toDate = Gear.el('input', { type: 'date', value: Gear.today(16) });
    const closeDate = Gear.el('input', { type: 'date', value: Gear.today(10) });
    const location = Gear.el('input', { type: 'text', placeholder: 'Location' });
    const sic = Gear.el('input', { type: 'text', placeholder: 'Scout-in-Charge' });
    const logistics = Gear.el('textarea', { placeholder: 'Logistics (gear, notes, etc.)', rows: 3 });
    const limit = Gear.el('input', { type: 'number', min: '0', placeholder: 'Signup limit (optional)' });

    const warn = Gear.el('div', { class: 'warn', style: 'display:none;' });
    const form = Gear.el('div', { class: 'panel' },
      Gear.el('h2', null, 'Create Event (Sends for SM/Admin approval)'),
      formRow('Event Name', name),
      formRow('From Date', fromDate),
      formRow('To Date', toDate),
      formRow('Close Date', closeDate),
      formRow('Location', location),
      formRow('Scout-in-Charge', sic),
      formRow('Logistics', logistics),
      formRow('Signup limit', limit),
      warn,
      Gear.el('div', { class: 'right mt' },
        Gear.el('button', { class: 'btn primary', onclick: submitEvent }, 'Submit for Approval')
      )
    );
    app.appendChild(form);

    function submitEvent() {
      const ev = {
        id: uid(),
        name: name.value.trim() || 'Untitled',
        fromDate: fromDate.value,
        toDate: toDate.value || fromDate.value,
        closeDate: closeDate.value || fromDate.value,
        location: location.value.trim(),
        scoutInCharge: sic.value.trim(),
        logistics: logistics.value.trim(),
        signupLimit: parseInt(limit.value || '0', 10) || undefined,
        approved: false,
        createdBy: getCurrentUserId(),
      };
      // Conflict check (warn only)
      const conflicts = state.events.filter((e) => overlaps(e.fromDate, e.toDate, ev.fromDate, ev.toDate));
      if (conflicts.length) {
        warn.style.display = '';
        warn.textContent = `Warning: Conflicts with ${conflicts.map((c) => c.name).join(', ')}`;
      } else {
        warn.style.display = 'none';
      }
      state.events.push(ev);
      save();
      alert('Event submitted for approval.');
      render();
    }

    // Upcoming & Historical lists
    const upcoming = state.events.filter((e) => !isPast(e.toDate)).sort((a, b) => new Date(a.fromDate) - new Date(b.fromDate));
    const historical = state.events.filter((e) => isPast(e.toDate)).sort((a, b) => new Date(b.toDate) - new Date(a.toDate));

    app.append(
      Gear.el('div', { class: 'panel mt' },
        Gear.el('div', { class: 'panel-head' },
          Gear.el('h2', null, 'Upcoming Events'),
          Gear.el('div', null, Gear.el('span', { class: 'muted' }, 'Approved events appear on Dashboard'))
        ),
        eventsTable(upcoming)
      ),
      Gear.el('div', { class: 'panel mt' },
        Gear.el('div', { class: 'panel-head' },
          Gear.el('h2', null, 'Historical Events'),
          Gear.el('div', null, Gear.el('button', { class: 'btn link', onclick: () => {/* already visible */} }, 'Refresh'))
        ),
        eventsTable(historical)
      )
    );

    // Admin approvals (quick panel for SM/Admin)
    const me = state.users.find((u) => u.id === getCurrentUserId());
    if (['asm', 'committee', 'mbc'].includes(me.role) || location.hash === '#/admin') {
      const pending = state.events.filter((e) => !e.approved);
      app.appendChild(Gear.el('div', { class: 'panel mt' },
        Gear.el('h2', null, 'Pending Approvals'),
        pending.length === 0 ? Gear.el('p', { class: 'muted' }, 'No pending events') :
          Gear.el('ul', { class: 'list' }, ...pending.map((e) =>
            Gear.el('li', { class: 'flex between' },
              Gear.el('span', null, `${e.name} (${Gear.fmtDate(e.fromDate)} → ${Gear.fmtDate(e.toDate)})`),
              Gear.el('span', null,
                Gear.el('button', { class: 'btn secondary', onclick: () => { e.approved = false; save(); render(); } }, 'Keep Pending'),
                ' ',
                Gear.el('button', { class: 'btn primary', onclick: () => { e.approved = true; save(); render(); } }, 'Approve')
              )
            )
          ))
      ));
    }
  }

  function eventsTable(list) {
    if (list.length === 0) return Gear.el('p', { class: 'muted' }, 'No events');
    return Gear.el('table', { class: 'table' },
      Gear.el('thead', null,
        Gear.el('tr', null, ...['Event Name', 'From', 'To', 'Location', 'Close', 'SIC', 'Approved'].map(h => Gear.el('th', null, h)))
      ),
      Gear.el('tbody', null,
        ...list.map((e) => Gear.el('tr', null,
          Gear.el('td', null, e.name),
          Gear.el('td', null, Gear.fmtDate(e.fromDate)),
          Gear.el('td', null, Gear.fmtDate(e.toDate)),
          Gear.el('td', null, e.location),
          Gear.el('td', null, Gear.fmtDate(e.closeDate)),
          Gear.el('td', null, e.scoutInCharge || ''),
          Gear.el('td', null, e.approved ? 'Yes' : 'No')
        ))
      )
    );
  }

  // SMC/BOR page
  function renderSmcBor() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(Gear.el('h1', null, 'SMC / BOR'));

    const type = Gear.el('select', null,
      Gear.el('option', { value: 'SMC' }, 'SMC'),
      Gear.el('option', { value: 'BOR' }, 'BOR'),
    );
    const date = Gear.el('input', { type: 'date', value: Gear.today(7) });
    const form = Gear.el('div', { class: 'panel' },
      Gear.el('h2', null, 'Submit Request'),
      formRow('Type', type),
      formRow('Preferred Date', date),
      Gear.el('div', { class: 'right mt' },
        Gear.el('button', { class: 'btn primary', onclick: submit }, 'Submit')
      )
    );
    app.appendChild(form);

    function submit() {
      state.smcbor.push({ id: uid(), userId: getCurrentUserId(), type: type.value, date: date.value, status: 'pending', createdAt: new Date().toISOString() });
      save();
      render();
    }

    app.append(
      Gear.el('div', { class: 'panel mt' },
        Gear.el('div', { class: 'panel-head' },
          Gear.el('h2', null, 'Upcoming'),
          Gear.el('div', null, Gear.el('button', { class: 'btn link', onclick: () => showHistory('smcbor') }, 'Show historic data'))
        ),
        renderSmcBorList(getCurrentUserId(), true)
      )
    );
  }

  // Adult Leaders directory
  function renderAdults() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(Gear.el('h1', null, 'Adult Leaders Directory'));

    const adults = state.users.filter((u) => ['asm', 'committee', 'mbc'].includes(u.role));
    if (adults.length === 0) {
      app.appendChild(Gear.el('p', { class: 'muted' }, 'No adult leaders yet'));
      return;
    }

    const table = Gear.el('table', { class: 'table' },
      Gear.el('thead', null,
        Gear.el('tr', null, ...['Name', 'Email', 'Role', 'Details'].map(h => Gear.el('th', null, h)))
      ),
      Gear.el('tbody', null,
        ...adults.map((a) => Gear.el('tr', null,
          Gear.el('td', null, a.name),
          Gear.el('td', null, a.email),
          Gear.el('td', null, a.role.toUpperCase()),
          Gear.el('td', null, adultDetails(a))
        ))
      )
    );
    app.appendChild(table);

    function adultDetails(a) {
      if (a.role === 'committee') return a.details?.position ? `Position: ${a.details.position}` : '';
      if (a.role === 'asm') return a.details?.patrols?.length ? `Patrols: ${a.details.patrols.join(', ')}` : '';
      if (a.role === 'mbc') return a.details?.meritBadges?.length ? `Merit Badges: ${a.details.meritBadges.join(', ')}` : '';
      return '';
    }
  }

  // Admin
  function renderAdmin() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(Gear.el('h1', null, 'Admin Dashboard'));

    // User medical and training
    const userSel = Gear.el('select');
    state.users.forEach((u) => userSel.appendChild(Gear.el('option', { value: u.id }, `${u.name} (${u.role})`)));
    const med = Gear.el('input', { type: 'date' });
    const k = Gear.el('input', { type: 'text', placeholder: 'Training name (e.g., YPT)' });
    const v = Gear.el('input', { type: 'text', placeholder: 'Status (e.g., Complete)' });
    const addTrainingBtn = Gear.el('button', { class: 'btn' }, 'Add/Update Training');
    const saveMedBtn = Gear.el('button', { class: 'btn primary' }, 'Save Medical');

    saveMedBtn.onclick = () => {
      const u = state.users.find((x) => x.id === userSel.value);
      u.medicalValidUntil = med.value || null;
      save();
      renderSidebar();
      alert('Saved');
    };
    addTrainingBtn.onclick = () => {
      const u = state.users.find((x) => x.id === userSel.value);
      u.training = u.training || {};
      if (k.value.trim()) u.training[k.value.trim()] = v.value.trim() || 'Complete';
      save();
      renderSidebar();
      alert('Saved');
    };

    app.appendChild(Gear.el('div', { class: 'panel' },
      Gear.el('h2', null, 'Medical & Training Records'),
      formRow('User', userSel),
      formRow('Medical valid until', med),
      Gear.el('div', { class: 'right' }, saveMedBtn),
      Gear.el('hr'),
      formRow('Training key', k),
      formRow('Training value', v),
      Gear.el('div', { class: 'right' }, addTrainingBtn)
    ));

    const me = state.users.find((u) => u.id === getCurrentUserId());
    if (['asm', 'committee', 'mbc'].includes(me.role)) {
      // Approvals mirror
      const pending = state.events.filter((e) => !e.approved);
      app.appendChild(Gear.el('div', { class: 'panel mt' },
        Gear.el('h2', null, 'Pending Event Approvals'),
        pending.length === 0 ? Gear.el('p', { class: 'muted' }, 'No pending events') :
          Gear.el('ul', { class: 'list' }, ...pending.map((e) =>
            Gear.el('li', { class: 'flex between' },
              Gear.el('span', null, `${e.name} (${Gear.fmtDate(e.fromDate)} → ${Gear.fmtDate(e.toDate)})`),
              Gear.el('span', null,
                Gear.el('button', { class: 'btn secondary', onclick: () => { e.approved = false; save(); render(); } }, 'Keep Pending'),
                ' ',
                Gear.el('button', { class: 'btn primary', onclick: () => { e.approved = true; save(); render(); } }, 'Approve')
              )
            )
          ))
      ));
    }
  }

  // Resources
  function renderResources() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(Gear.el('h1', null, 'Resources'));
    app.appendChild(Gear.el('div', { class: 'panel' },
      Gear.el('p', null, 'Link public info here (camping list, packing checklists, calendar links, troop policies, etc.).')
    ));
  }

  // Utilities
  function formRow(label, control) {
    return Gear.el('div', { class: 'row' }, Gear.el('label', null, label), control);
  }

  function userName(id) {
    return state.users.find((u) => u.id === id)?.name || 'Unknown';
  }

  function modalContainer() {
    const overlay = Gear.el('div', { class: 'modal-overlay' });
    const body = Gear.el('div', { class: 'modal-body' });
    function close() { overlay.remove(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.appendChild(body);
    document.body.appendChild(overlay);
    return { body, close };
  }

  // Routing
  function render() {
    const path = location.hash.replace(/^#/, '') || '/dashboard';
    if (path === '/dashboard') return renderDashboard();
    if (path === '/events') return renderEvents();
    if (path === '/smc-bor') return renderSmcBor();
    if (path === '/adults') return renderAdults();
    if (path === '/resources') return renderResources();
    if (path === '/admin') return renderAdmin();
    // default
    renderDashboard();
  }

  Gear.onReady(() => {
    setCurrentUserOptions();
    renderSidebar();
    render();
    window.addEventListener('hashchange', () => { render(); });
  });
})();

