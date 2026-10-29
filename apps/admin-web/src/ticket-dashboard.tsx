import { useMemo, useState, type FormEvent } from 'react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING' | 'RESOLVED';
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
type Section = 'Inicio' | 'Tickets' | 'Equipos' | 'Bodega' | 'Actas' | 'Configuración';

interface Ticket {
  id: string;
  number: string;
  subject: string;
  store: string;
  priority: Priority;
  status: TicketStatus;
  date: string;
  description: string;
}

interface TicketReply {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

const demoTickets: Ticket[] = [
  { id: '1', number: 'IT-1048', subject: 'Equipo no enciende en caja principal', store: 'Matriz · Guayaquil', priority: 'URGENT', status: 'OPEN', date: '2026-10-29', description: 'La computadora de caja no enciende después de una interrupción eléctrica. La tienda solicita apoyo para reanudar la operación.' },
  { id: '2', number: 'IT-1047', subject: 'Problemas de conexión a la red', store: 'Tienda Urdesa', priority: 'HIGH', status: 'IN_PROGRESS', date: '2026-10-29', description: 'La conexión de red se interrumpe varias veces durante el día en el área de atención.' },
  { id: '3', number: 'IT-1046', subject: 'Impresora imprime con líneas', store: 'Tienda Centro', priority: 'MEDIUM', status: 'PENDING', date: '2026-10-28', description: 'Se requiere revisar la calidad de impresión y el estado de los consumibles.' },
  { id: '4', number: 'IT-1045', subject: 'Instalación de actualización', store: 'Tienda Samborondón', priority: 'LOW', status: 'RESOLVED', date: '2026-10-28', description: 'Solicitud de actualización del software de oficina en el equipo asignado.' },
  { id: '5', number: 'IT-1044', subject: 'Lector de código no reconoce productos', store: 'Tienda Alborada', priority: 'HIGH', status: 'IN_PROGRESS', date: '2026-10-27', description: 'El lector deja de reconocer algunos códigos durante el proceso de venta.' },
  { id: '6', number: 'IT-1043', subject: 'Solicitud de acceso a carpeta compartida', store: 'Matriz · Guayaquil', priority: 'MEDIUM', status: 'OPEN', date: '2026-10-27', description: 'Se requiere acceso a una carpeta compartida para completar tareas administrativas.' },
  { id: '7', number: 'IT-1042', subject: 'Teclado con teclas intermitentes', store: 'Tienda Urdesa', priority: 'LOW', status: 'RESOLVED', date: '2026-10-26', description: 'Algunas teclas no responden de manera constante durante el uso.' },
  { id: '8', number: 'IT-1041', subject: 'Revisión de punto de red', store: 'Tienda Centro', priority: 'MEDIUM', status: 'PENDING', date: '2026-10-25', description: 'Se solicita revisar el punto de red del área de bodega de la tienda.' },
];

const statusLabels: Record<TicketStatus, string> = { OPEN: 'Abierto', IN_PROGRESS: 'En atención', PENDING: 'Pendiente', RESOLVED: 'Resuelto' };
const priorityLabels: Record<Priority, string> = { URGENT: 'Urgente', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const navItems: Section[] = ['Inicio', 'Tickets', 'Equipos', 'Bodega', 'Actas', 'Configuración'];

function NavIcon({ section }: { section: Section }): React.JSX.Element {
  const paths: Record<Section, React.ReactNode> = {
    Inicio: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    Tickets: <><path d="M4 5h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V5Z" /><path d="M12 8v1m0 3v1m0 3v.01" /></>,
    Equipos: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    Bodega: <><path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z" /><path d="m3 7 9 4 9-4m-9 4v10" /></>,
    Actas: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7m-7 4h7" /></>,
    'Configuración': <><circle cx="12" cy="12" r="3" /><path d="M19.4 15.4a8 8 0 0 0 0-6.8l1.5-1.1-1.7-2.8-1.8.7a8 8 0 0 0-3-1.7L14 2h-4l-.4 1.7a8 8 0 0 0-3 1.7l-1.8-.7-1.7 2.8 1.5 1.1a8 8 0 0 0 0 6.8l-1.5 1.1 1.7 2.8 1.8-.7a8 8 0 0 0 3 1.7L10 22h4l.4-1.7a8 8 0 0 0 3-1.7l1.8.7 1.7-2.8-1.5-1.1Z" /></>,
  };
  return <svg className="nav-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[section]}</svg>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export function TicketDashboard({ email, onSignOut }: { email: string; onSignOut: () => void }): React.JSX.Element {
  const [tickets, setTickets] = useState(demoTickets);
  const [section, setSection] = useState<Section>('Inicio');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [ticketReplies, setTicketReplies] = useState<Record<string, TicketReply[]>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});
  const [replyDraft, setReplyDraft] = useState('');
  const [replyError, setReplyError] = useState('');
  const [observationSaved, setObservationSaved] = useState(false);

