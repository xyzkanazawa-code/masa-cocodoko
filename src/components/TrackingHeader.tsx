import React, { useEffect, useState } from 'react';
import { Bus, Truck, User, Sun, Moon, AlertTriangle, Radio, Shield, Clock } from 'lucide-react';
import type { TrackingSession, Owner } from '../services/trackingService';

interface TrackingHeaderProps {
  session: TrackingSession | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentOwner?: Owner | null;
  onLoginClick?: () => void;
  firstScannedTime?: number | null;
}

export const TrackingHeader: React.FC<TrackingHeaderProps> = ({
  session,
  theme,
  onToggleTheme,
  currentOwner = null,
  onLoginClick,
  firstScannedTime = null
}) => {
  const [timeAgo, setTimeAgo] = useState<string>('たった今');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [announcementTimeAgo, setAnnouncementTimeAgo] = useState<string>('たった今');

  // 最新のお知らせを取得
  const latestAnnouncement = session?.announcements && session.announcements.length > 0
    ? session.announcements[session.announcements.length - 1]
    : null;

  // 最新のお知らせの経過時間を更新する
  useEffect(() => {
    if (!latestAnnouncement) return;

    const updateAnnouncementTime = () => {
      const createdTime = latestAnnouncement.timestamp;
      const now = Date.now();
      const diffSec = Math.floor((now - createdTime) / 1000);

      if (diffSec < 5) {
        setAnnouncementTimeAgo('たった今');
      } else if (diffSec < 60) {
        setAnnouncementTimeAgo(`${diffSec}秒前`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setAnnouncementTimeAgo(`${diffMin}分前`);
      }
    };

    updateAnnouncementTime();
    const interval = setInterval(updateAnnouncementTime, 10000); // 10秒毎に更新

    return () => clearInterval(interval);
  }, [latestAnnouncement?.id, latestAnnouncement?.timestamp]);

  // 最終更新時間からの経過時間を更新する
  useEffect(() => {
    if (!session || session.status === 'inactive') return;

    const updateInterval = setInterval(() => {
      const updatedTime = new Date(session.updatedAt).getTime();
      const now = Date.now();
      const diffSec = Math.floor((now - updatedTime) / 1000);

      if (diffSec < 5) {
        setTimeAgo('たった今');
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec}秒前`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgo(`${diffMin}分前`);
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [session?.updatedAt, session?.status]);

  // 残り時間のカウントダウン処理
  useEffect(() => {
    if (!session || session.status !== 'active' || !firstScannedTime) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const durationMs = (session.durationMinutes || 60) * 60 * 1000;
      const expires = firstScannedTime + durationMs;
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('期限切れ');
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        
        const hStr = hours > 0 ? `${hours}時間` : '';
        setTimeLeft(`${hStr}${minutes}分${seconds}秒`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [session?.durationMinutes, session?.status, firstScannedTime]);

  // カテゴリ別アイコンの取得
  const getIcon = () => {
    if (!session) return <AlertTriangle className="icon-error" />;
    
    const size = 24;
    switch (session.type) {
      case 'bus':
        return <Bus size={size} className="text-emerald-500" />;
      case 'delivery':
        return <Truck size={size} className="text-amber-500" />;
      case 'person':
        return <User size={size} className="text-blue-500" />;
      default:
        return <Radio size={size} className="text-blue-500" />;
    }
  };

  // ステータスラベルの取得
  const getStatusBadge = () => {
    if (!session) return null;

    switch (session.status) {
      case 'active':
        return (
          <div className="status-badge active">
            <span className="status-pulse-dot"></span>
            リアルタイム追跡中
          </div>
        );
      case 'paused':
        return (
          <div className="status-badge paused">
            <span className="status-dot"></span>
            一時停止中
          </div>
        );
      case 'inactive':
      default:
        return (
          <div className="status-badge inactive">
            <span className="status-dot"></span>
            追跡終了
          </div>
        );
    }
  };

  return (
    <>
    <header className="tracking-header glass-panel fade-in">
      <div className="header-left">
        <div className={`icon-container ${session?.type || 'unknown'}`}>
          {getIcon()}
        </div>
        <div className="meta-container">
          <h1 className="tracking-title">
            {session ? session.name : '追跡対象が見つかりません'}
          </h1>
          <div className="tracking-subtitle">
            {session && session.status !== 'inactive' ? (
              <span className="update-time">
                位置更新: {timeAgo}
                {timeLeft && (
                  <>
                    <span className="header-time-divider">|</span>
                    <span className="header-time-left">
                      <Clock size={12} className="time-icon" />
                      <span className="time-text">残り {timeLeft}</span>
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span className="update-time-error">
                {session ? 'この運行セッションは終了しました' : '正しいリンクからアクセスしてください'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="header-right">
        {session && getStatusBadge()}
        
        {/* 地図切り替えスイッチ（ユーザーリクエスト対応） */}
        <button 
          onClick={onToggleTheme} 
          className="theme-toggle-btn"
          aria-label="地図テーマ切り替え"
          title={theme === 'light' ? 'ダーク地図に切り替え' : 'ライト地図に切り替え'}
        >
          {theme === 'light' ? (
            <>
              <Moon size={18} />
              <span className="theme-toggle-text">ダーク地図</span>
            </>
          ) : (
            <>
              <Sun size={18} />
              <span className="theme-toggle-text">ライト地図</span>
            </>
          )}
        </button>

        {/* オーナーログイン / 運行ポータルボタン（絶対に見失わないプレミアム設計） */}
        {onLoginClick && (
          <button
            onClick={onLoginClick}
            className={`owner-header-btn ${currentOwner ? 'logged-in' : ''}`}
            title={currentOwner ? `${currentOwner.name}さんの運行ポータルを開く` : '運行管理者・ドライバーログイン'}
          >
            <Shield size={16} />
            <span className="owner-btn-text">
              {currentOwner ? `${currentOwner.name} (ポータル)` : 'オーナーログイン'}
            </span>
          </button>
        )}
      </div>

      <style>{`
        .tracking-header {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          height: 72px;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0; /* テキスト省略用 */
        }

        .icon-container {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(148, 163, 184, 0.1);
        }
        
        .icon-container.bus {
          background: rgba(16, 185, 129, 0.12);
        }
        
        .icon-container.delivery {
          background: rgba(245, 158, 11, 0.12);
        }
        
        .icon-container.person {
          background: rgba(59, 130, 246, 0.12);
        }

        .meta-container {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .tracking-title {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tracking-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .update-time-error {
          color: var(--accent-error);
          font-weight: 500;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* 残り時間表示スタイル */
        .header-time-divider {
          margin: 0 8px;
          color: var(--text-muted);
          opacity: 0.5;
        }

        .header-time-left {
          display: inline-flex;
          align-items: center;
          color: var(--accent-primary);
          font-weight: 500;
        }

        .time-icon {
          margin-right: 4px;
          display: inline-block;
          vertical-align: middle;
        }

        /* ステータスバッジ */
        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--pill-radius);
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.12);
          color: var(--accent-success);
        }

        .status-badge.paused {
          background: rgba(245, 158, 11, 0.12);
          color: var(--accent-warning);
        }

        .status-badge.inactive {
          background: rgba(239, 68, 68, 0.12);
          color: var(--accent-error);
        }

        .status-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--accent-success);
          border-radius: 50%;
          display: inline-block;
          position: relative;
        }

        .status-pulse-dot::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-color: inherit;
          animation: pulse-ring 1.8s infinite ease-in-out;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: currentColor;
          display: inline-block;
        }

        /* テーマ切り替えスイッチ */
        .theme-toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: var(--pill-radius);
          border: 1px solid var(--border-glass);
          background: var(--bg-glass-solid);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .theme-toggle-btn:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        /* オーナーヘッダーボタン */
        .owner-header-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: var(--pill-radius);
          border: 1px solid var(--border-glass);
          background: rgba(59, 130, 246, 0.08);
          color: var(--accent-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
        }

        .owner-header-btn:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .owner-header-btn.logged-in {
          background: rgba(16, 185, 129, 0.08);
          color: var(--accent-success);
          border-color: rgba(16, 185, 129, 0.3);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.05);
        }

        .owner-header-btn.logged-in:hover {
          background: var(--accent-success);
          color: #ffffff;
          border-color: var(--accent-success);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        @media (max-width: 640px) {
          .tracking-header {
            top: 10px;
            left: 10px;
            right: 10px;
            padding: 0 12px;
            height: 64px;
          }

          .header-left {
            gap: 10px;
          }

          .icon-container {
            width: 36px;
            height: 36px;
          }
          
          .icon-container svg {
            width: 20px;
            height: 20px;
          }

          .tracking-title {
            font-size: 14px;
            max-width: 150px;
          }

          .status-badge {
            padding: 4px 8px;
            font-size: 11px;
          }

          .theme-toggle-text,
          .owner-btn-text {
            display: none; /* スマホではテキストを非表示にし、アイコンだけに */
          }
          
          .theme-toggle-btn,
          .owner-header-btn {
            padding: 8px;
          }

          .header-time-divider {
            margin: 0 4px;
          }

          .header-time-left {
            font-size: 11px;
          }
        }

        /* お知らせバーのスタイル */
        .announcement-bar {
          position: absolute;
          top: 96px; /* 16px(top) + 72px(header height) + 8px(spacing) */
          left: 16px;
          right: 16px;
          min-height: 48px;
          z-index: 9;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 18px;
          border: 1px solid rgba(245, 158, 11, 0.25); /* 琥珀色 */
          background: var(--bg-glass-solid);
          box-shadow: var(--shadow-glass);
          border-radius: var(--card-radius);
          color: var(--text-primary);
          font-size: 13px;
          line-height: 1.5;
        }

        [data-theme="dark"] .announcement-bar {
          background: rgba(15, 23, 42, 0.7);
          border-color: rgba(245, 158, 11, 0.35);
        }

        .announcement-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: rgba(245, 158, 11, 0.15); /* 琥珀色の半透明背景 */
          color: #d97706; /* 濃い琥珀色 */
          font-weight: 700;
          font-size: 11px;
          border-radius: var(--pill-radius);
          white-space: nowrap;
        }

        [data-theme="dark"] .announcement-badge {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }

        .announcement-text {
          flex: 1;
          font-weight: 500;
          word-break: break-all;
        }

        .announcement-time {
          font-size: 11.5px;
          color: var(--text-muted);
          white-space: nowrap;
        }

        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          50% {
            transform: translateY(2px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .bounce-in {
          animation: bounce-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @media (max-width: 640px) {
          .announcement-bar {
            top: 82px; /* 10px(top) + 64px(header height) + 8px(spacing) */
            left: 10px;
            right: 10px;
            padding: 8px 12px;
            font-size: 12px;
            gap: 8px;
          }
          .announcement-badge {
            padding: 3px 8px;
            font-size: 10px;
          }
        }
      `}</style>
    </header>

    {latestAnnouncement && (
      <div className="announcement-bar glass-panel-solid bounce-in">
        <span className="announcement-badge">📢 ドライバーからの案内</span>
        <span className="announcement-text">{latestAnnouncement.text}</span>
        <span className="announcement-time">({announcementTimeAgo})</span>
      </div>
    )}
  </>
  );
};
