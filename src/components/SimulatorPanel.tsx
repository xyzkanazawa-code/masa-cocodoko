import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Settings, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { 
  getAllSessions, 
  startAutoSimulation, 
  stopAutoSimulation, 
  isSimulating, 
  updateLocation
} from '../services/trackingService';
import type { TrackingSession } from '../services/trackingService';

interface SimulatorPanelProps {
  currentSessionId: string;
  onSessionChange: (id: string) => void;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  currentSessionId,
  onSessionChange
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // 初回ロード時に全セッションの取得
  useEffect(() => {
    setSessions(getAllSessions());
  }, []);

  // 現在のセッションの自動巡回状態を監視
  useEffect(() => {
    setAutoPlay(isSimulating(currentSessionId));
  }, [currentSessionId]);

  // 自動巡回切り替え
  const toggleAutoPlay = () => {
    if (autoPlay) {
      stopAutoSimulation(currentSessionId);
      setAutoPlay(false);
    } else {
      startAutoSimulation(currentSessionId, 2500); // 2.5秒ごとに移動
      setAutoPlay(true);
    }
  };

  // 手動での微小移動（デモ用）
  const handleManualMove = (direction: 'N' | 'S' | 'E' | 'W') => {
    const current = sessions.find(s => s.id === currentSessionId);
    if (!current) return;

    // 約10〜20メートルの移動に相当する緯度経度の差分
    const step = 0.00015;
    let newLat = current.lat;
    let newLng = current.lng;

    switch (direction) {
      case 'N': newLat += step; break;
      case 'S': newLat -= step; break;
      case 'E': newLng += step; break;
      case 'W': newLng -= step; break;
    }

    updateLocation(currentSessionId, newLat, newLng, { status: 'active' });
    
    // 表示用のセッション情報を更新
    setSessions(getAllSessions());
  };

  // 運行再開 / リセット
  const handleResetSession = () => {
    const current = sessions.find(s => s.id === currentSessionId);
    if (!current) return;

    // 東京駅または各初期位置にリセット
    let defaultLat = 35.681236;
    let defaultLng = 139.767125;

    if (currentSessionId === 'delivery-01') {
      defaultLat = 35.658580;
      defaultLng = 139.745433;
    } else if (currentSessionId === 'person-01') {
      defaultLat = 35.626446;
      defaultLng = 139.723444;
    }

    stopAutoSimulation(currentSessionId);
    setAutoPlay(false);
    updateLocation(currentSessionId, defaultLat, defaultLng, { 
      status: 'active',
      bearing: 0 
    });
    setSessions(getAllSessions());
  };

  // 運行終了（有効期限切れのデモ用）
  const handleStopSession = () => {
    stopAutoSimulation(currentSessionId);
    setAutoPlay(false);
    updateLocation(currentSessionId, 35.681236, 139.767125, { status: 'inactive' });
    setSessions(getAllSessions());
  };