  const selectedTicket = selected ? tickets.find((ticket) => ticket.id === selected.id) ?? selected : null;

  const counts = useMemo(() => ({
    OPEN: tickets.filter((ticket) => ticket.status === 'OPEN').length,
    IN_PROGRESS: tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
    PENDING: tickets.filter((ticket) => ticket.status === 'PENDING').length,
    RESOLVED: tickets.filter((ticket) => ticket.status === 'RESOLVED').length,
  }), [tickets]);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const searchText = `${ticket.number} ${ticket.subject} ${ticket.store}`.toLocaleLowerCase('es');
    return searchText.includes(query.trim().toLocaleLowerCase('es'))
      && (!statusFilter || ticket.status === statusFilter)
      && (!priorityFilter || ticket.priority === priorityFilter);
  }), [tickets, query, statusFilter, priorityFilter]);

  function addTicket(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = String(data.get('subject') ?? '').trim();
    const store = String(data.get('store') ?? '').trim();
    const priority = String(data.get('priority') ?? '') as Priority;
    const description = String(data.get('description') ?? '').trim();
    if (!subject || !store || !description || !priority) {
      setFormError('Completa el asunto, la tienda, la prioridad y la descripción.');
      return;
    }
    const nextNumber = `IT-${1049 + tickets.length - demoTickets.length}`;
    const created: Ticket = { id: crypto.randomUUID(), number: nextNumber, subject, store, priority, status: 'OPEN', date: new Date().toISOString().slice(0, 10), description };
    setTickets((current) => [created, ...current]);
    setShowForm(false);
    setFormError('');
    setSection('Tickets');
    setSelected(null);
  }

  function openSection(next: Section): void {
    setSection(next);
    setSelected(null);
    setMobileMenuOpen(false);
    if (next === 'Tickets') {
      setStatusFilter('');
      setPriorityFilter('');
    }
  }

  function openTicket(ticket: Ticket): void {
    setSelected(ticket);
    setReplyDraft('');
    setReplyError('');
    setObservationSaved(false);
  }

  function changeTicketStatus(status: TicketStatus): void {
    if (!selectedTicket) return;
    const updated = { ...selectedTicket, status };
    setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket));
    setSelected(updated);
  }

  function sendReply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const body = replyDraft.trim();
    if (!body || !selectedTicket) {
      setReplyError('Escribe una respuesta antes de enviarla.');
      return;
    }
    const reply: TicketReply = { id: crypto.randomUUID(), body, author: email, createdAt: new Date().toISOString() };
    setTicketReplies((current) => ({ ...current, [selectedTicket.id]: [...(current[selectedTicket.id] ?? []), reply] }));
    setReplyDraft('');
    setReplyError('');
  }

  function saveObservation(): void {
    if (!selectedTicket) return;
    setObservations((current) => ({ ...current, [selectedTicket.id]: (observationDrafts[selectedTicket.id] ?? '').trim() }));
    setObservationSaved(true);
  }

  const navigation = <nav className="dashboard-nav" aria-label="Navegación principal">
    {navItems.map((item) => <button key={item} className={`nav-item ${section === item ? 'active' : ''}`} aria-current={section === item ? 'page' : undefined} onClick={() => openSection(item)}><span className="nav-icon"><NavIcon section={item} /></span>{item}</button>)}
  </nav>;

  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand"><span className="dashboard-brand-mark">N</span><span><strong>Grupo Nodos</strong><small>IT MANAGEMENT</small></span></div>
      <div className="sidebar-caption">MENÚ PRINCIPAL</div>
      {navigation}
      <div className="sidebar-bottom"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{email}</strong><small>Correo verificado</small></span><button className="signout-button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">↪</button></div>
    </aside>

    <main className="dashboard-main">
      <header className="dashboard-topbar"><button className="mobile-menu-toggle" aria-label="Abrir menú" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button><div className="topbar-title"><span className="topbar-kicker">GRUPO NODOS IT</span><h1>{selected ? 'Detalle del ticket' : section}</h1></div><div className="topbar-actions"><label className="dashboard-search"><span aria-hidden="true">⌕</span><input placeholder="Buscar tickets…" value={query} onChange={(event) => { setQuery(event.target.value); if (section === 'Inicio') setSection('Tickets'); }} aria-label="Buscar por número, asunto o tienda" /></label><span className="demo-pill"><i /> Datos de demostración</span></div></header>

      <div className="dashboard-content">
        <p className="demo-notice"><strong>Datos de demostración.</strong> Los cambios solo se conservan durante esta sesión.</p>

        {selectedTicket ? <>
          <button className="back-button detail-back" onClick={() => { setSelected(null); setReplyDraft(''); setReplyError(''); }}>← Volver a tickets</button>
          <section className="ticket-detail-layout" aria-label={`Ticket ${selectedTicket.number}`}>
            <div className="ticket-detail-main">
              <header className="detail-heading">
                <div><span className="ticket-number">{selectedTicket.number}</span><h2>{selectedTicket.subject}</h2></div>
                <span className={`status-badge status-${selectedTicket.status.toLowerCase()}`}>{statusLabels[selectedTicket.status]}</span>
              </header>
              <div className="detail-grid"><div><span>Tienda</span><strong>{selectedTicket.store}</strong></div><div><span>Prioridad</span><strong><i className={`priority-dot priority-${selectedTicket.priority.toLowerCase()}`} /> {priorityLabels[selectedTicket.priority]}</strong></div><div><span>Fecha de creación</span><strong>{formatDate(selectedTicket.date)}</strong></div></div>
              <section className="conversation-section" aria-labelledby="conversation-title">
                <div className="section-title-row"><div><h3 id="conversation-title">Conversación</h3><p>Solicitud y respuestas del equipo de soporte</p></div><span>{(ticketReplies[selectedTicket.id] ?? []).length + 1} mensajes</span></div>
                <article className="conversation-message requester-message"><div className="message-meta"><strong>Solicitud recibida</strong><time>{formatDate(selectedTicket.date)}</time></div><p>{selectedTicket.description}</p></article>
                {(ticketReplies[selectedTicket.id] ?? []).map((reply) => <article className="conversation-message support-message" key={reply.id}><div className="message-meta"><strong>Soporte · {reply.author}</strong><time>{new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reply.createdAt))}</time></div><p>{reply.body}</p></article>)}
                <form className="reply-composer" onSubmit={sendReply}><label htmlFor="ticket-reply">Contestar</label><textarea id="ticket-reply" value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows={4} maxLength={2000} placeholder="Escribe una respuesta para quien reportó el problema…" />{replyError && <p className="field-error" role="alert">{replyError}</p>}<div className="composer-footer"><span>Respuesta visible en el historial de esta sesión</span><button type="submit" className="primary-action">Enviar respuesta</button></div></form>
              </section>
            </div>
            <aside className="ticket-detail-side">
              <section className="detail-side-section status-control"><h3>Estado del ticket</h3><div className="status-toggle" role="group" aria-label="Abrir o cerrar ticket"><button className={selectedTicket.status === 'RESOLVED' ? '' : 'selected'} aria-pressed={selectedTicket.status !== 'RESOLVED'} onClick={() => changeTicketStatus('OPEN')}>Abierto</button><button className={selectedTicket.status === 'RESOLVED' ? 'selected closed' : ''} aria-pressed={selectedTicket.status === 'RESOLVED'} onClick={() => changeTicketStatus('RESOLVED')}>Cerrado</button></div><label className="field-label" htmlFor="ticket-work-status">Estado de trabajo</label><select id="ticket-work-status" value={selectedTicket.status} onChange={(event) => changeTicketStatus(event.target.value as TicketStatus)}><option value="OPEN">Abierto</option><option value="IN_PROGRESS">En atención</option><option value="PENDING">Pendiente</option><option value="RESOLVED">Resuelto</option></select><p>Al cerrar, el estado pasa a Resuelto. Puedes reabrirlo cuando sea necesario.</p></section>
              <section className="detail-side-section observation-section"><div><h3>Observaciones internas</h3><p>Solo visibles para soporte en esta demostración.</p></div><textarea aria-label="Observaciones internas" value={observationDrafts[selectedTicket.id] ?? observations[selectedTicket.id] ?? ''} onChange={(event) => { setObservationDrafts((current) => ({ ...current, [selectedTicket.id]: event.target.value })); setObservationSaved(false); }} rows={5} maxLength={1000} placeholder="Agrega notas de seguimiento que no se envían al solicitante…" /><button className="secondary-action" onClick={saveObservation}>Guardar observación</button>{observationSaved && <span className="saved-note" role="status">Guardada durante esta sesión</span>}</section>
            </aside>
          </section>
        </>
          : section === 'Inicio' || section === 'Tickets' ? <>
            {section === 'Inicio' && <>
              <div className="welcome-row"><div><h2>Resumen de soporte</h2><p>Estado actual de los tickets registrados en esta demostración.</p></div><button className="primary-action" onClick={() => { setFormError(''); setShowForm(true); }}>＋ Crear ticket</button></div>
              <div className="summary-grid">{([['OPEN', 'Abiertos'], ['IN_PROGRESS', 'En atención'], ['PENDING', 'Pendientes'], ['RESOLVED', 'Resueltos']] as const).map(([status, label]) => <article className="summary-card" key={status}><span>{label}</span><strong>{counts[status]}</strong></article>)}</div>
            </>}
            <section className="ticket-list-card">
              <div className="list-heading"><div><h2>{section === 'Inicio' ? 'Tickets recientes' : 'Todos los tickets'}</h2><p>{filteredTickets.length} registros · datos ficticios</p></div><div className="list-filters"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TicketStatus | '')} aria-label="Filtrar por estado"><option value="">Todos los estados</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | '')} aria-label="Filtrar por prioridad"><option value="">Todas las prioridades</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{section === 'Tickets' && <button className="primary-action compact-action" onClick={() => { setFormError(''); setShowForm(true); }}>＋ Crear</button>}</div></div>
              <div className="table-scroll"><table className="ticket-table"><thead><tr><th>Número</th><th>Asunto</th><th>Tienda</th><th>Prioridad</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{filteredTickets.map((ticket) => <tr key={ticket.id} onClick={() => openTicket(ticket)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') openTicket(ticket); }}><td><button className="ticket-link" onClick={(event) => { event.stopPropagation(); openTicket(ticket); }}>{ticket.number}</button></td><td className="subject-cell">{ticket.subject}</td><td>{ticket.store}</td><td><span className={`priority-label priority-${ticket.priority.toLowerCase()}`}><i className={`priority-dot priority-${ticket.priority.toLowerCase()}`} />{priorityLabels[ticket.priority]}</span></td><td><span className={`status-badge status-${ticket.status.toLowerCase()}`}>{statusLabels[ticket.status]}</span></td><td>{formatDate(ticket.date)}</td></tr>)}</tbody></table>{filteredTickets.length === 0 && <div className="empty-state">No hay tickets que coincidan con la búsqueda y los filtros.</div>}</div>
            </section>
          </> : <section className="coming-soon-card"><div className="coming-icon">◇</div><span className="topbar-kicker">MÓDULO PROVISIONAL</span><h2>{section === 'Configuración' ? 'Ajustes generales' : `Módulo de ${section.toLocaleLowerCase('es')}`}</h2><p>{section === 'Configuración' ? 'Los ajustes estarán disponibles cuando se conecte la API. No se almacenan ni modifican credenciales desde esta vista.' : `La vista de ${section.toLocaleLowerCase('es')} está pendiente de implementación. No hay registros reales conectados.`}</p><button className="secondary-action" onClick={() => openSection('Inicio')}>Volver al inicio</button></section>}
      </div>
    </main>

    {mobileMenuOpen && <div className="mobile-nav-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}><section className="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label="Menú principal"><div className="mobile-nav-heading"><span>Grupo Nodos IT</span><button className="modal-close" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú">×</button></div>{navigation}<div className="mobile-profile"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="profile-copy"><strong>{email}</strong><small>Correo verificado</small></span><button className="signout-button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">↪</button></div></section></div>}

    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="create-ticket-title"><div className="modal-heading"><div><span className="topbar-kicker">REGISTRO LOCAL</span><h2 id="create-ticket-title">Crear ticket</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Cerrar formulario">×</button></div><p className="modal-note">Este ticket solo existirá en esta sesión de demostración.</p><form onSubmit={addTicket} className="ticket-create-form"><label>Asunto<input name="subject" required maxLength={120} placeholder="Describe brevemente el problema" /></label><label>Tienda<input name="store" required maxLength={100} placeholder="Nombre de tienda o matriz" /></label><label>Prioridad<select name="priority" required defaultValue="MEDIUM"><option value="URGENT">Urgente</option><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option></select></label><label>Descripción<textarea name="description" required rows={4} maxLength={1000} placeholder="Agrega los detalles del requerimiento" /></label>{formError && <div className="feedback feedback-error" role="alert">{formError}</div>}<div className="modal-actions"><button type="button" className="secondary-action" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-action">Crear ticket</button></div></form></section></div>}
  </div>;
}
