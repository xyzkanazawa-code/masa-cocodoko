import { useState, useEffect } from 'react';
import { TrackingHeader } from './components/TrackingHeader';
import { MapViewer } from './components/MapViewer';
import { SimulatorPanel } from './components/SimulatorPanel';
import { AuthScreen } from './components/AuthScreen';
import { OwnerPortal } from './components/OwnerPortal';
import { subscribeToTracking } from './services/trackingService';
import type { TrackingSession, Owner } from './services/trackingService';
import { AlertCircle, QrCode, Clock, Shield, ShieldAlert } from 'lucide-react';

const OWNER_SESSION_KEY = 'coco-doco-current-owner';

// 日本時間 (JST = UTC+9) の日付を YYYY-MM-DD 形式の文字列で取得するヘルパー
const getJstDateString = () => {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + jstOffset);
  const y = jstDate.getFullYear();
  const m = (jstDate.getMonth() + 1).toString().padStart(2, '0');
  const d = jstDate.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentSessionId, setCurrentSessionId] = useState<string>('bus-01');
  const [session, setSession] = useState<TrackingSession | null>(null);
  
  // 画面モード: 'viewer' (一般地図), 'auth' (ログイン/登録), 'portal' (オーナーダッシュボード)
  const [viewMode, setViewMode] = useState<'viewer' | 'auth' | 'portal'>('viewer');
  
  // ログイン中のオーナー情報
  const [currentOwner, setCurrentOwner] = useState<Owner | null>(null);

  // 閲覧時間制限 (9:00 〜 19:00) の判定
  const [isWithinViewingHours, setIsWithinViewingHours] = useState<boolean>(true);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // お客さまのスキャン後の残り時間制限用
  const [firstScannedTime, setFirstScannedTime] = useState<number | null>(null);
  const [isCustomerSessionExpired, setIsCustomerSessionExpired] = useState<boolean>(false);

  // 1. 初期化: クエリパラメータ・ハッシュパラメータの解析 & オーナーログインの復元
  useEffect(() => {
    // 従来のクエリパラメータ解析
    const searchParams = new URLSearchParams(window.location.search);
    let trackingId = searchParams.get('tracking_id') || searchParams.get('session');
    let role = searchParams.get('role');
    let mode = searchParams.get('mode');
    
    // スマホ404エラー対策：ハッシュパラメータ（#session=...）からも解析を試みる
    if (!trackingId && window.location.hash) {
      try {
        const hashStr = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hashStr);
        trackingId = hashParams.get('tracking_id') || hashParams.get('session');
        if (!role) role = hashParams.get('role');
        if (!mode) mode = hashParams.get('mode');
      } catch (e) {
        console.error('Failed to parse hash parameters:', e);
      }
    }
    
    // オーナーセッション復元
    const storedOwner = localStorage.getItem(OWNER_SESSION_KEY);
    let ownerRestored = false;
    
    if (storedOwner) {
      try {
        const owner = JSON.parse(storedOwner);
        setCurrentOwner(owner);
        setViewMode('portal');
        ownerRestored = true;
      } catch (e) {
        localStorage.removeItem(OWNER_SESSION_KEY);
      }
    }

    if (trackingId) {
      setCurrentSessionId(trackingId);
      if (!ownerRestored) {
        setViewMode('viewer');
      }
    } else {
      // パラメータがない場合
      if (ownerRestored) {
        setViewMode('portal');
      } else if (role === 'owner' || mode === 'auth') {
        setViewMode('auth');
      } else {
        // パラメータもログイン情報も無い素のURLの場合は、自動的にオーナーログイン/登録画面にする
        // これにより、マサさんが素のURLを踏んだ時に直接「登録・ログイン画面」から始まります。
        setViewMode('auth');
      }
    }
  }, []);

  // 2. 閲覧時間帯 (9:00 〜 19:00) のリアルタイム監視タイマー (日本標準時 JST に準拠)
  useEffect(() => {
    const checkViewingHours = () => {
      const now = new Date();
      
      // クライアントのローカル環境を問わず、常にUTC基準から日本時間 (JST = UTC+9) の時刻を安全に計算します
      // (Intl.DateTimeFormatなどの不安定なAPIを使わない超安全設計)
      const jstOffset = 9 * 60 * 60 * 1000; // JSTはUTC+9時間
      const jstDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + jstOffset);
      
      const hours = jstDate.getHours();
      const minutes = jstDate.getMinutes();
      
      // 9:00 から 18:00 (18:00ちょうど以降は時間外)
      const within = hours >= 9 && hours < 18;
      setIsWithinViewingHours(within);

      // 表示用の現在時刻
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCurrentTimeStr(`${pad(hours)}:${pad(minutes)}`);
    };

    checkViewingHours();
    // 10秒ごとに時間制限を再判定
    const interval = setInterval(checkViewingHours, 10000);
    return () => clearInterval(interval);
  }, []);

  // 3. セッション切り替え時のURL書き換え（ハッシュ方式に統一してサーバー404を回避）
  const handleSessionChange = (id: string) => {
    setCurrentSessionId(id);
    const newUrl = `${window.location.origin}${window.location.pathname}#session=${id}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  };

  // 4. 位置情報のリアルタイム購読（監視）
  useEffect(() => {
    const unsubscribe = subscribeToTracking(currentSessionId, (data) => {
      setSession(data);
    });

    return () => unsubscribe();
  }, [currentSessionId]);

  // お客さん（一般閲覧者）のスキャン開始制限タイマー
  useEffect(() => {
    if (!session || viewMode !== 'viewer') {
      setIsCustomerSessionExpired(false);
      setFirstScannedTime(null);
      return;
    }

    // URLハッシュから最新の cb パラメータ（スキャン時のタイムスタンプ）を解析
    let currentCb: string | null = null;
    if (window.location.hash) {
      try {
        const hashStr = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hashStr);
        currentCb = hashParams.get('cb');
      } catch (e) {
        console.error('Failed to parse cb from hash:', e);
      }
    }

    const keyScanTime = `coco-doco-scanned-time-${session.id}`;
    const keyScanDate = `coco-doco-scanned-date-${session.id}`;
    const keyLastCb = `coco-doco-scanned-cb-${session.id}`;

    const storedScanTime = localStorage.getItem(keyScanTime);
    const storedScanDate = localStorage.getItem(keyScanDate);
    const storedLastCb = localStorage.getItem(keyLastCb);
    const todayStr = getJstDateString();

    let scanTime = storedScanTime ? parseInt(storedScanTime, 10) : null;

    // 日付が変わっている場合は、以前のスキャンデータを無効化する
    const isDifferentDate = storedScanDate && storedScanDate !== todayStr;

    // 新規スキャン判定：
    // A. まだスキャン記録がない場合
    // B. スキャンした日付が今日と異なる場合（＝翌日以降のアクセス）
    // C. URLに新しい cb が含まれており、それが以前記録した cb と異なる場合
    const isNewScan = !scanTime || isDifferentDate || (currentCb && currentCb !== storedLastCb);

    if (isNewScan) {
      scanTime = Date.now();
      localStorage.setItem(keyScanTime, scanTime.toString());
      localStorage.setItem(keyScanDate, todayStr);
      if (currentCb) {
        localStorage.setItem(keyLastCb, currentCb);
      } else {
        localStorage.removeItem(keyLastCb);
      }
      
      // 従来の古いキー（もし残っていれば）をクリーンアップ
      localStorage.removeItem(`coco-doco-scanned-${session.id}`);
    }
    
    setFirstScannedTime(scanTime);

    const checkExpiry = () => {
      // 日付が昨日以前のものであれば強制的に期限切れ
      const savedDate = localStorage.getItem(keyScanDate);
      if (savedDate !== todayStr) {
        setIsCustomerSessionExpired(true);
        return;
      }

      const limitMinutes = session.durationMinutes || 60;
      const expiryTime = scanTime! + limitMinutes * 60 * 1000;
      const expired = Date.now() > expiryTime;
      setIsCustomerSessionExpired(expired);
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.durationMinutes, viewMode]);

  // 5. 地図テーマ切り替え（ユーザー要望）
  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // 6. 初期テーマのセットアップ
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // 6.5. 画面モードに応じて html, body, #root のスクロール制限を動的に制御
  // 地図ビューア(viewer)の時はフルスクリーン固定(hidden)にしますが、
  // ログイン登録画面(auth)やポータル画面(portal)の時はスマホでスクロールできるようにします。
  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const rootEl = document.getElementById('root');

    if (viewMode === 'auth') {
      htmlEl.style.overflow = 'auto';
      htmlEl.style.height = 'auto';
      htmlEl.style.minHeight = '100%';
      bodyEl.style.overflow = 'auto';
      bodyEl.style.height = 'auto';
      bodyEl.style.minHeight = '100%';
      if (rootEl) {
        rootEl.style.overflow = 'visible';
        rootEl.style.height = 'auto';
        rootEl.style.minHeight = '100%';
      }
    } else {
      // viewer または portal の場合（地図を表示する画面）
      htmlEl.style.overflow = 'hidden';
      htmlEl.style.height = '100%';
      bodyEl.style.overflow = 'hidden';
      bodyEl.style.height = '100%';
      if (rootEl) {
        rootEl.style.overflow = 'hidden';
        rootEl.style.height = '100%';
      }
    }

    // クリーンアップ時にもとに戻す
    return () => {
      htmlEl.style.overflow = '';
      htmlEl.style.height = '';
      bodyEl.style.overflow = '';
      bodyEl.style.height = '';
      if (rootEl) {
        rootEl.style.overflow = '';
        rootEl.style.height = '';
      }
    };
  }, [viewMode]);

  // 7. オーナー関連アクション
  const handleAuthSuccess = (owner: Owner) => {
    setCurrentOwner(owner);
    localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(owner));
    setViewMode('portal');
  };

  const handleLogout = () => {
    localStorage.removeItem(OWNER_SESSION_KEY);
    setCurrentOwner(null);
    setViewMode('viewer');
  };

  // 閲覧可能かどうか
  // 一般閲覧画面では、9:00〜19:00の営業時間外は制限されますが、
  // 管理者（オーナー）がログインしている状態であれば、夜間テストやデモのために自動的に制限をバイパス（解除）します。
  const showViewerContent = 
    isWithinViewingHours || 
    viewMode !== 'viewer' ||
    currentOwner !== null;

  return (
    <div className="app-container">
      {/* 1. オーナーログイン・登録画面 */}
      {viewMode === 'auth' && (
        <AuthScreen 
          onSuccess={handleAuthSuccess} 
          onBackToViewer={() => setViewMode('viewer')} 
        />
      )}

      {/* 2. オーナーポータル画面 */}
      {viewMode === 'portal' && currentOwner && (
        <OwnerPortal 
          owner={currentOwner} 
          onLogout={handleLogout} 
          theme={theme}
          onOwnerUpdate={(updatedOwner) => {
            setCurrentOwner(updatedOwner);
            localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(updatedOwner));
          }}
        />
      )}

      {/* 3. 一般地図ビューア / エラー画面 */}
      {viewMode === 'viewer' && (
        <>
          {/* 画面上部ヘッダー（ステータス＆テーマ切り替え、およびオーナーログイン導線） */}
          <TrackingHeader 
            session={session} 
            theme={theme} 
            onToggleTheme={handleToggleTheme} 
            currentOwner={currentOwner}
            onLoginClick={() => {
              if (currentOwner) {
                setViewMode('portal');
              } else {
                setViewMode('auth');
              }
            }}
            firstScannedTime={firstScannedTime}
          />

          {/* A. 時間外エラー画面 */}
          {!showViewerContent ? (
            <div className="error-screen-container time-restriction fade-in">
              <div className="error-card glass-panel-solid restriction-card">
                <div className="clock-pulse-wrapper">
                  <Clock size={48} className="restriction-icon" />
                  <div className="pulse-ring"></div>
                </div>
                <h2>営業時間外（閲覧制限）</h2>
                <p className="restriction-time-badge">
                  閲覧可能時間: <strong>9:00 〜 18:00</strong>
                </p>
                <p className="description">
                  マサさん設定のセキュリティ保護のため、夜間および早朝（18:00〜翌9:00）はお客さんの地図閲覧を休止しています。
                </p>
                <div className="current-time-info">
                  <span>現在時刻: <strong>{currentTimeStr}</strong></span>
                </div>
                
                <div className="qr-hint">
                  <ShieldAlert size={16} />
                  <span>位置情報の露出を防ぎ、安全な運行管理をサポートしています。</span>
                </div>
              </div>
            </div>
          ) : session && session.status === 'active' && !isCustomerSessionExpired ? (
            /* B. 地図表示（正常時） */
            <MapViewer session={session} theme={theme} />
          ) : (
            /* C. セッション期限切れ・無効エラー画面 */
            <div className="error-screen-container fade-in">
              <div className="error-card glass-panel-solid">
                <AlertCircle size={48} className="error-icon" />
                <h2>{isCustomerSessionExpired ? '閲覧の有効期限が切れました' : '追跡セッションが見つからないか終了しました'}</h2>
                <p className="description">
                  {isCustomerSessionExpired 
                    ? `このQRコードの閲覧可能時間（${session ? (session.durationMinutes >= 60 ? `${session.durationMinutes / 60}時間` : `${session.durationMinutes}分間`) : '60分間'}）が経過したため、自動的に接続を終了しました。`
                    : 'お探しのQRコードの有効期限が過ぎたか、運行・配信が停止された可能性があります。'
                  }
                </p>
                
                {!isCustomerSessionExpired && (
                  <div className="error-actions">
                    <button 
                      onClick={() => handleSessionChange('bus-01')} 
                      className="error-btn-primary"
                    >
                      デモ用バスの運行を表示
                    </button>
                  </div>
                )}
                
                <div className="qr-hint">
                  <QrCode size={16} />
                  <span>
                    {isCustomerSessionExpired 
                      ? 'もう一度現在地を確認するには、停留所や車内の最新のQRコードを再度スキャンしてください。'
                      : '停留所やチケットの最新のQRコードを再度スキャンしてください。'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* デモ用送信シミュレータ（一般ビューア閲覧時のみ表示、かつセッションが有効な場合） */}
          {showViewerContent && session && (
            <SimulatorPanel 
              currentSessionId={currentSessionId} 
              onSessionChange={handleSessionChange} 
            />
          )}

          {/* 右下フローティング・オーナーポータル切替FAB（極めてスタイリッシュ） */}
          <button 
            className="owner-fab glass-panel"
            onClick={() => {
              if (currentOwner) {
                setViewMode('portal');
              } else {
                setViewMode('auth');
              }
            }}
            title="運行管理者・ドライバーログイン"
          >
            <Shield size={18} className="fab-icon" />
            <span>{currentOwner ? '運行ポータル' : 'オーナーログイン'}</span>
          </button>
        </>
      )}

      <style>{`
        .app-container {
          width: 100%;
          height: 100%;
          position: relative;
          background-color: var(--bg-primary);
        }

        /* エラー画面 */
        .error-screen-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          z-index: 5;
          background: radial-gradient(circle at center, var(--bg-primary) 0%, rgba(15, 23, 42, 0.03) 100%);
        }

        [data-theme="dark"] .error-screen-container {
          background: radial-gradient(circle at center, var(--bg-primary) 0%, rgba(0, 0, 0, 0.3) 100%);
        }

        .error-card {
          max-width: 440px;
          width: 100%;
          padding: 44px 36px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          border-radius: var(--card-radius);
          box-shadow: var(--shadow-glass);
          border: 1px solid var(--border-glass);
        }

        .error-icon {
          color: var(--accent-error);
          margin-bottom: 4px;
          animation: pulse-error 2s infinite ease-in-out;
        }

        .error-card h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .error-card p.description {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .error-actions {
          width: 100%;
          margin-top: 8px;
        }

        .error-btn-primary {
          width: 100%;
          height: 46px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2);
        }

        .error-btn-primary:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
        }

        /* 閲覧時間制限デザイン */
        .clock-pulse-wrapper {
          position: relative;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }

        .restriction-icon {
          color: var(--accent-warning);
          z-index: 2;
          position: relative;
        }

        .clock-pulse-wrapper .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 2.5px solid var(--accent-warning);
          border-radius: 50%;
          animation: pulse-ring 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
          z-index: 1;
        }

        .restriction-time-badge {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
          color: #d97706;
          padding: 6px 14px;
          border-radius: 99px;
          font-size: 13px;
          font-weight: 500;
        }

        [data-theme="dark"] .restriction-time-badge {
          color: #fbbf24;
        }

        .current-time-info {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 4px 0;
        }

        .current-time-info strong {
          color: var(--text-primary);
          font-size: 15px;
        }

        .qr-hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 12px;
          border-top: 1px solid var(--border-glass);
          padding-top: 16px;
          width: 100%;
          justify-content: center;
          line-height: 1.4;
        }

        /* オーナー用フローティングボタン (FAB) */
        .owner-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 99px;
          cursor: pointer;
          font-weight: 700;
          font-size: 13px;
          color: var(--text-primary);
          transition: var(--transition-smooth);
        }

        .owner-fab:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15);
        }

        .fab-icon {
          flex-shrink: 0;
        }

        @keyframes pulse-error {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.82; }
        }

        @media (max-width: 640px) {
          .owner-fab {
            display: none; /* モバイルではヘッダーに一本化して被りを完全防止 */
          }
        }

        @media (max-width: 480px) {
          .error-card {
            padding: 36px 20px;
          }
          
          .error-card h2 {
            font-size: 18px;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
