'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './page.module.css';

/* ── Status badge config ───────────────────────────────── */
const STATUS_CONFIG = {
  ACTIVE:          { label: 'ACTIF',       cls: 'active',   icon: '✓' },
  PENDING_PAYMENT: { label: 'EN ATTENTE',  cls: 'pending',  icon: '◷' },
  DRAFT:           { label: 'BROUILLON',   cls: 'pending',  icon: '◷' },
  ENDED:           { label: 'EXPIRÉ',      cls: 'ended',    icon: '○' },
  CANCELED:        { label: 'ANNULÉ',      cls: 'inactive', icon: '✕' },
};

/* ── Date formatter ────────────────────────────────────── */
function fmtDate(s) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return s; }
}

/* ── Extract UUID from raw QR text ────────────────────── */
function extractId(text) {
  const m = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : text.trim();
}

/* ── Initials from name object ─────────────────────────── */
function getInitials(name) {
  return [name?.first?.[0], name?.last?.[0]].filter(Boolean).join('').toUpperCase() || '?';
}

/* ════════════════════════════════════════════════════════
   COMPONENTS
════════════════════════════════════════════════════════ */

function Badge({ status, large = false }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'inactive', icon: '?' };
  return (
    <span className={`${styles.badge} ${styles[`badge_${cfg.cls}`]} ${large ? styles.badgeLarge : ''}`}>
      <span>{cfg.icon}</span> {cfg.label}
    </span>
  );
}

function InfoRow({ icon, label, value }) {
  if (!value || value === '—') return null;
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}

function PlanCard({ order }) {
  const start = fmtDate(order.startDate);
  const end   = fmtDate(order.endDate);
  return (
    <div className={styles.planCard}>
      <div className={styles.planTop}>
        <span className={styles.planName}>{order.planName || `Plan ${order.planId?.slice(0,8)}…`}</span>
        <Badge status={order.status} />
      </div>
      <div className={styles.planDates}>
        {start && <span>📅 Début : {start}</span>}
        {end   && <span>→ Fin : {end}</span>}
      </div>
    </div>
  );
}

