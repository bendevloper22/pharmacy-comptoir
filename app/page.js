'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { LISTE_VALUES, GENDER_VALUES, TAB_LABELS } from '../lib/labels';

function typeClass(t) {
  if (t === 'Générique') return 'type-generique';
  if (t === 'Princeps') return 'type-princeps';
  return '';
}
function chifaClass(status) {
  if (status === 'Remboursable') return 'chifa-yes';
  if (status === 'Non remboursable') return 'chifa-no';
  return 'chifa-unknown';
}

export default function Page() {
  const [dbStatus, setDbStatus] = useState('loading'); // loading | ok | error
  const [counts, setCounts] = useState({ active: 0, nr: 0, rt: 0, fav: 0 });
  const [categories, setCategories] = useState([]);
  const [subfamilies, setSubfamilies] = useState([]);

  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const [listeFilter, setListeFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [ruptureFilter, setRuptureFilter] = useState(false);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [equivDci, setEquivDci] = useState(null);
  const [equivProducts, setEquivProducts] = useState([]);
  const [openNotes, setOpenNotes] = useState({}); // { productId: true }

  const [multiMode, setMultiMode] = useState(false);
  const [multiText, setMultiText] = useState('');
  const [multiResults, setMultiResults] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);

  // autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [suggestFor, setSuggestFor] = useState(null); // 'single' | 'multi' | null
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const suggestTimer = useRef(null);
  const suggestSeq = useRef(0);
  const multiRef = useRef(null);
  const multiSegRange = useRef({ start: 0, end: 0 });

  const recentTimer = useRef(null);
  const noteTimers = useRef({});

  // ---- meta (counts + categories) ----
  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/meta');
      if (!res.ok) throw new Error('meta fetch failed');
      const data = await res.json();
      setCounts(data.counts);
      setCategories(data.categories);
      setDbStatus('ok');
    } catch (e) {
      console.error(e);
      setDbStatus('error');
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  useEffect(() => {
    fetch('/api/recent').then(r => r.json()).then(d => setRecent(d.recent || [])).catch(() => {});
  }, []);

  // ---- subfamilies for the selected category ----
  useEffect(() => {
    if (!catFilter) { setSubfamilies([]); return; }
    fetch(`/api/subfamilies?cat=${encodeURIComponent(catFilter)}`)
      .then(r => r.json())
      .then(d => setSubfamilies(d.subfamilies || []))
      .catch(() => setSubfamilies([]));
  }, [catFilter]);

  // ---- main product fetch ----
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab, q: query, cat: catFilter, sub: subFilter,
        liste: listeFilter, gender: genderFilter,
        rupture: ruptureFilter ? '1' : '0',
        limit: (query || catFilter || listeFilter || genderFilter || ruptureFilter) ? '200' : '40',
      });
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);
      setDbStatus('ok');
    } catch (e) {
      console.error(e);
      setDbStatus('error');
    } finally {
      setLoading(false);
    }
  }, [tab, query, catFilter, subFilter, listeFilter, genderFilter, ruptureFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ---- autocomplete ----
  function closeSuggestions() {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestSeq.current += 1; // invalidate any in-flight response
    setSuggestions([]);
    setSuggestFor(null);
    setActiveSuggest(-1);
  }

  function fetchSuggestions(text, target) {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const t = (text || '').trim();
    if (!t) { closeSuggestions(); return; }
    const seq = ++suggestSeq.current;
    suggestTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?tab=${encodeURIComponent(tab)}&q=${encodeURIComponent(t)}`);
        const data = await res.json();
        if (seq !== suggestSeq.current) return; // a newer keystroke superseded this one
        const list = data.suggestions || [];
        // hide the dropdown if the only suggestion is exactly what's typed
        const filtered = list.filter(s => s.label.toLowerCase() !== t.toLowerCase());
        setSuggestions(filtered);
        setSuggestFor(filtered.length ? target : null);
        setActiveSuggest(-1);
      } catch (e) {
        if (seq === suggestSeq.current) closeSuggestions();
      }
    }, 150);
  }

  function pickSingleSuggestion(label) {
    closeSuggestions();
    setQuery(label);
    setEquivDci(null);
    fetch('/api/recent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: label }),
    }).then(r => r.json()).then(d => setRecent(d.recent || [])).catch(() => {});
  }

  function onSingleKeyDown(e) {
    if (suggestFor !== 'single' || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggest(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggest(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeSuggest >= 0) {
      e.preventDefault();
      pickSingleSuggestion(suggestions[activeSuggest].label);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  }

  // Multi-search: figure out which comma/newline-separated segment the caret is in.
  function updateMultiSegment(value, pos) {
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = value.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = value.length;

    const before = value.slice(lineStart, pos);
    const lastComma = before.lastIndexOf(',');
    let segStart = lastComma === -1 ? lineStart : lineStart + lastComma + 1;
    while (segStart < pos && value[segStart] === ' ') segStart += 1;

    let segEnd = value.indexOf(',', pos);
    if (segEnd === -1 || segEnd > lineEnd) segEnd = lineEnd;

    multiSegRange.current = { start: segStart, end: segEnd };
    return value.slice(segStart, pos);
  }

  function onMultiChange(e) {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setMultiText(value);
    const partial = updateMultiSegment(value, pos);
    fetchSuggestions(partial, 'multi');
  }

  function pickMultiSuggestion(label) {
    const { start, end } = multiSegRange.current;
    const newText = multiText.slice(0, start) + label + multiText.slice(end);
    setMultiText(newText);
    closeSuggestions();
    const caret = start + label.length;
    requestAnimationFrame(() => {
      const el = multiRef.current;
      if (el) { el.focus(); el.setSelectionRange(caret, caret); }
    });
  }

  function onMultiKeyDown(e) {
    if (suggestFor !== 'multi' || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggest(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggest(i => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && activeSuggest >= 0) {
      e.preventDefault();
      pickMultiSuggestion(suggestions[activeSuggest].label);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  }

  function renderSuggestList(target, onPick) {
    if (suggestFor !== target || suggestions.length === 0) return null;
    return (
      <ul className="suggest-list" role="listbox">
        {suggestions.map((s, i) => (
          <li
            key={`${s.kind}-${s.label}`}
            role="option"
            aria-selected={i === activeSuggest}
            className={`suggest-item ${i === activeSuggest ? 'active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onPick(s.label); }}
            onMouseEnter={() => setActiveSuggest(i)}
          >
            <span>{s.label}</span>
            <span className="suggest-kind">{s.kind === 'dci' ? 'DCI' : 'marque'}</span>
          </li>
        ))}
      </ul>
    );
  }

  // ---- search input: debounce fetch + debounce "recent" logging ----
  function onSearchChange(v) {
    setQuery(v);
    setEquivDci(null);
    fetchSuggestions(v, 'single');
    if (recentTimer.current) clearTimeout(recentTimer.current);
    if (v.trim()) {
      recentTimer.current = setTimeout(() => {
        fetch('/api/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: v.trim() }),
        }).then(r => r.json()).then(d => setRecent(d.recent || [])).catch(() => {});
      }, 900);
    }
  }

  function switchTab(t) {
    closeSuggestions();
    setTab(t);
    setQuery('');
    setEquivDci(null);
  }

  function toggleCat(code) {
    setCatFilter(prev => (prev === code ? '' : code));
    setSubFilter('');
  }

  async function openEquivalents(dci) {
    setEquivDci(dci);
    try {
      const res = await fetch(`/api/equivalents?dci=${encodeURIComponent(dci)}`);
      const data = await res.json();
      setEquivProducts(data.products || []);
    } catch (e) {
      console.error(e);
    }
  }

  // ---- mutations, with optimistic local update ----
  function patchProduct(id, patch) {
    setProducts(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)));
    setEquivProducts(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)));
    setMultiResults(groups =>
      groups
        ? groups.map(g => ({ ...g, products: g.products.map(p => (p.id === id ? { ...p, ...patch } : p)) }))
        : groups
    );
  }

  async function runMultiSearch() {
    const terms = multiText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    if (terms.length === 0) { setMultiResults(null); return; }
    setMultiLoading(true);
    try {
      const res = await fetch('/api/multi-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms, tab }),
      });
      const data = await res.json();
      setMultiResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMultiLoading(false);
    }
  }

  function toggleMultiMode() {
    closeSuggestions();
    setMultiMode(m => !m);
    setMultiResults(null);
    setEquivDci(null);
  }

  async function toggleFav(p) {
    patchProduct(p.id, { isFav: !p.isFav });
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: p.tab, marque: p.marque, dci: p.dci }),
      });
      const data = await res.json();
      patchProduct(p.id, { isFav: data.isFav });
      loadMeta();
    } catch (e) { console.error(e); }
  }

  async function cycleChifa(p) {
    try {
      const res = await fetch('/api/chifa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: p.tab, marque: p.marque, dci: p.dci }),
      });
      const data = await res.json();
      patchProduct(p.id, { chifaStatus: data.chifaStatus });
    } catch (e) { console.error(e); }
  }

  async function toggleRupture(p) {
    patchProduct(p.id, { isRupture: !p.isRupture });
    try {
      const res = await fetch('/api/rupture', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: p.tab, marque: p.marque, dci: p.dci }),
      });
      const data = await res.json();
      patchProduct(p.id, { isRupture: data.isRupture });
    } catch (e) { console.error(e); }
  }

  function onNoteChange(p, text) {
    patchProduct(p.id, { note: text });
    if (noteTimers.current[p.id]) clearTimeout(noteTimers.current[p.id]);
    noteTimers.current[p.id] = setTimeout(async () => {
      try {
        await fetch('/api/notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: p.tab, marque: p.marque, dci: p.dci, text }),
        });
      } catch (e) { console.error(e); }
    }, 500);
  }

  const listToShow = equivDci ? equivProducts : products;
  const equivLabel = tab === 'active' ? 'Voir les équivalents →' : 'Voir en vente →';

  function renderCard(p) {
    return (
      <div key={p.id} className={`card ${p.isRupture ? 'card-rupture' : ''}`}>
        <div className="card-top">
          <div className="brand-row">
            <button className={`icon-btn star ${p.isFav ? 'active' : ''}`} onClick={() => toggleFav(p)}>
              {p.isFav ? '★' : '☆'}
            </button>
            <button
              className={`icon-btn note-btn ${p.note && p.note.trim() ? 'active' : ''}`}
              onClick={() => setOpenNotes(o => ({ ...o, [p.id]: !o[p.id] }))}
              title="Note personnelle"
            >✎</button>
            <span className="brand">{p.marque}</span>
          </div>
          <div className="tags">
            <span className="tag liste">{p.liste}</span>
            <span className={`tag ${typeClass(p.type)}`}>{p.type}</span>
            {p.gender && p.gender !== 'Mixte' && <span className="tag gender-tag">{p.gender}</span>}
            {p.tab === 'nr' && <span className="tag status-nr">Non renouvelé</span>}
            {p.tab === 'rt' && <span className="tag status-rt">Retiré</span>}
            <span className={`tag chifa-tag ${chifaClass(p.chifaStatus)}`} onClick={() => cycleChifa(p)}>
              💳 {p.chifaStatus}
            </span>
            <span className={`tag rupture-tag ${p.isRupture ? 'rupture-yes' : ''}`} onClick={() => toggleRupture(p)}>
              {p.isRupture ? '🚫 Rupture' : '✓ En stock'}
            </span>
          </div>
        </div>
        {p.subl && <div className="subfam-row">{p.subl}</div>}
        <div className="dci-row">
          DCI : <strong>{p.dci}</strong>{' '}
          <button className="equiv-link" onClick={() => openEquivalents(p.dci)}>
            {p.tab === 'active' ? 'Voir les équivalents →' : 'Voir en vente →'}
          </button>
        </div>
        <div className="variants">
          {p.variants.map((v, i) => (
            <div key={i} className="variant">
              <b>{v.forme}</b>{v.dosage ? ` — ${v.dosage}` : ''}{v.conditionnement ? ` — ${v.conditionnement}` : ''}
              {v.laboratoire ? ` · ${v.laboratoire}` : ''}
              {v.motif && <div className="motif">{v.date_retrait ? `${v.date_retrait} — ` : ''}{v.motif}</div>}
            </div>
          ))}
        </div>
        {openNotes[p.id] && (
          <textarea
            className="note-textarea"
            placeholder="Note personnelle (fournisseur, rupture fréquente, préférence client...)"
            value={p.note || ''}
            onChange={(e) => onNoteChange(p, e.target.value)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="wrap">
      <header>
        <div className="kicker-row">
          <p className="kicker">NOMENCLATURE NATIONALE — AOÛT 2026 — MINISTÈRE DE L&apos;INDUSTRIE PHARMACEUTIQUE</p>
          <span className={`pill ${dbStatus === 'error' ? 'pill-error' : ''}`}>
            <span className="dot"></span>
            {dbStatus === 'ok' ? 'Base SQLite connectée' : dbStatus === 'error' ? 'Connexion au serveur impossible' : 'Connexion…'}
          </span>
        </div>
        <h1>Nom commercial → DCI</h1>
        <p className="sub">Registre officiel des produits pharmaceutiques, servi par une vraie base SQLite côté serveur (Next.js + libSQL/Turso).</p>
      </header>

      <div className="tabs">
        {['active', 'nr', 'rt', 'fav'].map(t => (
          <div key={t} className={`tab ${tab === t ? 'active-tab' : ''}`} onClick={() => switchTab(t)}>
            <span className="dot"></span>
            {t === 'fav' ? '★ ' : ''}{TAB_LABELS[t]} ({counts[t] || 0})
          </div>
        ))}
      </div>

      <div className="filter-section">
        <p className="filter-label">Mode :</p>
        <div className="chip-row">
          <span className={`chip ${multiMode ? 'selected' : ''}`} onClick={toggleMultiMode}>
            🔎 Recherche multiple
          </span>
        </div>
      </div>

      {!multiMode && (
        <>
          <div className="filter-section">
            <p className="filter-label">Statut réglementaire :</p>
            <div className="chip-row">
              {LISTE_VALUES.map(v => (
                <span key={v} className={`chip ${listeFilter === v ? 'selected' : ''}`}
                  onClick={() => setListeFilter(prev => (prev === v ? '' : v))}>{v}</span>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-label">Cible :</p>
            <div className="chip-row">
              {GENDER_VALUES.map(v => (
                <span key={v} className={`chip ${genderFilter === v ? 'selected' : ''}`}
                  onClick={() => setGenderFilter(prev => (prev === v ? '' : v))}>{v}</span>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-label">Stock :</p>
            <div className="chip-row">
              <span className={`chip ${ruptureFilter ? 'selected' : ''}`} onClick={() => setRuptureFilter(r => !r)}>
                🚫 Ruptures uniquement
              </span>
            </div>
          </div>

          <div className="filter-section">
            <p className="filter-label">Famille thérapeutique :</p>
            <div className="chip-row">
              {categories.map(c => (
                <span key={c.code} className={`chip ${catFilter === c.code ? 'selected' : ''}`}
                  onClick={() => toggleCat(c.code)}>{c.label}</span>
              ))}
            </div>
          </div>

          {catFilter && subfamilies.length > 0 && (
            <div className="filter-section">
              <p className="filter-label">Sous-famille :</p>
              <div className="chip-row">
                {subfamilies.map(s => (
                  <span key={s.code} className={`chip ${subFilter === s.code ? 'selected' : ''}`}
                    onClick={() => setSubFilter(prev => (prev === s.code ? '' : s.code))}>{s.label}</span>
                ))}
              </div>
            </div>
          )}

          <div className="searchbox suggest-wrap">
            <input type="text" placeholder="ex : Doliprane, Augmentin, amoxicilline…" value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={onSingleKeyDown}
              onBlur={closeSuggestions}
              autoComplete="off" spellCheck="false" />
            {renderSuggestList('single', pickSingleSuggestion)}
          </div>

          {!query && !equivDci && recent.length > 0 && (
            <div className="recent-chips">
              {recent.map(q => (
                <span key={q} className="recent-chip" onClick={() => onSearchChange(q)}>{q}</span>
              ))}
            </div>
          )}

          <p className="count">
            {loading ? 'Chargement…' : `${listToShow.length} résultat${listToShow.length > 1 ? 's' : ''}`}
          </p>
        </>
      )}

      {multiMode && (
        <div className="multi-search">
          <p className="filter-label">
            Un médicament par ligne (ou séparés par des virgules) — recherche dans « {TAB_LABELS[tab]} » :
          </p>
          <div className="suggest-wrap">
            <textarea
              ref={multiRef}
              className="multi-textarea"
              placeholder={'Doliprane\nAugmentin\nClamoxyl\nEfferalgan'}
              value={multiText}
              onChange={onMultiChange}
              onKeyDown={onMultiKeyDown}
              onBlur={closeSuggestions}
            />
            {renderSuggestList('multi', pickMultiSuggestion)}
          </div>          <button className="multi-search-btn" onClick={runMultiSearch} disabled={multiLoading}>
            {multiLoading ? 'Recherche…' : `🔎 Rechercher (${multiText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean).length})`}
          </button>

          {multiResults && (
            <div className="multi-results">
              {multiResults.map(group => (
                <div key={group.term} className="multi-group">
                  <div className="multi-group-header">
                    <span className="multi-group-term">{group.term}</span>
                    <span className="multi-group-count">
                      {group.products.length === 0 ? 'aucun résultat' : `${group.products.length} résultat${group.products.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {group.products.length === 0 ? (
                    <div className="empty">Rien trouvé pour « {group.term} » dans cet onglet.</div>
                  ) : (
                    <div className="results">{group.products.map(renderCard)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!multiMode && equivDci && (
        <div className="banner eq">
          Équivalents (même DCI) pour <strong>{equivDci}</strong> — en vente en officine
          <button className="eq-clear" onClick={() => setEquivDci(null)}>✕ quitter</button>
        </div>
      )}
      {!multiMode && !equivDci && tab === 'nr' && (
        <div className="banner nr">Ces produits n&apos;ont pas eu leur décision d&apos;enregistrement renouvelée — à vérifier avant de proposer un équivalent.</div>
      )}
      {!multiMode && !equivDci && tab === 'rt' && (
        <div className="banner rt">Ces produits ont été retirés du marché. Ne pas vendre si trouvé en stock — vérifier avec le pharmacien.</div>
      )}

      {!multiMode && (
        <div className={`results ${equivDci ? 'compact' : ''}`}>
          {listToShow.length === 0 && !loading && (
            <div className="empty">
              {tab === 'fav' ? 'Aucun favori pour l\u2019instant. Cliquez sur ☆ sur une fiche produit.' : 'Aucun résultat.'}
            </div>
          )}
          {equivDci
            ? listToShow.map(p => (
                <div key={p.id} className="equiv-chip">
                  <div className="equiv-chip-top">
                    <span className="equiv-chip-brand">{p.marque}</span>
                    <span className={`tag ${typeClass(p.type)}`}>{p.type}</span>
                  </div>
                  <div className="equiv-chip-dose">
                    {[p.variants[0]?.forme, p.variants[0]?.dosage].filter(Boolean).join(' · ')}
                  </div>
                  <div className="equiv-chip-details">
                    {p.variants.map((v, i) => (
                      <div key={i}>
                        {[v.forme, v.dosage, v.conditionnement].filter(Boolean).join(' — ')}
                        {v.laboratoire ? ` · ${v.laboratoire}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : listToShow.map(renderCard)}
        </div>
      )}

      <footer>
        Source : Nomenclature nationale des produits pharmaceutiques à usage de la médecine humaine, Ministère de l&apos;Industrie Pharmaceutique, version au 31 août 2026. « En vente » = produits actifs disponibles en officine. « Non renouvelés » = décision d&apos;enregistrement arrivée à échéance sans renouvellement. « Retraits » = produits retirés du marché. Les familles thérapeutiques sont un regroupement pratique déduit des codes de classification du fichier — ce ne sont pas des intitulés officiels du ministère. Le badge <strong>💳 Chifa</strong> et les notes ne sont pas des données officielles : vous les renseignez vous-même. Toutes les données (favoris, Chifa, notes, ruptures) vivent dans une vraie base <strong>SQLite</strong> côté serveur (fichier local <code>data/pharmacy.db</code>, ou base Turso si déployé en ligne), partagée par tous les appareils qui accèdent à ce serveur. <strong>Ceci est un registre réglementaire, pas un outil de posologie</strong> — pour toute question clinique, orientez vers le pharmacien.
      </footer>
    </div>
  );
}
