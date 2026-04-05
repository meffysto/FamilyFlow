import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './NightMode.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedSide = 'gauche' | 'droite' | 'biberon';
type FeedState = 'idle' | 'timing' | 'paused';

interface NightFeedEntry {
  id: string;
  startTime: Date;
  endTime?: Date;
  side: FeedSide;
  durationSec?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getGapLabel(prevEnd: Date, nextStart: Date): string {
  const diffSec = Math.round((nextStart.getTime() - prevEnd.getTime()) / 1000);
  const m = Math.floor(diffSec / 60);
  return `Intervalle : ${m} min`;
}

// ---------------------------------------------------------------------------
// Main NightMode page
// ---------------------------------------------------------------------------

export default function NightMode() {
  const { t } = useTranslation('common');

  // Clock
  const [now, setNow] = useState<Date>(new Date());

  // Feed session
  const [feedState, setFeedState] = useState<FeedState>('idle');
  const [side, setSide] = useState<FeedSide>('gauche');
  const [elapsed, setElapsed] = useState(0);
  const [feeds, setFeeds] = useState<NightFeedEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<NightFeedEntry | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);

  // ── Clock — tick every second ─────────────────────────────────────────────

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // ── Timer logic ───────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000);
      setElapsed(sec);
    }, 1000);
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleStartFeed = useCallback(() => {
    const entry: NightFeedEntry = {
      id: String(Date.now()),
      startTime: new Date(),
      side,
    };
    setCurrentEntry(entry);
    setElapsed(0);
    pausedElapsedRef.current = 0;
    setFeedState('timing');
    startTimer();
  }, [side, startTimer]);

  const handlePause = useCallback(() => {
    stopTimer();
    pausedElapsedRef.current = elapsed;
    setFeedState('paused');
  }, [stopTimer, elapsed]);

  const handleResume = useCallback(() => {
    setFeedState('timing');
    startTimer();
  }, [startTimer]);

  const handleEndFeed = useCallback(() => {
    stopTimer();
    if (currentEntry) {
      const endTime = new Date();
      const completed: NightFeedEntry = {
        ...currentEntry,
        endTime,
        durationSec: elapsed,
      };
      setFeeds((prev) => [completed, ...prev]);
    }
    setCurrentEntry(null);
    setElapsed(0);
    pausedElapsedRef.current = 0;
    setFeedState('idle');
  }, [stopTimer, currentEntry, elapsed]);

  const handleReset = useCallback(() => {
    stopTimer();
    setCurrentEntry(null);
    setElapsed(0);
    pausedElapsedRef.current = 0;
    setFeedState('idle');
  }, [stopTimer]);

  const handleClearHistory = useCallback(() => {
    setFeeds([]);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="nightmode-container">
      {/* Clock */}
      <div className="nightmode-clock">
        {formatTime(now)}
      </div>
      <div className="nightmode-date">
        {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </div>

      {/* Side selector */}
      {feedState === 'idle' && (
        <div className="nightmode-side-selector">
          <span className="nightmode-side-label">{t('nightMode.side', 'Côté')}</span>
          <div className="nightmode-side-buttons">
            {(['gauche', 'droite', 'biberon'] as FeedSide[]).map((s) => (
              <button
                key={s}
                className={`nightmode-side-btn ${side === s ? 'nightmode-side-btn--active' : ''}`}
                onClick={() => setSide(s)}
              >
                {s === 'gauche' ? '◀ Gauche' : s === 'droite' ? 'Droite ▶' : '🍼 Biberon'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timer display */}
      {feedState !== 'idle' && (
        <div className="nightmode-timer">
          <div className="nightmode-timer-label">
            {feedState === 'paused' ? '⏸ En pause' : `${side === 'gauche' ? '◀ Gauche' : side === 'droite' ? 'Droite ▶' : '🍼 Biberon'}`}
          </div>
          <div className="nightmode-timer-value">{formatDuration(elapsed)}</div>
          {currentEntry && (
            <div className="nightmode-timer-start">Début : {formatTimeShort(currentEntry.startTime)}</div>
          )}
        </div>
      )}

      {/* Main action buttons */}
      <div className="nightmode-actions">
        {feedState === 'idle' && (
          <button className="nightmode-btn nightmode-btn--start" onClick={handleStartFeed}>
            {t('nightMode.startFeed', 'Début tétée')}
          </button>
        )}

        {feedState === 'timing' && (
          <>
            <button className="nightmode-btn nightmode-btn--pause" onClick={handlePause}>
              {t('nightMode.pause', '⏸ Pause')}
            </button>
            <button className="nightmode-btn nightmode-btn--end" onClick={handleEndFeed}>
              {t('nightMode.endFeed', 'Fin tétée')}
            </button>
          </>
        )}

        {feedState === 'paused' && (
          <>
            <button className="nightmode-btn nightmode-btn--start" onClick={handleResume}>
              {t('nightMode.resume', '▶ Reprendre')}
            </button>
            <button className="nightmode-btn nightmode-btn--end" onClick={handleEndFeed}>
              {t('nightMode.endFeed', 'Fin tétée')}
            </button>
            <button className="nightmode-btn nightmode-btn--reset" onClick={handleReset}>
              {t('nightMode.cancel', 'Annuler')}
            </button>
          </>
        )}
      </div>

      {/* Night history */}
      {feeds.length > 0 && (
        <div className="nightmode-history">
          <div className="nightmode-history-header">
            <span className="nightmode-history-title">
              {t('nightMode.nightHistory', 'Tétées de la nuit')} ({feeds.length})
            </span>
            <button className="nightmode-clear-btn" onClick={handleClearHistory}>
              Effacer
            </button>
          </div>
          <div className="nightmode-history-list">
            {feeds.map((feed, idx) => (
              <div key={feed.id} className="nightmode-feed-row">
                {idx > 0 && feeds[idx - 1].endTime && (
                  <div className="nightmode-gap">
                    {getGapLabel(feeds[idx - 1].endTime!, feed.startTime)}
                  </div>
                )}
                <div className="nightmode-feed-entry">
                  <span className="nightmode-feed-side">
                    {feed.side === 'gauche' ? '◀' : feed.side === 'droite' ? '▶' : '🍼'}
                    &nbsp;{feed.side}
                  </span>
                  <span className="nightmode-feed-time">{formatTimeShort(feed.startTime)}</span>
                  {feed.endTime && (
                    <>
                      <span className="nightmode-feed-arrow">→</span>
                      <span className="nightmode-feed-time">{formatTimeShort(feed.endTime)}</span>
                    </>
                  )}
                  {feed.durationSec != null && (
                    <span className="nightmode-feed-dur">{formatDuration(feed.durationSec)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
