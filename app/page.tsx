'use client';

import { useRef, useState } from 'react';

type IconName = 'robot' | 'arrow' | 'trophy' | 'users' | 'flag' | 'bolt' | 'pin' | 'search' | 'menu' | 'close';
function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    robot: <><rect x="4" y="7" width="16" height="14" rx="4"/><path d="M12 3v4M2 12v5m20-5v5M8 16h8"/><path d="M8 11v1m8-1v1"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM12 13v7m-4 1h8M7 5H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4"/></>,
    users: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/></>,
    flag: <path d="M4 22V3m0 1c6-4 10 4 16 0v10c-6 4-10-4-16 0"/>,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
  };
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const teams = [
  { name: 'CyberBots', school: 'Colegio Tecnológico', score: 95, initials: 'CB', color: 'coral', robot: 'Titan-X' },
  { name: 'RoboStorm', school: 'Instituto Futuro', score: 91, initials: 'RS', color: 'violet', robot: 'Storm-01' },
  { name: 'Titan Robotics', school: 'Colegio Central', score: 87, initials: 'TR', color: 'blue', robot: 'Atlas' },
  { name: 'Mecha Warriors', school: 'Academia STEM', score: 82, initials: 'MW', color: 'mint', robot: 'Mecha-04' },
];
const links = [['Inicio', '#inicio'], ['Competencia', '#competencias'], ['Ranking', '#ranking'], ['Equipos', '#equipos']];
const shortcuts: { title: string; text: string; icon: IconName; href: string }[] = [
  { title: 'La competencia', text: 'Conoce el evento', icon: 'trophy', href: '#competencias' },
  { title: 'Los equipos', text: 'Talento en acción', icon: 'users', href: '#equipos' },
  { title: 'El ranking', text: 'Cada punto cuenta', icon: 'bolt', href: '#ranking' },
  { title: 'El reto', text: 'Descubre Mini Sumo', icon: 'flag', href: '#retos' },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLButtonElement>(null);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const results = teams.filter(team => normalize(`${team.name} ${team.school}`).includes(normalize(query.trim())));

  return <div className="rs-app" data-design="roboscore-studio-v3">
    <a href="#contenido" className="rs-skip">Saltar al contenido</a>
    <header className="rs-header"><nav className="rs-wrap rs-nav" aria-label="Navegación principal" onKeyDown={event => { if (event.key === 'Escape') { setMenuOpen(false); menuRef.current?.focus(); } }}>
      <a className="rs-logo" href="#inicio" aria-label="RoboScore inicio"><span className="rs-logo-icon"><Icon name="robot"/></span>Robo<span>Score</span><span className="rs-logo-period">.</span></a>
      <button ref={menuRef} className="rs-menu" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'}/></button>
      <div className={`rs-nav-links ${menuOpen ? 'rs-open' : ''}`} id="main-navigation">{links.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<a className="rs-organizers" href="/login" onClick={() => setMenuOpen(false)}>Organizadores <Icon name="arrow"/></a></div>
    </nav></header>

    <main id="contenido">
      <section id="inicio" className="rs-wrap rs-hero">
        <div className="rs-hero-copy"><span className="rs-eyebrow"><span className="rs-tiny-square"/> GRANDES IDEAS. PEQUEÑOS ROBOTS.</span><h1>Construye.<br/>Compite.<br/><span>Sorpréndete.</span></h1><p>Donde la creatividad se convierte en robots y cada desafío, en una nueva historia.</p><div className="rs-actions"><a className="rs-button rs-primary" href="#ranking">Explorar ranking <Icon name="arrow"/></a><a className="rs-text-link" href="#competencias">Conoce la competencia <span>↗</span></a></div><div className="rs-hero-bottom"><div className="rs-mini-teams" aria-hidden="true">{teams.slice(0,3).map(team => <span key={team.name} className={`rs-avatar ${team.color}`}>{team.initials}</span>)}</div><p><strong>El futuro se crea en equipo.</strong><br/>Aprender también es parte de ganar.</p></div></div>

        <div className="rs-event-poster" id="competencias">
          <div className="rs-poster-top"><span><Icon name="bolt"/> ROBO KIDS</span><span className="rs-demo-tag">Evento de ejemplo</span></div>
          <div className="rs-poster-body"><div className="rs-poster-kicker">INGENIO EN MOVIMIENTO</div><h2>RoboKids<br/>Challenge<span>2026</span></h2><div className="rs-poster-seal" aria-hidden="true"><Icon name="trophy"/><span>LET’S<br/>BUILD!</span></div></div>
          <div className="rs-poster-footer"><span><Icon name="pin"/> Neiva, Colombia</span><a href="#retos">Mini Sumo <span>↗</span></a></div>
          <div className="rs-event-stats"><div><strong>04</strong><span>Equipos</span></div><div><strong>01</strong><span>Categoría</span></div><div><strong>∞</strong><span>Posibilidades</span></div></div>
        </div>
      </section>

      <section className="rs-wrap rs-shortcuts" aria-label="Explora RoboScore">{shortcuts.map((item,index) => <a href={item.href} className="rs-shortcut" key={item.title}><span className={`rs-shortcut-icon color-${index}`}><Icon name={item.icon}/></span><span><strong>{item.title}</strong><small>{item.text}</small></span><span className="rs-shortcut-arrow">↗</span></a>)}</section>

      <section id="ranking" className="rs-ranking-section"><div className="rs-wrap"><div className="rs-section-heading"><div><span className="rs-eyebrow">EL ESFUERZO TIENE SU LUGAR</span><h2>Cada punto, una historia.</h2></div><span className="rs-outline-badge"><span/> Resultados de ejemplo</span></div>
        <div className="rs-ranking-layout"><aside className="rs-ranking-aside"><span className="rs-icon-tile"><Icon name="trophy"/></span><h3>Así va la<br/>competencia.</h3><p>Ideas que se ponen a prueba.<br/>Equipos que van por más.</p><div className="rs-aside-event"><small>ESTÁS VIENDO</small><strong>RoboKids Challenge</strong><span>Mini Sumo · Neiva</span></div><a className="rs-text-link" href="#retos">Conoce el reto <Icon name="arrow"/></a><p className="rs-demo-note">Esta es una demostración.<br/>Las puntuaciones aún no son en vivo.</p></aside>
        <div className="rs-leaderboard"><div className="rs-board-toolbar"><div><h3>Ranking general</h3><p>Mini Sumo <span>·</span> 4 equipos</p></div><label className="rs-search"><Icon name="search"/><input type="search" aria-label="Buscar equipo o institución" placeholder="Buscar equipo…" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
          <div className="rs-table-scroll"><table className="rs-table"><caption className="rs-sr-only">Clasificación de ejemplo de Mini Sumo. Puntuación máxima: 100 puntos.</caption><thead><tr><th scope="col">POS.</th><th scope="col">EQUIPO</th><th scope="col" className="rs-performance">PUNTUACIÓN / 100</th><th scope="col">PUNTOS</th></tr></thead><tbody>{results.map(team => { const position=teams.indexOf(team)+1;return <tr key={team.name} className={position===1 ? 'rs-first' : ''}><td><span className={`rs-position ${position===1 ? 'rs-gold' : ''}`}>{position===1 ? <Icon name="trophy"/> : String(position).padStart(2,'0')}<span className="rs-sr-only">Posición {position}</span></span></td><td><div className="rs-team-cell"><span className={`rs-avatar ${team.color}`}>{team.initials}</span><div><strong>{team.name}</strong><small>{team.school}</small></div></div></td><td className="rs-performance"><div className="rs-track" aria-hidden="true"><span style={{width:`${team.score}%`}}/></div></td><td className="rs-points">{team.score}<small>pts</small></td></tr>;})}</tbody></table></div>
          {results.length===0 && <div className="rs-empty"><Icon name="search"/><strong>No encontramos ese equipo</strong><p>Prueba con otro nombre o institución.</p><button className="rs-button rs-secondary" onClick={()=>setQuery('')}>Mostrar todos</button></div>}
          <div className="rs-board-bottom"><span role="status">{results.length} de 4 equipos</span><a href="#equipos">Conoce a los participantes <Icon name="arrow"/></a></div>
        </div></div>
      </div></section>

      <section id="equipos" className="rs-wrap rs-teams-section"><div className="rs-section-heading"><div><span className="rs-eyebrow">EL TALENTO DETRÁS DE CADA ROBOT</span><h2>Mentes curiosas. Grandes equipos.</h2></div><span className="rs-subtle">4 equipos de ejemplo</span></div><div className="rs-team-grid">{teams.map((team,index)=><article className="rs-team-card" key={team.name}><div className="rs-team-card-top"><span className={`rs-avatar ${team.color}`}>{team.initials}</span><span className="rs-team-number">TEAM / 0{index+1}</span></div><h3>{team.name}</h3><p>{team.school}</p><div className="rs-team-card-bottom"><span><Icon name="robot"/> {team.robot}</span><span>Mini Sumo</span></div></article>)}</div></section>

      <section id="retos" className="rs-wrap rs-challenge-section"><div className="rs-challenge-label"><span className="rs-eyebrow">EL RETO</span><h2>Pequeño robot.<br/>Gran estrategia.</h2><span className="rs-category">MINI SUMO</span></div><div className="rs-challenge-copy"><p>Dos robots, una pista circular y un objetivo: sacar al oponente del área de combate. Aquí, cada sensor y cada línea de código cuentan.</p><div className="rs-challenge-steps"><span><strong>01</strong> Diseña</span><span><strong>02</strong> Programa</span><span><strong>03</strong> Compite</span></div></div></section>

      <section id="administracion" className="rs-wrap rs-admin-section"><div className="rs-admin-banner"><div><span className="rs-eyebrow">PARA QUIENES LO HACEN POSIBLE</span><h2>La próxima gran competencia<br/>empieza contigo.</h2><p>Un espacio para organizar eventos, equipos y jueces.</p></div><div className="rs-admin-action"><a className="rs-coming-soon" href="/login"><Icon name="flag"/> Ingresar a mi cuenta</a><small>Acceso para organizadores y jueces</small></div></div></section>
    </main>
    <footer className="rs-wrap rs-footer"><a className="rs-logo" href="#inicio"><span className="rs-logo-icon"><Icon name="robot"/></span>Robo<span>Score.</span></a><p>Hecho para quienes construyen el futuro.</p><span>© 2026 RoboScore · Demo</span></footer>
  </div>;
}