function MemberCard({ data, onReset }) {
  const { contact, orders } = data;
  const fullName = [contact.name?.first, contact.name?.last].filter(Boolean).join(' ') || 'Membre inconnu';
  const hasActive = orders.some(o => o.status === 'ACTIVE');

  return (
    <div className={styles.resultCard}>
      {/* Header */}
      <div className={styles.memberHeader}>
        <div className={styles.avatar}>{getInitials(contact.name)}</div>
        <div className={styles.memberInfo}>
          <div className={styles.memberName}>{fullName}</div>
          <div className={styles.memberId}>{contact.id?.slice(0,8)}…{contact.id?.slice(-4)}</div>
        </div>
        <Badge status={hasActive ? 'ACTIVE' : 'CANCELED'} large />
      </div>

      {/* Contact */}
      <div className={styles.divider}>Contact</div>
      <InfoRow icon="✉" label="Email"     value={contact.email} />
      <InfoRow icon="☎" label="Téléphone" value={contact.phone} />

      {/* Plans */}
      <div className={styles.divider}>Plans</div>
      {orders.length === 0
        ? <p className={styles.noPlans}>Aucun plan trouvé pour ce contact.</p>
        : orders.map(o => <PlanCard key={o.id} order={o} />)
      }

      <button className={styles.resetBtn} onClick={onReset}>
        ↺ Scanner un autre membre
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */
export default function ScannerPage() {
  const [tab, setTab]         = useState('scan'); // 'scan' | 'manual'
  const [manualId, setManualId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);   // { contact, orders }
  const [error, setError]     = useState(null);
  const [scanMsg, setScanMsg] = useState('Pointez la caméra vers le QR code du membre…');
  const [scanOk, setScanOk]   = useState(false);

  const scannerRef = useRef(null);
  const scannerEl  = useRef(null);
  const cooldown   = useRef(false);

  /* ── API call ─────────────────────────────────────────── */
  const fetchMember = useCallback(async (contactId) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/member?contactId=${encodeURIComponent(contactId)}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── QR scanner lifecycle ─────────────────────────────── */
  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;
    const { Html5Qrcode } = await import('html5-qrcode');
    const qr = new Html5Qrcode('qr-reader');
    scannerRef.current = qr;

    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 160 }, aspectRatio: 1.5 },
        (text) => {
          if (cooldown.current || loading || result) return;
          cooldown.current = true;
          const id = extractId(text);
          setScanMsg('QR détecté — recherche en cours…');
          setScanOk(true);
          fetchMember(id);
          setTimeout(() => {
            cooldown.current = false;
            setScanOk(false);
            setScanMsg('Pointez la caméra vers le QR code du membre…');
          }, 6000);
        },
        () => {}
      );
    } catch {
      setScanMsg('Accès caméra refusé — utilisez la saisie manuelle.');
    }
  }, [fetchMember, loading, result]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  }, []);

  /* Start/stop based on tab */
  useEffect(() => {
    if (tab === 'scan' && !result && !loading) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* Stop scanner once we have a result */
  useEffect(() => {
    if (result || error) stopScanner();
  }, [result, error, stopScanner]);

  function reset() {
    setResult(null);
    setError(null);
    setManualId('');
    setScanMsg('Pointez la caméra vers le QR code du membre…');
    setScanOk(false);
    cooldown.current = false;
    if (tab === 'scan') startScanner();
  }

  function handleManualSubmit() {
    const id = manualId.trim();
    if (!id) return;
    fetchMember(extractId(id));
  }

  /* ── Render ───────────────────────────────────────────── */
  return (
    <main className={styles.main}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>8848 Club · Casablanca</div>
        <h1 className={styles.title}>Scanner Membres</h1>
        <p className={styles.subtitle}>Scannez le QR code pour vérifier le plan</p>
      </header>

      {/* Tabs */}
      {!result && !loading && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'scan' ? styles.tabActive : ''}`}
            onClick={() => setTab('scan')}
          >
            📷 Scanner QR
          </button>
          <button
            className={`${styles.tab} ${tab === 'manual' ? styles.tabActive : ''}`}
            onClick={() => setTab('manual')}
          >
            ⌨ Saisir ID
          </button>
        </div>
      )}

      {/* Camera panel */}
      {tab === 'scan' && !result && !loading && (
        <div className={styles.card}>
          <div className={styles.cardLabel}>📷 Caméra</div>
          <div id="qr-reader" ref={scannerEl} className={styles.qrReader} />
          <div className={`${styles.scanStatus} ${scanOk ? styles.scanStatusOk : ''}`}>
            <span className={scanOk ? '' : styles.dot} />
            {scanMsg}
          </div>
        </div>
      )}

      {/* Manual panel */}
      {tab === 'manual' && !result && !loading && (
        <div className={styles.card}>
          <div className={styles.cardLabel}>🪪 Contact ID</div>
          <div className={styles.manualRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              spellCheck={false}
              autoCapitalize="none"
            />
            <button className={styles.btn} onClick={handleManualSubmit} disabled={!manualId.trim()}>
              🔍
            </button>
          </div>
          <p className={styles.hint}>Collez le Contact ID Wix issu du QR code</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.card}>
          <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Récupération des données…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={styles.card}>
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>⚠</span>
            <div>
              <div className={styles.errorTitle}>Échec de la recherche</div>
              <div className={styles.errorDetail}>{error}</div>
              <div className={styles.errorHint}>Vérifiez le Contact ID et la configuration Wix.</div>
            </div>
          </div>
          <button className={styles.resetBtn} onClick={reset}>↺ Réessayer</button>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <MemberCard data={result} onReset={reset} />
      )}

    </main>
  );
}
