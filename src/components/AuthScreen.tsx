import React, { useState, useEffect } from 'react';
import { User, ShieldAlert, KeyRound, Truck, UserCircle2, Bus, AlertCircle, Eye, EyeOff, Trash2, Lock, Settings, XCircle } from 'lucide-react';
import { 
  registerOwner, 
  loginOwner, 
  getAllOwners, 
  deleteOwner, 
  sendSystemMessage, 
  clearSystemMessage, 
  getSystemMessage,
  AVATAR_CATEGORIES
} from '../services/trackingService';
import type { Owner } from '../services/trackingService';

interface AuthScreenProps {
  onSuccess: (owner: Owner) => void;
  onBackToViewer: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onBackToViewer }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [role, setRole] = useState<'bus' | 'delivery' | 'person'>('bus');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ニックネーム・アバター用ステート
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🐰');
  const [avatarCategory, setAvatarCategory] = useState('animal');

  // 役割が変更されたときにデフォルトのアバターを自動選択する効果
  useEffect(() => {
    if (role === 'bus') {
      setSelectedAvatar('🐰');
      setAvatarCategory('animal');
    } else if (role === 'delivery') {
      setSelectedAvatar('🐱');
      setAvatarCategory('animal');
    } else {
      setSelectedAvatar('🐥');
      setAvatarCategory('animal');
    }
  }, [role]);

  // スーパー管理者用ステート
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  const [showSuperAdminTrigger, setShowSuperAdminTrigger] = useState(false);
  const [superPasscode, setSuperPasscode] = useState('');
  const [superAdminError, setSuperAdminError] = useState<string | null>(null);
  const [ownersList, setOwnersList] = useState<Owner[]>([]);
  const [visiblePasscodes, setVisiblePasscodes] = useState<Record<string, boolean>>({});

  // スーパー管理者用：全体メッセージ配信ステート
  const [systemMessageText, setSystemMessageText] = useState('');
  const [currentSystemMsg, setCurrentSystemMsg] = useState<any>(null);

  // マウント時・モード切替時に配信中のシステムメッセージを取得
  useEffect(() => {
    if (isSuperAdminMode) {
      setCurrentSystemMsg(getSystemMessage());
    }
  }, [isSuperAdminMode]);

  const handleSendSystemMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemMessageText.trim()) return;
    sendSystemMessage(systemMessageText);
    setCurrentSystemMsg(getSystemMessage());
    setSystemMessageText('');
  };

  const handleClearSystemMessage = () => {
    if (window.confirm('本当に配信中の緊急メッセージ（テロップ）を停止しますか？')) {
      clearSystemMessage();
      setCurrentSystemMsg(null);
    }
  };

  // スーパー管理者認証の実行
  const handleSuperAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setSuperAdminError(null);

    // マスターパスコードは '8888'
    if (superPasscode === '8888') {
      const owners = getAllOwners();
      setOwnersList(owners);
      setIsSuperAdminMode(true);
      setSuperPasscode('');
      setShowSuperAdminTrigger(false);
    } else {
      setSuperAdminError('マスター暗証番号が正しくありません。');
    }
  };

  // スーパー管理者：暗証番号表示のトグル
  const togglePasscodeVisibility = (ownerId: string) => {
    setVisiblePasscodes(prev => ({
      ...prev,
      [ownerId]: !prev[ownerId]
    }));
  };

  // スーパー管理者：ドライバー削除
  const handleDeleteOwner = (ownerId: string, ownerName: string) => {
    if (window.confirm(`本当に「${ownerName}」のアカウントを完全削除しますか？\n（現在稼働中の運行位置データも同時に削除されます）`)) {
      deleteOwner(ownerId);
      // リスト更新
      setOwnersList(getAllOwners());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('名前を入力してください。');
      return;
    }

    if (!/^\d{4}$/.test(passcode)) {
      setError('暗証番号は4桁の数字で入力してください。');
      return;
    }

    setIsLoading(true);

    // 意図的な短い遅延を入れてリッチなUXを演出
    setTimeout(() => {
      try {
        let owner: Owner;
        if (isLogin) {
          owner = loginOwner(name, passcode);
        } else {
          owner = registerOwner(name, passcode, role, nickname, selectedAvatar);
        }
        onSuccess(owner);
      } catch (err: any) {
        setError(err.message || 'エラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    }, 600);
  };

  return (
    <div className="auth-container fade-in">
      <div className="auth-card glass-panel-solid">
        {isSuperAdminMode ? (
          /* スーパー管理者専用ダッシュボード */
          <div className="super-admin-panel fade-in">
            <div className="super-admin-header">
              <div className="super-logo-wrapper">
                <Settings className="super-logo-icon animate-spin-slow" />
              </div>
              <h3>極秘：スーパー管理者ダッシュボード</h3>
              <p className="super-subtitle">マサさん専用のオーナー管理・暗証番号確認パネル</p>
            </div>

            <div className="super-owners-section">
              <div className="super-section-header">
                <span>登録中のドライバー・スタッフ一覧 ({ownersList.length}名)</span>
              </div>

              {ownersList.length === 0 ? (
                <div className="super-empty-state">
                  <UserCircle2 size={32} className="text-slate-400" />
                  <p>現在登録されているオーナーはいません。</p>
                </div>
              ) : (
                <div className="super-owners-list">
                  {ownersList.map((owner) => {
                    const isVisible = !!visiblePasscodes[owner.id];
                    return (
                      <div key={owner.id} className="super-owner-card glass-panel-hover">
                        <div className="owner-card-info">
                          <div className="owner-meta-row">
                            <span className="owner-card-name">{owner.name}</span>
                            <span className={`owner-card-badge ${owner.role}`}>
                              {owner.role === 'bus' ? '🚌 バス' : owner.role === 'delivery' ? '🚚 配送車' : '🧑 スタッフ'}
                            </span>
                          </div>
                          <span className="owner-card-id">ID: {owner.id}</span>
                        </div>

                        <div className="owner-card-actions">
                          {/* 暗証番号確認エリア */}
                          <div className="passcode-view-wrapper">
                            <span className="passcode-label">暗証番号:</span>
                            <span className={`passcode-value ${isVisible ? 'visible' : 'masked'}`}>
                              {isVisible ? owner.passcode : '••••'}
                            </span>
                            <button
                              type="button"
                              className="passcode-toggle-icon"
                              onClick={() => togglePasscodeVisibility(owner.id)}
                              title={isVisible ? '隠す' : '表示する'}
                            >
                              {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>

                          {/* 削除アクション */}
                          <button
                            type="button"
                            className="owner-delete-btn"
                            onClick={() => handleDeleteOwner(owner.id, owner.name)}
                            title="アカウントを完全削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 緊急全体メッセージ配信（電光掲示板） */}
            <div className="super-system-message-section">
              <div className="super-section-header">
                <span>📢 緊急全体メッセージ配信（電光掲示板テロップ）</span>
              </div>
              <form onSubmit={handleSendSystemMessage} className="super-system-message-form">
                <input
                  type="text"
                  value={systemMessageText}
                  onChange={(e) => setSystemMessageText(e.target.value)}
                  placeholder="例：スーパー管理画面から更新してください"
                  className="super-system-message-input"
                  maxLength={100}
                  required
                />
                <div className="super-system-message-actions">
                  <button type="submit" className="super-send-msg-btn">
                    全体に流す 🚀
                  </button>
                  {currentSystemMsg && (
                    <button
                      type="button"
                      onClick={handleClearSystemMessage}
                      className="super-clear-msg-btn"
                    >
                      配信停止 🛑
                    </button>
                  )}
                </div>
              </form>
              {currentSystemMsg && (
                <div className="super-active-msg-card">
                  <span className="active-msg-title">配信中テロップ:</span>
                  <span className="active-msg-text">{currentSystemMsg.text}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              className="super-close-btn"
              onClick={() => setIsSuperAdminMode(false)}
            >
              <XCircle size={16} />
              <span>ダッシュボードを閉じる</span>
            </button>
          </div>
        ) : (
          /* 通常のログイン・新規登録画面 */
          <>
            <div className="auth-header">
              <div className="logo-icon-wrapper">
                <KeyRound className="logo-icon" />
              </div>
              <h2>ココドコ・オーナーポータル</h2>
              <p className="subtitle">
                {isLogin 
                  ? '運行管理者・ドライバーの方はこちらからログインしてください' 
                  : '新しいオーナー（ドライバー・ガイド等）のアカウントを作成します'}
              </p>
            </div>

            {/* タブ切り替え */}
            <div className="tab-buttons">
              <button 
                type="button"
                className={isLogin ? 'active' : ''} 
                onClick={() => { setIsLogin(true); setError(null); }}
              >
                ログイン
              </button>
              <button 
                type="button"
                className={!isLogin ? 'active' : ''} 
                onClick={() => { setIsLogin(false); setError(null); }}
              >
                新規登録
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="error-alert fade-in">
                  <AlertCircle size={18} className="alert-icon" />
                  <span>{error}</span>
                </div>
              )}

              {/* 名前入力 */}
              <div className="form-group">
                <label htmlFor="auth-name">お名前（表示名）</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例: 山田 太郎"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 暗証番号入力 */}
              <div className="form-group">
                <label htmlFor="auth-passcode">暗証番号（4桁の数字）</label>
                <div className="input-wrapper">
                  <ShieldAlert className="input-icon" size={18} />
                  <input
                    id="auth-passcode"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    required
                    disabled={isLoading}
                  />
                </div>
                <span className="help-text">ログイン時に入力する任意の4桁の数字</span>
              </div>

              {/* 役割とニックネーム・アバター選択（新規登録時のみ） */}
              {!isLogin && (
                <>
                  {/* ニックネーム入力 */}
                  <div className="form-group fade-in">
                    <label htmlFor="auth-nickname">地図表示ニックネーム（任意）</label>
                    <div className="input-wrapper">
                      <span className="input-icon" style={{ fontSize: '16px', left: '14px', position: 'absolute' }}>✨</span>
                      <input
                        id="auth-nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="例: パットバスうさぎ 🐰"
                        disabled={isLoading}
                        maxLength={15}
                      />
                    </div>
                    <span className="help-text">地図上に常時表示される可愛いニックネームです。未入力の場合はお名前が表示されます。</span>
                  </div>

                  <div className="form-group fade-in">
                    <label>あなたの役割 / 乗り物の種類</label>
                    <div className="role-selector">
                      <button
                        type="button"
                        className={`role-option ${role === 'bus' ? 'active bus' : ''}`}
                        onClick={() => setRole('bus')}
                        disabled={isLoading}
                      >
                        <Bus size={20} />
                        <span>バス</span>
                      </button>
                      <button
                        type="button"
                        className={`role-option ${role === 'delivery' ? 'active delivery' : ''}`}
                        onClick={() => setRole('delivery')}
                        disabled={isLoading}
                      >
                        <Truck size={20} />
                        <span>配送車</span>
                      </button>
                      <button
                        type="button"
                        className={`role-option ${role === 'person' ? 'active person' : ''}`}
                        onClick={() => setRole('person')}
                        disabled={isLoading}
                      >
                        <UserCircle2 size={20} />
                        <span>スタッフ</span>
                      </button>
                    </div>
                  </div>

                  {/* 可愛いアバターアイコン選択 */}
                  <div className="form-group fade-in">
                    <label>可愛いアバターアイコン（全36種）</label>
                    <div className="avatar-category-tabs">
                      {AVATAR_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`avatar-cat-tab ${avatarCategory === cat.id ? 'active' : ''}`}
                          onClick={() => setAvatarCategory(cat.id)}
                          disabled={isLoading}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="avatar-grid-wrapper">
                      <div className="avatar-grid">
                        {AVATAR_CATEGORIES.find(cat => cat.id === avatarCategory)?.items.map(item => {
                          const isSelected = selectedAvatar === item.emoji;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              className={`avatar-item-btn ${isSelected ? 'selected avatar-rubber' : ''}`}
                              onClick={() => setSelectedAvatar(item.emoji)}
                              disabled={isLoading}
                              title={item.label}
                            >
                              <span className="avatar-emoji">{item.emoji}</span>
                              <span className="avatar-label">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" className="submit-button" disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner"></span>
                ) : (
                  isLogin ? 'ログインする' : 'アカウントを登録する'
                )}
              </button>
            </form>

            <div className="auth-footer">
              <button type="button" className="back-link" onClick={onBackToViewer} disabled={isLoading}>
                ← 地図ビューアに戻る
              </button>
            </div>

            {/* スーパー管理者ログイン・トリガー（マサさんの要望） */}
            <div className="super-admin-section">
              {!showSuperAdminTrigger ? (
                <button
                  type="button"
                  className="super-admin-toggle-btn"
                  onClick={() => {
                    setShowSuperAdminTrigger(true);
                    setSuperAdminError(null);
                  }}
                >
                  <Settings size={12} />
                  <span>スーパー管理者専用（極秘）</span>
                </button>
              ) : (
                <form onSubmit={handleSuperAdminAuth} className="super-admin-auth-form fade-in">
                  <div className="super-auth-title">
                    <Lock size={12} />
                    <span>マスター暗証番号を入力してください</span>
                  </div>
                  <div className="super-auth-input-row">
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      value={superPasscode}
                      onChange={(e) => setSuperPasscode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      required
                    />
                    <button type="submit" className="super-auth-btn">認証</button>
                    <button
                      type="button"
                      className="super-auth-cancel"
                      onClick={() => {
                        setShowSuperAdminTrigger(false);
                        setSuperPasscode('');
                        setSuperAdminError(null);
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                  {superAdminError && (
                    <div className="super-auth-error">
                      <AlertCircle size={12} />
                      <span>{superAdminError}</span>
                    </div>
                  )}
                </form>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .auth-container {
          display: flex;
          align-items: flex-start; /* 縦スクロール時に上部が切れないように上揃えにします */
          justify-content: center;
          min-height: 100vh; /* 高さを画面全体の最小高さに指定します */
          height: auto; /* コンテンツに応じて自動で高さが伸びるようにします */
          width: 100%;
          padding: 40px 20px; /* 上下にスクロール用の余白を持たせます */
          position: relative;
          z-index: 100;
          background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.15), transparent 40%),
                      radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.1), transparent 40%);
          overflow-y: visible; /* 親（body）の標準スクロールに任せるためvisibleにします */
        }
        
        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 40px 32px;
          border-radius: var(--card-radius);
          box-shadow: var(--shadow-glass);
          border: 1px solid var(--border-glass);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .logo-icon-wrapper {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 8px 16px rgba(59, 130, 246, 0.25);
        }

        .logo-icon {
          color: white;
          width: 30px;
          height: 30px;
        }

        .auth-header h2 {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .tab-buttons {
          display: flex;
          background: rgba(0, 0, 0, 0.05);
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        [data-theme="dark"] .tab-buttons {
          background: rgba(255, 255, 255, 0.05);
        }

        .tab-buttons button {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .tab-buttons button.active {
          background: var(--bg-glass-solid);
          color: var(--text-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--accent-error);
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .alert-icon {
          flex-shrink: 0;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
        }

        .input-wrapper input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          border-radius: 12px;
          border: 1px solid var(--border-glass);
          background: rgba(0, 0, 0, 0.02);
          color: var(--text-primary);
          font-size: 15px;
          outline: none;
          transition: var(--transition-smooth);
        }

        [data-theme="dark"] .input-wrapper input {
          background: rgba(255, 255, 255, 0.02);
        }

        .input-wrapper input:focus {
          border-color: var(--accent-primary);
          background: var(--bg-glass-solid);
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .help-text {
          font-size: 11px;
          color: var(--text-muted);
        }

        .role-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 4px;
        }

        .role-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 8px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          cursor: pointer;
          transition: var(--transition-smooth);
          color: var(--text-secondary);
        }

        [data-theme="dark"] .role-option {
          background: rgba(255, 255, 255, 0.02);
        }

        .role-option:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        [data-theme="dark"] .role-option:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .role-option.active {
          background: var(--bg-glass-solid);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
        }

        .role-option.active.bus {
          border-color: #10b981;
          color: #10b981;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
        }

        .role-option.active.delivery {
          border-color: #f59e0b;
          color: #f59e0b;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
        }

        .role-option.active.person {
          border-color: #3b82f6;
          color: #3b82f6;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .submit-button {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          color: white;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 8px;
        }

        .submit-button:hover {
          opacity: 0.95;
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
        }

        .submit-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-footer {
          margin-top: 24px;
          text-align: center;
        }

        .back-link {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .back-link:hover {
          color: var(--text-primary);
        }

        /* スピナー */
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* スーパー管理者用スタイル */
        .super-admin-panel {
          text-align: left;
        }
        .super-admin-header {
          text-align: center;
          margin-bottom: 20px;
        }
        .super-logo-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          color: #ef4444;
        }
        .super-subtitle {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
        }
        .super-owners-section {
          margin-top: 16px;
          margin-bottom: 20px;
        }
        .super-section-header {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 10px;
        }
        .super-owners-list {
          max-height: 240px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        .super-owner-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid var(--border-glass);
          border-radius: 10px;
        }
        [data-theme="dark"] .super-owner-card {
          background: rgba(255, 255, 255, 0.02);
        }
        .owner-card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .owner-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .owner-card-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .owner-card-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .owner-card-badge.bus { background: rgba(16, 185, 129, 0.12); color: #10b981; }
        .owner-card-badge.delivery { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
        .owner-card-badge.person { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
        .owner-card-id {
          font-size: 9.5px;
          color: var(--text-muted);
        }
        .owner-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .passcode-view-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          color: var(--text-secondary);
        }
        .passcode-value {
          font-family: monospace;
          font-weight: 700;
        }
        .passcode-value.masked {
          color: var(--text-muted);
        }
        .passcode-value.visible {
          color: var(--text-primary);
        }
        .passcode-toggle-icon {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }
        .passcode-toggle-icon:hover {
          color: var(--text-primary);
        }
        .owner-delete-btn {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        .owner-delete-btn:hover {
          background: rgba(239, 68, 68, 0.1);
        }
        .super-close-btn {
          width: 100%;
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .super-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--text-primary);
        }
        .super-admin-section {
          margin-top: 16px;
          border-top: 1px dashed var(--border-glass);
          padding-top: 16px;
          text-align: center;
        }
        .super-admin-toggle-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 11px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          opacity: 0.6;
          transition: all 0.2s;
        }
        .super-admin-toggle-btn:hover {
          opacity: 1;
          color: var(--text-secondary);
        }
        .super-admin-auth-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }
        .super-auth-title {
          font-size: 10.5px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .super-auth-input-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .super-auth-input-row input {
          width: 64px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid var(--border-glass);
          background: rgba(0, 0, 0, 0.02);
          color: var(--text-primary);
          text-align: center;
          font-size: 14px;
          font-family: monospace;
          outline: none;
        }
        .super-auth-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 6px;
          border: none;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .super-auth-cancel {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 11px;
          cursor: pointer;
        }
        .super-auth-error {
          font-size: 10.5px;
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        
        .super-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px dashed var(--border-glass);
          border-radius: 10px;
          color: var(--text-muted);
          font-size: 12px;
        }
        [data-theme="dark"] .super-empty-state {
          background: rgba(255, 255, 255, 0.02);
        }

        .super-system-message-section {
          margin-top: 20px;
          border-top: 1px dashed var(--border-glass);
          padding-top: 16px;
        }
        .super-system-message-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .super-system-message-input {
          width: 100%;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--border-glass);
          background: rgba(0, 0, 0, 0.02);
          color: var(--text-primary);
          padding: 0 12px;
          font-size: 13px;
          outline: none;
          transition: var(--transition-smooth);
        }
        [data-theme="dark"] .super-system-message-input {
          background: rgba(255, 255, 255, 0.02);
        }
        .super-system-message-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .super-system-message-actions {
          display: flex;
          gap: 8px;
        }
        .super-send-msg-btn, .super-clear-msg-btn {
          height: 36px;
          padding: 0 16px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: white;
        }
        .super-send-msg-btn {
          background: #3b82f6;
          flex: 1;
        }
        .super-send-msg-btn:hover {
          background: #2563eb;
        }
        .super-clear-msg-btn {
          background: #ef4444;
        }
        .super-clear-msg-btn:hover {
          background: #dc2626;
        }
        .super-active-msg-card {
          margin-top: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .active-msg-title {
          font-weight: 800;
          color: #ef4444;
        }
        .active-msg-text {
          color: var(--text-primary);
          line-height: 1.4;
        }

        /* アバター選択UI用スタイル */
        .avatar-category-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
          background: rgba(0, 0, 0, 0.03);
          padding: 4px;
          border-radius: 10px;
        }
        [data-theme="dark"] .avatar-category-tabs {
          background: rgba(255, 255, 255, 0.03);
        }
        .avatar-cat-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 4px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .avatar-cat-tab:hover {
          background: rgba(0, 0, 0, 0.02);
        }
        [data-theme="dark"] .avatar-cat-tab:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .avatar-cat-tab.active {
          background: var(--bg-glass-solid);
          color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        .avatar-grid-wrapper {
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.01);
          max-height: 180px;
          overflow-y: auto;
        }
        [data-theme="dark"] .avatar-grid-wrapper {
          background: rgba(255, 255, 255, 0.01);
        }
        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .avatar-item-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 4px;
          background: var(--bg-glass-solid);
          border: 1px solid var(--border-glass);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .avatar-item-btn:hover {
          transform: translateY(-2px);
          border-color: var(--accent-primary);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        }
        .avatar-item-btn.selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.05);
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.15);
        }
        [data-theme="dark"] .avatar-item-btn.selected {
          background: rgba(16, 185, 129, 0.1);
        }
        .avatar-emoji {
          font-size: 20px;
        }
        .avatar-label {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .avatar-item-btn.selected .avatar-label {
          color: #10b981;
        }

        /* ぷるぷる弾むCSSアニメーション */
        @keyframes rubberBand {
          from {
            transform: scale3d(1, 1, 1);
          }
          30% {
            transform: scale3d(1.25, 0.75, 1);
          }
          40% {
            transform: scale3d(0.75, 1.25, 1);
          }
          50% {
            transform: scale3d(1.15, 0.85, 1);
          }
          65% {
            transform: scale3d(0.95, 1.05, 1);
          }
          75% {
            transform: scale3d(1.05, 0.95, 1);
          }
          to {
            transform: scale3d(1, 1, 1);
          }
        }
        .avatar-rubber {
          animation: rubberBand 0.6s both;
        }
      `}</style>
    </div>
  );
};