  // 現在のデモ用追跡URLをコピー（ハッシュ方式に統一してサーバー404を回避）
  const handleCopyUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}#session=${currentSessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  return (
    <div className={`simulator-panel glass-panel-solid ${isOpen ? 'open' : ''}`}>
      {/* ヘッダー・折りたたみトグル */}
      <button onClick={() => setIsOpen(!isOpen)} className="panel-toggle">
        <div className="toggle-title">
          <Settings size={16} className={autoPlay ? 'spin-icon' : ''} />
          <span>デモ用・位置送信シミュレータ</span>
        </div>
        {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {/* シミュレーター詳細コンテンツ */}
      {isOpen && (
        <div className="panel-content fade-in">
          {/* セッションの切り替え */}
          <div className="control-group">
            <label className="group-label">追跡対象の選択（QRコード擬似切替）</label>
            <div className="select-wrapper">
              <select 
                value={currentSessionId} 
                onChange={(e) => onSessionChange(e.target.value)}
                className="session-select"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status === 'inactive' ? '終了' : '運行中'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 自動巡回コントロール */}
          <div className="control-group">
            <label className="group-label">自動運行（GPS定期送信のシミュレート）</label>
            <div className="button-row">
              <button 
                onClick={toggleAutoPlay} 
                className={`sim-btn ${autoPlay ? 'active-stop' : 'active-start'}`}
              >
                {autoPlay ? (
                  <>
                    <Square size={14} fill="currentColor" />
                    <span>自動運転を停止</span>
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    <span>自動運転を開始</span>
                  </>
                )}
              </button>
              
              <button onClick={handleResetSession} className="sim-btn secondary" title="位置をリセット">
                <RefreshCw size={14} />
                <span>初期位置へ</span>
              </button>
            </div>
          </div>

          {/* 手動移動（マニュアル操作） */}
          <div className="control-group">
            <label className="group-label">マニュアルGPS移動（微調整）</label>
            <div className="dpad-container">
              <div className="dpad-row">
                <button onClick={() => handleManualMove('N')} className="dpad-btn" title="北へ移動">北</button>
              </div>
              <div className="dpad-row">
                <button onClick={() => handleManualMove('W')} className="dpad-btn" title="西へ移動">西</button>
                <div className="dpad-center">🎮</div>
                <button onClick={() => handleManualMove('E')} className="dpad-btn" title="東へ移動">東</button>
              </div>
              <div className="dpad-row">
                <button onClick={() => handleManualMove('S')} className="dpad-btn" title="南へ移動">南</button>
              </div>
            </div>
          </div>

          {/* ステータス制御 & URLコピー */}
          <div className="control-group">
            <label className="group-label">その他アクション</label>
            <div className="button-row-stack">
              <button onClick={handleStopSession} className="sim-btn danger">
                ⚠️ セッションを強制終了（期限切れデモ）
              </button>

              <button onClick={handleCopyUrl} className="sim-btn info">
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-500" />
                    <span>コピー完了！</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>現在の追跡URLをコピー</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="panel-footer">
            <p>※実際のシステムでは、この位置送信操作は「追跡対象者のスマートフォンアプリ」または車載GPS端末などから行われます。</p>
          </div>
        </div>
      )}

      <style>{`
        .simulator-panel {
          position: absolute;
          bottom: 24px;
          right: 24px;
          width: 320px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          border-radius: var(--card-radius);
          box-shadow: var(--shadow-glass);
          overflow: hidden;
          transition: var(--transition-smooth);
        }

        .panel-toggle {
          width: 100%;
          height: 48px;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          color: var(--text-primary);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .toggle-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spin-icon {
          animation: spin 3s infinite linear;
        }

        .panel-content {
          padding: 16px;
          border-top: 1px solid var(--border-glass);
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 420px;
          overflow-y: auto;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .group-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .select-wrapper {
          position: relative;
          width: 100%;
        }

        .session-select {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .session-select:focus {
          border-color: var(--accent-primary);
        }

        .button-row {
          display: flex;
          gap: 8px;
        }

        .button-row-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sim-btn {
          flex: 1;
          height: 38px;
          border-radius: 10px;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: var(--transition-smooth);
        }

        .sim-btn.active-start {
          background: var(--accent-primary);
          color: #ffffff;
        }

        .sim-btn.active-start:hover {
          background: var(--accent-hover);
        }

        .sim-btn.active-stop {
          background: var(--accent-error);
          color: #ffffff;
        }

        .sim-btn.secondary {
          background: rgba(148, 163, 184, 0.15);
          color: var(--text-primary);
        }

        .sim-btn.secondary:hover {
          background: rgba(148, 163, 184, 0.25);
        }

        .sim-btn.danger {
          background: rgba(239, 68, 68, 0.1);
          color: var(--accent-error);
          border: 1px dashed var(--accent-error);
        }

        .sim-btn.danger:hover {
          background: var(--accent-error);
          color: #ffffff;
        }

        .sim-btn.info {
          background: var(--bg-primary);
          color: var(--text-secondary);
          border: 1px solid var(--border-glass);
        }

        .sim-btn.info:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
        }

        /* D-Pad 手動コントローラー */
        .dpad-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: rgba(148, 163, 184, 0.08);
          padding: 8px;
          border-radius: 14px;
        }

        .dpad-row {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .dpad-btn {
          width: 50px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid var(--border-glass);
          background: var(--bg-glass-solid);
          color: var(--text-primary);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .dpad-btn:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
        }

        .dpad-center {
          width: 50px;
          text-align: center;
          font-size: 14px;
        }

        .panel-footer {
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px solid var(--border-glass);
        }

        .panel-footer p {
          font-size: 9px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .simulator-panel {
            bottom: 76px; /* 地図コントロールが最下部にあるため、その上に配置 */
            right: 16px;
            left: 16px;
            width: auto;
          }
          
          .panel-content {
            max-height: 280px;
          }
        }
      `}</style>
    </div>
  );
};
