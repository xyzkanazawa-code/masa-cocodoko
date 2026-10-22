import React, { useState, useEffect, useRef } from 'react';
import { 
  LogOut, Copy, Check, QrCode, 
  Clock, AlertTriangle, MessageSquare, Send, Trash2, Bell, Volume2, VolumeX, RefreshCw,
  Download, Image, Loader2, Settings, Compass
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { 
  startOwnerSession, 
  stopOwnerSession, 
  updateLocation, 
  subscribeToTracking,
  isSimulating,
  startAutoSimulation,
  stopAutoSimulation,
  sendAnnouncement,
  clearAnnouncements,
  deleteFeedbackMessage,
  clearFeedbacks,
  subscribeToSystemMessage,
  updateOwnerProfile,
  AVATAR_CATEGORIES
} from '../services/trackingService';
import type { Owner, TrackingSession, SystemMessage } from '../services/trackingService';
import { MapViewer } from './MapViewer';
import './OwnerPortal.css'; // 外部CSSの読み込み（Vite oxcパーサーバグの完全解消）
 
interface OwnerPortalProps {
  owner: Owner;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onOwnerUpdate?: (updatedOwner: Owner) => void;
}
 
export const OwnerPortal: React.FC<OwnerPortalProps> = ({ owner, onLogout, theme, onOwnerUpdate }) => {
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false); // GPS現在地取得中のスピナー表示用
  
  // プロフィール設定用ステート
  const [profileNickname, setProfileNickname] = useState(owner.nickname || '');
  const [profileAvatar, setProfileAvatar] = useState(owner.avatarIcon || '🐰');
  const [profileAvatarCategory, setProfileAvatarCategory] = useState('animal');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // 親から渡されたowner情報の変更に追従する
  useEffect(() => {
    setProfileNickname(owner.nickname || '');
    setProfileAvatar(owner.avatarIcon || '🐰');
  }, [owner]);

  const [demoMode, setDemoMode] = useState(false); // PCデモ用
  const [isQrModalOpen, setIsQrModalOpen] = useState(false); // QR印刷モーダルの開閉
  const [printSize, setPrintSize] = useState<'a4' | 'a6' | 'card'>('a4'); // 印刷サイズ ('a4' | 'a6' | 'card')
  const [isPrintPending, setIsPrintPending] = useState(false); // 印刷処理待ちフラグ (DOM反映を確実にするため)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false); // スマホ保存用画像生成中フラグ
  const [savedImageDataUrl, setSavedImageDataUrl] = useState<string | null>(null); // 生成された画像URL
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false); // 画像長押し保存モーダルの開閉
  const [isDurationSelectorOpen, setIsDurationSelectorOpen] = useState(false); // 運行時間選択ポップアップの開閉
  const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false); // メッセージセンターの開閉
  const [announcementText, setAnnouncementText] = useState(''); // お知らせ配信用テキスト
  const [isMuted, setIsMuted] = useState<boolean>(false); // 通知音ミュート
  const [sosToast, setSosToast] = useState<{ id: string; lat: number; lng: number; message: string } | null>(null);
  const [mapFocusCoords, setMapFocusCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 緊急システムメッセージ（電光掲示板テロップ）用のステート
  const [systemMsg, setSystemMsg] = useState<SystemMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // 更新ボタンのアニメーション用

  // システムメッセージの購読監視
  useEffect(() => {
    const unsubscribe = subscribeToSystemMessage((msg) => {
      setSystemMsg(msg);
    });
    return () => unsubscribe();
  }, []);

  // 🖨️ 印刷サイズステートが確実にDOM・CSSに反映された後に印刷ダイアログを起動する安全設計
  useEffect(() => {
    if (isPrintPending) {
      const timer = setTimeout(() => {
        window.print();
        setIsPrintPending(false);
      }, 250); // DOMの再描画とCSSの動的バインドに十分な時間（250ms）を確保
      return () => clearTimeout(timer);
    }
  }, [isPrintPending, printSize]);

  // 手動リロードの実行
  const handleReload = () => {
    setIsRefreshing(true);
    // 心地よいトランジション効果を演出するために短いディレイを挿入
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const watchIdRef = useRef<number | null>(null);
  const prevFeedbacksLengthRef = useRef<number>(0);
  const prevSosIdsRef = useRef<Set<string>>(new Set());

  // 1. ローカルストレージ等から既存のセッションを取得・購読
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const sessionId = `session-${owner.id}`;

    unsubscribe = subscribeToTracking(sessionId, (currentSession) => {
      setSession(currentSession);
      if (currentSession && currentSession.status === 'active') {
        // シミュレータ稼働状況の同期
        setDemoMode(isSimulating(sessionId));
      } else {
        setDemoMode(false);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
      stopGpsTracking();
    };
  }, [owner.id]);

  // 優しい「ピンポーン♪」チャイムを再生する（Web Audio API）
  const playChime = () => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine'; // 優しいサイン波
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.05); // やわらかく立ち上げる
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration); // 滑らかに消えていく
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      playNote(659.25, now, 0.4);      // ミ（E5）
      playNote(523.25, now + 0.35, 0.8); // ド（C5）
    } catch (err) {
      console.error('チャイム音の再生に失敗しました:', err);
    }
  };

  // 緊迫感のあるSOSアラーム警告音を再生する（Web Audio API）
  const playSosAlarm = () => {
    if (isMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth'; // 警告音らしく鋭い鋸歯状波
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05); // すばやく立ち上げる
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      // ピピピッ、ピピピッというサイレン音 (0.1秒音を数回鳴らす)
      playTone(880, now, 0.15);
      playTone(880, now + 0.2, 0.15);
      playTone(880, now + 0.4, 0.15);
      
      playTone(987.77, now + 0.7, 0.15); // 音程を少し上げて緊迫感を出す
      playTone(987.77, now + 0.9, 0.15);
      playTone(987.77, now + 1.1, 0.15);
    } catch (err) {
      console.error('SOSアラーム音の再生に失敗しました:', err);
    }
  };

  // 新しい緊急SOSの受信を監視してアラームを鳴らし、トーストを表示する
  useEffect(() => {
    if (!session || !session.passengers) {
      prevSosIdsRef.current = new Set();
      return;
    }

    const passengers = session.passengers;
    const currentSosPassengers = Object.entries(passengers).filter(([_, p]) => p.isSos);
    const currentSosIds = new Set(currentSosPassengers.map(([id]) => id));

    // 新たにSOSを発信した乗客を特定
    const newSosPassengers = currentSosPassengers.filter(([id]) => !prevSosIdsRef.current.has(id));

    if (newSosPassengers.length > 0) {
      const [newId, passenger] = newSosPassengers[0];
      
      // SOSアラーム音を再生
      playSosAlarm();

      // トースト通知を表示
      setSosToast({
        id: newId,
        lat: passenger.lat,
        lng: passenger.lng,
        message: '⚠️ SOS受信：乗客から緊急の位置情報共有が届きました！'
      });
    }

    prevSosIdsRef.current = currentSosIds;
  }, [session?.passengers, isMuted]);

  // お客さまメッセージの受信監視と通知音再生
  useEffect(() => {
    if (!session || session.status !== 'active') {
      prevFeedbacksLengthRef.current = 0;
      return;
    }

    const feedbacks = session.feedbacks || [];
    
    // 前回の件数より増えている場合のみチャイムを鳴らす
    if (feedbacks.length > prevFeedbacksLengthRef.current) {
      // 初期ロード（件数が最初から存在していた場合）の誤爆を防ぐ
      if (prevFeedbacksLengthRef.current > 0 || feedbacks.length === 1) {
        playChime();
        // 自動でメッセージセンターを開いて気付きやすくする（プレミアム設計）
        setIsMessageCenterOpen(true);
      }
    }
    
    prevFeedbacksLengthRef.current = feedbacks.length;
  }, [session?.feedbacks?.length, session?.status, isMuted]);

  // お知らせの送信
  const handleSendAnnouncement = () => {
    if (!session || !announcementText.trim()) return;
    sendAnnouncement(session.id, announcementText);
    setAnnouncementText('');
  };

  // お知らせの全消去
  const handleClearAnnouncements = () => {
    if (!session) return;
    if (window.confirm('配信したお知らせ履歴をすべて削除しますか？')) {
      clearAnnouncements(session.id);
    }
  };

  // 特定の乗客連絡の削除（確認済）
  const handleDeleteFeedback = (msgId: string) => {
    if (!session) return;
    deleteFeedbackMessage(session.id, msgId);
  };

  // 乗客連絡の全消去（すべて確認済）
  const handleClearAllFeedbacks = () => {
    if (!session) return;
    if (window.confirm('すべての受信メッセージを確認済（削除）にしますか？')) {
      clearFeedbacks(session.id);
    }
  };



  // 3. Geolocation APIによる位置情報監視の開始
  const startGpsTracking = (sessionId: string) => {
    if (!navigator.geolocation) {
      setGpsErrorMsg('お使いのブラウザはGPS位置情報の取得に対応していません。');
      return;
    }

    setGpsErrorMsg(null);

    const options = {
      enableHighAccuracy: true, // 高精度GPS
      timeout: 15000,           // 15秒タイムアウトに延長
      maximumAge: 3000             // 3秒のキャッシュを許容して測位をスムーズに
    };

    const success = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      // データベースを更新
      updateLocation(sessionId, latitude, longitude);
    };

    const error = (err: GeolocationPositionError) => {
      console.warn(`GPS Error (${err.code}): ${err.message}`);
      
      // デモ中はGPSエラーを無視（シミュレータに委ねる）
      if (demoMode) return;

      switch (err.code) {
        case err.PERMISSION_DENIED:
          setGpsErrorMsg('位置情報の利用許可が拒否されました。設定を確認してください。');
          break;
        case err.POSITION_UNAVAILABLE:
          setGpsErrorMsg('位置情報が取得できませんでした（電波状況等）。');
          break;
        case err.TIMEOUT:
          setGpsErrorMsg('位置情報の取得タイムアウトが発生しました。');
          break;
        default:
          setGpsErrorMsg('位置情報の取得中に不明なエラーが発生しました。');
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(success, error, options);
  };

  // 4. GPS監視の停止
  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // 🧭 GPS現在地を再取得し、位置を即時更新して地図を移動（フォーカス）する
  const handleLocateOwner = () => {
    if (!navigator.geolocation) {
      alert('お使いの端末はGPS位置情報の取得に対応していません。');
      return;
    }

    setIsLocating(true);
    setGpsErrorMsg(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        
        // A. すでに運行セッションがアクティブな場合、最新の位置情報を即時に更新（送信）する
        if (session && session.status === 'active') {
          updateLocation(session.id, latitude, longitude);
        }

        // B. 地図の中心を最新の現在地に移動（フォーカス）させる
        setMapFocusCoords({ lat: latitude, lng: longitude });
        setIsLocating(false);

        // 2秒後にフォーカスを解除して、ユーザーが地図を自由にドラッグスクロールできるようにする
        setTimeout(() => {
          setMapFocusCoords(null);
        }, 2000);
      },
      (err) => {
        console.warn(`GPS getCurrentPosition Error: ${err.message}`);
        let errMsg = '位置情報の取得に失敗しました。';
        if (err.code === err.PERMISSION_DENIED) {
          errMsg = '位置情報の利用が許可されていません。ブラウザまたは本体の設定で位置情報を「許可」してください。';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errMsg = '現在地を測位できませんでした。電波の良い場所に移動するか、GPSがオンになっているか確認してください。';
        } else if (err.code === err.TIMEOUT) {
          errMsg = '位置情報の取得中にタイムアウトしました。もう一度お試しください。';
        }
        alert(errMsg);
        setGpsErrorMsg(errMsg);
        setIsLocating(false);
      },
      options
    );
  };

  // 5. 位置共有（セッション）開始処理（選択された時間を受け取れるように拡張）
  const handleStartSharing = (selectedDuration: number) => {
    setGpsErrorMsg(null);
    setIsDurationSelectorOpen(false);

    // 初期座標。GPSから一度だけ取得する。エラー時は東京駅周辺をデフォルトとする
    const startSessionWithCoords = (lat: number, lng: number) => {
      try {
        const newSession = startOwnerSession(owner.id, selectedDuration, lat, lng);
        // GPS追跡を開始
        startGpsTracking(newSession.id);
        // 運行開始時は、自動でQRコードモーダルを開く（マサさんの要望に応える親切設計）
        setIsQrModalOpen(true);
      } catch (err: any) {
        alert(err.message || 'セッション開始に失敗しました。');
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          startSessionWithCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // GPS取得に失敗した場合は、デフォルト座標（東京駅）でセッション開始
          startSessionWithCoords(35.681236, 139.767125);
          setGpsErrorMsg('GPSによる現在地取得が一時的に失敗したため、丸の内周辺で開始しました。左上の【🧭 現在地】ボタンを押すといつでも現在地にジャンプして位置情報を再取得できます！');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 } // タイムアウトを10秒に延長して測位成功率を上げる
      );
    } else {
      startSessionWithCoords(35.681236, 139.767125);
    }
  };

  // 6. 位置共有停止処理
  const handleStopSharing = () => {
    // シミュレータ停止
    const sessionId = `session-${owner.id}`;
    stopAutoSimulation(sessionId);
    setDemoMode(false);

    stopGpsTracking();
    stopOwnerSession(owner.id);
    setIsQrModalOpen(false);
  };

  // 安全に退出（ログアウト）する処理（位置送信中であれば停止してからログアウト）
  const handleLogoutWithStop = () => {
    if (session && session.status === 'active') {
      handleStopSharing();
    }
    onLogout();
  };

  // 7. PCデモ用シミュレータ切り替え
  const handleToggleDemoMode = () => {
    if (!session) return;
    const sessionId = session.id;

    if (demoMode) {
      stopAutoSimulation(sessionId);
      setDemoMode(false);
      // GPS追跡に復帰
      startGpsTracking(sessionId);
    } else {
      stopGpsTracking();
      // デモ用ルートでシミュレーション開始
      startAutoSimulation(sessionId, 3000);
      setDemoMode(true);
    }
  };

  // 8. 印刷実行（QRコード印刷用）
  const handlePrint = (size: 'a4' | 'a6' | 'card') => {
    setPrintSize(size);
    setIsPrintPending(true); // 非同期トリガーを引き、useEffectで安全に印刷を実行
  };

  // 📸 スマホ保存用の画像生成処理（サイズを引数で受け取るように拡張）
  const handleGenerateImageWithSize = async (size: 'a4' | 'a6' | 'card') => {
    setPrintSize(size);
    setIsGeneratingImage(true);
    
    // Reactの再描画とCSS適用（特にアスペクト比の切り替え）がDOMに100%確実に反映されるのを待つ
    await new Promise((resolve) => setTimeout(resolve, 200));

    const node = document.querySelector('.printable-qr-card');
    if (!node) {
      alert('画像に変換する要素が見つかりませんでした。');
      setIsGeneratingImage(false);
      return;
    }

    try {
      // CORS問題を極限まで回避し、背景を完全に白で高精度PNGに変換
      const dataUrl = await toPng(node as HTMLElement, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2, // 高解像度ディスプレイ（スマホ）でもQRがくっきり読めるように倍精細化
      });
      
      setSavedImageDataUrl(dataUrl);
      setIsSaveModalOpen(true);
    } catch (error) {
      console.error('スマホ保存用画像の生成に失敗しました:', error);
      alert('画像の生成に失敗しました。もう一度お試しいただくか、ブラウザの印刷機能をご利用ください。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // お客さんが閲覧する用のURL（スマホの強力なキャッシュとリダイレクトバグを強制突破するため、明示的なルートパス / と現在時刻を付与）
  // 開発環境（localhost）での動作検証中であっても、生成するQRコードやコピー用URLは常に本番環境のドメイン（masu-bus-tracking-d33dbba7.surge.sh）に強制的に固定します。
  // これにより、PCで管理者画面をローカルで動かしながらスマホでテストスキャンした際も、必ず本番の正常な画面にアクセスできるようになります。
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const productionOrigin = 'https://masa-iam-coco-test.surge.sh';
  const origin = isLocal ? productionOrigin : window.location.origin.replace('http://', 'https://');
  
  const viewerUrl = session 
    ? `${origin}/#session=${session.id}&cb=${Date.now()}` 
    : '';
  const qrCodeUrl = session 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(viewerUrl)}`
    : '';

  // プロフィールの保存処理
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    try {
      const updatedOwner = updateOwnerProfile(owner.id, profileNickname, profileAvatar);
      if (onOwnerUpdate) {
        onOwnerUpdate(updatedOwner);
      }
      setIsProfileModalOpen(false);
    } catch (err: any) {
      setProfileError(err.message || 'プロフィールの更新に失敗しました。');
    }
  };

  const handleExtendSession = (minutes: number) => {
    if (!session) return;
    // 座標はそのままに、有効期限（durationMinutes）のみを上書き更新（即時強制同期を実行）
    updateLocation(session.id, session.lat, session.lng, { durationMinutes: minutes }, true);
  };

  const handleCopyUrl = async () => {
    if (!viewerUrl) return;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = viewerUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getRoleLabel = () => {
    if (owner.role === 'bus') return 'バス運転手/ガイド';
    if (owner.role === 'delivery') return '配送スタッフ';
    return 'イベントスタッフ';
  };

  const getSizeLabel = (size: 'a4' | 'a6' | 'card') => {
    if (size === 'a4') return 'A4 (大・貼り紙)';
    if (size === 'a6') return 'A6 (中・卓上)';
    return '名刺カード (小)';
  };


  // 印刷時に動的に @page { size: ... } を上書きするインラインスタイル
  const getDynamicPrintStyle = () => {
    let sizeSpec = 'A4 portrait';
    // ブラウザ固有のヘッダー・フッター（日付やURL）を完全に非表示にするため、マージンは0にするのがプロフェッショナルな鉄則
    const marginSpec = '0'; 

    if (printSize === 'a6') {
      sizeSpec = 'A6 portrait';
    } else if (printSize === 'card') {
      sizeSpec = '55mm 91mm portrait';
    }

    return `
      @media print {
        @page {
          size: ${sizeSpec};
          margin: ${marginSpec};
        }
      }
    `;
  };

  return (
    <div className="portal-map-wrapper fade-in">
      {/* 🖨️ 動的用紙サイズ調整スタイルの流し込み */}
      <style dangerouslySetInnerHTML={{ __html: getDynamicPrintStyle() }} />

      {/* 📢 緊急全体メッセージ（電光掲示板テロップ） */}
      {systemMsg && (
        <div className="system-marquee-container glass-panel-solid fade-in">
          <div className="marquee-label">
            <AlertTriangle size={14} className="marquee-alert-icon animate-pulse" />
            <span>指示</span>
          </div>
          <div className="marquee-content-wrapper">
            <div className="marquee-text-flow">
              {systemMsg.text}　　　　{systemMsg.text}　　　　{systemMsg.text}
            </div>
          </div>
          <button 
            className={`marquee-reload-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleReload}
            title="最新状態に更新"
            disabled={isRefreshing}
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
            <span>更新する</span>
          </button>
        </div>
      )}

      {/* 緊急SOS警告トースト（タップで位置フォーカス） */}
      {sosToast && (
        <div 
          className="emergency-toast-container fade-in"
          onClick={() => {
            setMapFocusCoords({ lat: sosToast.lat, lng: sosToast.lng });
            setSosToast(null);
            setTimeout(() => setMapFocusCoords(null), 2000);
          }}
          title="タップして地図上でこの乗客の位置にフォーカスします"
        >
          <div className="emergency-toast glass-panel-solid">
            <AlertTriangle className="toast-icon pulse-sos-icon" />
            <div className="toast-body">
              <span className="toast-title">{sosToast.message}</span>
              <span className="toast-sub">タップして地図上の位置を確認する 🧭</span>
            </div>
            <button 
              className="toast-close"
              onClick={(e) => {
                e.stopPropagation();
                setSosToast(null);
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 1. 背景のフルスクリーン地図（ミニ地図を廃止し、大画面で快適操作） */}
      <div className="full-map-container">
        <MapViewer 
          session={session} 
          theme={theme} 
          isOwner={true} 
          focusCoords={mapFocusCoords} 
        />
      </div>

      {/* 左上の小さな退出ボタン（常に表示され、退出時に自動で位置共有を停止する安全設計） */}
      <button 
        className="fab-btn logout-fab glass-panel-solid fade-in" 
        onClick={handleLogoutWithStop} 
        title="退出（ログアウト）"
      >
        <LogOut size={16} />
        <span className="fab-label-small">退出</span>
      </button>

      {/* 左上の小さな設定ボタン（プロフィール・アバター編集用） */}
      <button 
        className="fab-btn settings-fab glass-panel-solid fade-in" 
        onClick={() => setIsProfileModalOpen(true)} 
        title="プロフィール設定（アバター・ニックネーム変更）"
      >
        <Settings size={16} />
        <span className="fab-label-small">設定</span>
      </button>

      {/* 最新状態に更新ボタン（常に手動で最新状態に更新可能） */}
      <button 
        className={`fab-btn reload-fab glass-panel-solid fade-in ${isRefreshing ? 'refreshing' : ''}`} 
        onClick={handleReload} 
        title="最新状態に更新"
        disabled={isRefreshing}
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        <span className="fab-label-small">更新</span>
      </button>

      {/* 現在地取得ボタン（ワンタップでGPS取得＆フォーカス） */}
      <button 
        className={`fab-btn locate-fab glass-panel-solid fade-in ${isLocating ? 'locating' : ''}`} 
        onClick={handleLocateOwner} 
        title="現在地を再取得して地図を移動"
        disabled={isLocating}
      >
        <Compass size={16} className={isLocating ? 'animate-spin' : ''} />
        <span className="fab-label-small">現在地</span>
      </button>

      {/* 連絡・メッセージボタン（運行中のみ左上、退出ボタンの下に表示） */}
      {session && session.status === 'active' && (
        <button
          className={`fab-btn message-fab glass-panel-solid fade-in ${isMessageCenterOpen ? 'active' : ''}`}
          onClick={() => setIsMessageCenterOpen(!isMessageCenterOpen)}
          title="メッセージセンターを開く"
        >
          <MessageSquare size={16} />
          <span className="fab-label-small">連絡・案内</span>
          {session.feedbacks && session.feedbacks.length > 0 && (
            <span className="unread-badge pulse-badge">
              {session.feedbacks.length}
            </span>
          )}
        </button>
      )}

      {/* 運行中メッセージセンター（サイドパネル） */}
      {session && session.status === 'active' && isMessageCenterOpen && (
        <div className="message-center-sidebar glass-panel-solid slide-in-left">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <MessageSquare size={18} className="title-icon" />
              <span>メッセージセンター</span>
            </div>
            
            <div className="sidebar-header-actions">
              <button 
                className="mute-toggle-btn"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "通知音をオン" : "通知音をミュート"}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button 
                className="sidebar-close-btn"
                onClick={() => setIsMessageCenterOpen(false)}
                title="閉じる"
              >
                ×
              </button>
            </div>
          </div>

          <div className="sidebar-body">
            {/* セクションA: お客さまへのお知らせ配信 */}
            <div className="sidebar-section">
              <h3 className="section-title">📢 お客さまへお知らせ配信</h3>
              <p className="section-desc">
                地図を閲覧中のお客さま全員の画面上部に、リアルタイムで表示されるメッセージを配信できます。
              </p>
              
              <div className="announcement-input-group">
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="例：渋滞のため、10分ほど遅れて運行しています。気をつけてお越しください。"
                  maxLength={150}
                  className="announcement-textarea"
                />
                <div className="input-footer">
                  <span className="char-count">{announcementText.length}/150文字</span>
                  <button
                    onClick={handleSendAnnouncement}
                    disabled={!announcementText.trim()}
                    className="send-announcement-btn"
                  >
                    <Send size={12} />
                    <span>配信</span>
                  </button>
                </div>
              </div>

              {/* 配信中のお知らせリスト */}
              {session.announcements && session.announcements.length > 0 && (
                <div className="announcement-history">
                  <div className="history-header">
                    <span>配信履歴</span>
                    <button onClick={handleClearAnnouncements} className="clear-history-btn">
                      <Trash2 size={10} />
                      <span>すべて消去</span>
                    </button>
                  </div>
                  <div className="history-list">
                    {session.announcements.slice().reverse().map((ann) => (
                      <div key={ann.id} className="history-item">
                        <p className="history-text">{ann.text}</p>
                        <span className="history-time">
                          {new Date(ann.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* セクションB: 乗客からの連絡受信（受信トレイ） */}
            <div className="sidebar-section">
              <div className="section-title-wrapper">
                <h3 className="section-title">📩 乗客からの連絡（受信トレイ）</h3>
                {session.feedbacks && session.feedbacks.length > 0 && (
                  <button onClick={handleClearAllFeedbacks} className="clear-feedbacks-btn">
                    すべて確認済
                  </button>
                )}
              </div>
              <p className="section-desc">
                地図上でお客さまがバス停などの目印として送ったメッセージが届きます（タップで確認済）。
              </p>

              {!session.feedbacks || session.feedbacks.length === 0 ? (
                <div className="empty-feedbacks">
                  <Bell size={24} className="bell-icon" />
                  <span>現在、乗客からの連絡はありません</span>
                </div>
              ) : (
                <div className="feedbacks-list">
                  {session.feedbacks.slice().reverse().map((fb) => (
                    <div key={fb.id} className="feedback-item fade-in">
                      <div className="feedback-item-header">
                        <span className="feedback-item-time">
                          {new Date(fb.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="feedback-check-btn"
                          title="確認済（削除）"
                        >
                          確認済
                        </button>
                      </div>
                      <p className="feedback-item-text">{fb.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 運行前（停止中）：地図上にポツンと浮かぶ「QRコード作成」ボタン */}
      {!session || session.status !== 'active' ? (
        /* 右下に大きく浮かぶ「QRコード作成（開始）」ボタン */
        <div className="floating-inactive-actions fade-in">
          <button 
            className="fab-btn start-fab" 
            onClick={() => setIsDurationSelectorOpen(true)}
            title="運行を開始してQRコードを作成します"
          >
            <QrCode size={24} />
            <span className="fab-label-large">QRコード作成</span>
          </button>
        </div>
      ) : (
        /* 3. 運行中（位置送信中）：右下に浮かぶ「QRコード」ボタンのみ（運行停止ボタンは完全削除） */
        <div className="floating-active-actions fade-in">
          {/* A4印刷・QRコード表示用の青い丸ボタン */}
          <button 
            className="fab-btn qr-fab" 
            onClick={() => setIsQrModalOpen(true)}
            title="QRコード表示・A4印刷"
          >
            <QrCode size={20} />
            <span className="fab-label">QRコード</span>
          </button>
        </div>
      )}

      {/* GPSエラー警告（送信中のみ画面上部にスマートにフロート表示） */}
      {session && session.status === 'active' && gpsErrorMsg && (
        <div className="floating-gps-warning glass-panel-solid fade-in">
          <AlertTriangle size={14} className="warning-icon" />
          <span>{gpsErrorMsg}</span>
        </div>
      )}

      {/* PC・デモ確認用の極小・半透明シミュレータリンク（画面左下に目立たず配置） */}
      {session && session.status === 'active' && (
        <div className="floating-demo-link-wrapper">
          <button 
            type="button"
            className={`demo-link-btn ${demoMode ? 'active' : ''}`}
            onClick={handleToggleDemoMode}
          >
            {demoMode ? '⚠️ デモ停止' : '🚌 PC用デモ走行'}
          </button>
        </div>
      )}

      {/* 4. 運行時間選択ポップアップシート（モーダル） */}
      {isDurationSelectorOpen && (
        <div className="duration-modal-overlay fade-in" onClick={() => setIsDurationSelectorOpen(false)}>
          <div className="duration-modal-content glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsDurationSelectorOpen(false)} title="閉じる">×</button>
            <div className="modal-body">
              <div className="modal-icon-wrapper">
                <QrCode size={32} className="modal-icon-blue" />
              </div>
              <h2 className="modal-title">QRコードの有効時間を選択</h2>
              <p className="modal-hint">
                時間が過ぎると自動的にお客さまの地図は見られなくなります。運行予定時間に合わせて選んでください。
              </p>
              
              <div className="duration-options-grid">
                <button className="duration-opt-btn" onClick={() => handleStartSharing(30)}>
                  <Clock size={16} />
                  <span>30分間 有効</span>
                </button>
                <button className="duration-opt-btn" onClick={() => handleStartSharing(60)}>
                  <Clock size={16} />
                  <span>1時間 有効</span>
                </button>
                <button className="duration-opt-btn" onClick={() => handleStartSharing(120)}>
                  <Clock size={16} />
                  <span>2時間 有効</span>
                </button>
                <button className="duration-opt-btn" onClick={() => handleStartSharing(240)}>
                  <Clock size={16} />
                  <span>4時間 有効</span>
                </button>
              </div>

              <button className="duration-cancel-btn" onClick={() => setIsDurationSelectorOpen(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. QRコード表示・A4印刷用ポップアップモーダル */}
      {isQrModalOpen && (
        <div className="qr-modal-overlay fade-in" onClick={() => setIsQrModalOpen(false)}>
          <div className="qr-modal-content glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h2 className="modal-title">お客さま用 QRコード印刷・共有</h2>
              <button className="modal-close-btn" onClick={() => setIsQrModalOpen(false)} title="閉じる">×</button>
            </div>
            
            <div className="modal-body">
              
              {session && session.status === 'active' && (
                <div className="modal-active-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                  
                  {/* 印刷用デザインカード（A4/A6/カードサイズ対応） */}
                  <div className={`printable-qr-card print-size-${printSize}`}>
                    {printSize !== 'card' ? (
                      <div className="print-header">
                        <span className="print-badge">リアルタイム位置情報共有サービス</span>
                        <h1>現在地をご確認いただけます</h1>
                        <p className="print-desc">
                          スマートフォンで下記のQRコードをスキャンすると、アプリ登録なしで、私たちのバスの現在地を地図上でリアルタイムに確認できます。
                        </p>
                      </div>
                    ) : (
                      <div className="print-header">
                        <span className="print-badge-card">🧭 位置情報共有</span>
                        <h1 className="print-title-card">現在地をMAPで確認！</h1>
                      </div>
                    )}

                    <div className="print-qr-wrapper">
                      <img 
                        src={qrCodeUrl} 
                        alt="位置共有用QRコード" 
                        className="print-qr-image"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            const errEl = parent.querySelector('.print-qr-error');
                            if (errEl) (errEl as HTMLElement).style.display = 'flex';
                            (e.target as HTMLElement).style.display = 'none';
                          }
                        }}
                      />
                      <div className="print-qr-error" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ef4444' }}>
                        <span>⚠️ QRコードの生成に失敗しました</span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>通信状況をご確認ください</span>
                      </div>
                    </div>

                    {printSize !== 'card' ? (
                      <div className="print-footer">
                        <h2>運行車両: <strong>{owner.avatarIcon ? `${owner.avatarIcon} ` : ''}{owner.nickname || owner.name}</strong> ({getRoleLabel()})</h2>
                        <p className="print-expiry">
                          ※このQRコードは、<strong>読み取ってから {session.durationMinutes >= 60 ? `${session.durationMinutes / 60}時間` : `${session.durationMinutes}分`}</strong> 有効です。
                        </p>
                        <p className="print-hint">（スキャンするだけでブラウザの地図がすぐに開きます）</p>
                      </div>
                    ) : (
                      <div className="print-footer-card">
                        <h2 className="print-veh-card">車両: <strong>{owner.avatarIcon ? `${owner.avatarIcon} ` : ''}{owner.nickname || owner.name}</strong></h2>
                        <p className="print-expiry-card">
                          有効時間: {session.durationMinutes >= 60 ? `${session.durationMinutes / 60}時間` : `${session.durationMinutes}分`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 有効時間のその場変更・延長ボタン（マサさんの要望に応える新機能） */}
                  <div className="extend-duration-section" style={{ width: '100%', marginTop: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', marginBottom: '8px', alignItems: 'center', gap: '4px' }}>
                      ⏱️ お客さまが読み取ってからの有効時間を変更：
                    </span>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', width: '100%' }}>
                      {[30, 60, 120, 240].map((mins) => {
                        const label = mins >= 60 ? `${mins / 60}時間` : `${mins}分`;
                        const isActive = session.durationMinutes === mins;
                        return (
                          <button
                            key={mins}
                            onClick={() => handleExtendSession(mins)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                              background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-glass-solid)',
                              color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: isActive ? '0 2px 8px rgba(59, 130, 246, 0.15)' : 'none'
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="modal-hint">
                    このQRコードを印刷して停留所や車内に掲示、またはカードとして配布してください。
                  </p>

                  <div className="modal-actions">
                    {/* スマホ画像保存ボタン3連（マサさんのアイデアに基づく超直感的UI） */}
                    <div className="save-buttons-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <button 
                        className={`save-image-btn ${isGeneratingImage && printSize === 'a4' ? 'generating' : ''}`}
                        onClick={() => handleGenerateImageWithSize('a4')}
                        disabled={isGeneratingImage}
                      >
                        {isGeneratingImage && printSize === 'a4' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>A4チラシ画像を作成中...</span>
                          </>
                        ) : (
                          <>
                            <Image size={16} />
                            <span>📱 A4 (大・貼り紙) サイズでスマホに保存</span>
                          </>
                        )}
                      </button>

                      <button 
                        className={`save-image-btn a6-save-btn ${isGeneratingImage && printSize === 'a6' ? 'generating' : ''}`}
                        onClick={() => handleGenerateImageWithSize('a6')}
                        disabled={isGeneratingImage}
                      >
                        {isGeneratingImage && printSize === 'a6' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>A6チラシ画像を作成中...</span>
                          </>
                        ) : (
                          <>
                            <Image size={16} />
                            <span>📱 A6 (中・卓上POP) サイズでスマホに保存</span>
                          </>
                        )}
                      </button>

                      <button 
                        className={`save-image-btn card-save-btn ${isGeneratingImage && printSize === 'card' ? 'generating' : ''}`}
                        style={{
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(124, 58, 237, 0.15))',
                          border: '1px solid rgba(168, 85, 247, 0.25)',
                          color: '#a855f7'
                        }}
                        onClick={() => handleGenerateImageWithSize('card')}
                        disabled={isGeneratingImage}
                      >
                        {isGeneratingImage && printSize === 'card' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>名刺カード画像を作成中...</span>
                          </>
                        ) : (
                          <>
                            <Image size={16} />
                            <span>📱 名刺カード (小) サイズでスマホに保存</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 紙に印刷したい人向け：サブ的な極小横並び印刷ボタン */}
                    <div className="print-actions-sub-row" style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
                      <button 
                        className="print-btn-sub" 
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '10px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--bg-glass-solid)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handlePrint('a4')}
                      >
                        🖨️ A4で印刷
                      </button>
                      <button 
                        className="print-btn-sub" 
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '10px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--bg-glass-solid)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handlePrint('a6')}
                      >
                        🖨️ A6で印刷
                      </button>
                      <button 
                        className="print-btn-sub" 
                        style={{
                          flex: 1,
                          padding: '10px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          borderRadius: '10px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--bg-glass-solid)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handlePrint('card')}
                      >
                        💳 カード印刷
                      </button>
                    </div>
                    
                    <div className="url-copy-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔗 お客さま用の直接リンク（URL）：
                      </span>
                      
                      <div className="url-copy-box" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <input 
                          type="text" 
                          readOnly 
                          value={viewerUrl} 
                          className="modal-url-input" 
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-glass)',
                            background: 'rgba(0, 0, 0, 0.04)',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            outline: 'none'
                          }}
                        />
                        <button 
                          className={`copy-btn ${isCopied ? 'copied' : ''}`} 
                          onClick={handleCopyUrl}
                          style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: isCopied ? '#10b981' : 'var(--accent-primary)',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
                          }}
                        >
                          {isCopied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{isCopied ? 'コピー済' : 'URLコピー'}</span>
                        </button>
                      </div>

                      {/* LINEやメール共有用の親切なテキストテンプレート生成機能 */}
                      <button
                        onClick={async () => {
                          const shareText = `🚌 【リアルタイム位置情報】こちらのリンクから、私たちのバスの現在地を地図上で今すぐご確認いただけます！アプリ不要でご覧いただけます：\n${viewerUrl}`;
                          try {
                            await navigator.clipboard.writeText(shareText);
                            alert('LINE・メール送信用の案内文章をコピーしました！そのまま貼り付けて送信してください。');
                          } catch (err) {
                            const textarea = document.createElement('textarea');
                            textarea.value = shareText;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                            alert('LINE・メール送信用の案内文章をコピーしました！そのまま貼り付けて送信してください。');
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: '1px dashed #10b981',
                          background: 'rgba(16, 185, 129, 0.05)',
                          color: '#10b981',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        ✉️ LINE・メールで送る案内文をまるごとコピー
                      </button>

                      {/* テスト用にPC/スマホで直接開くための便利ボタン */}
                      <a 
                        href={viewerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--bg-glass-solid)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 600,
                          textAlign: 'center',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        🌐 この端末で乗客用MAP画面を直接開く（動作テスト用）
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 📸 スマホ用・画像長押し保存用ポップアップモーダル */}
      {isSaveModalOpen && savedImageDataUrl && (
        <div className="save-image-modal-overlay fade-in" onClick={() => setIsSaveModalOpen(false)}>
          <div className="save-image-modal-content glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsSaveModalOpen(false)} title="閉じる">×</button>
            
            <div className="modal-body" style={{ padding: '24px 16px' }}>
              <div className="modal-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                <Image size={32} style={{ color: '#10b981' }} />
              </div>
              <h2 className="modal-title">スマホ画像保存 ({getSizeLabel(printSize)})</h2>
              
              <div className="save-instruction-alert">
                <span className="alert-emoji">💡</span>
                <p className="alert-text">
                  選択した<strong>【{getSizeLabel(printSize)}】</strong>の画像が完成しました！下の<strong>画像を長押し（ロングタップ）</strong>して、表示されるメニューから<strong>「画像を保存」</strong>または<strong>「写真に追加」</strong>を選択してください！
                </p>
              </div>

              {/* 生成された高解像度画像（長押し保存のターゲット） */}
              <div className="generated-image-container">
                <img 
                  src={savedImageDataUrl} 
                  alt="保存用QRカード画像" 
                  className="generated-image-preview" 
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '8px' }}>
                {/* 直接ダウンロードボタン（パソコンや一部スマホ向け） */}
                <a 
                  href={savedImageDataUrl} 
                  download={`qr-location-sharing-${printSize}.png`}
                  className="direct-download-btn"
                  onClick={() => setIsSaveModalOpen(false)}
                >
                  <Download size={14} />
                  <span>端末へ直接ダウンロード</span>
                </a>
                
                <button className="save-modal-close-btn" onClick={() => setIsSaveModalOpen(false)}>
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ プロフィール設定モーダル（アバター・ニックネーム編集用） */}
      {isProfileModalOpen && (
        <div className="duration-modal-overlay fade-in" onClick={() => setIsProfileModalOpen(false)}>
          <div className="duration-modal-content glass-panel-solid" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsProfileModalOpen(false)} title="閉じる">×</button>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div className="modal-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                <Settings size={32} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h2 className="modal-title">プロフィール設定</h2>
              <p className="modal-hint" style={{ marginBottom: '16px' }}>
                運行ドライバーのニックネームや、地図上に表示されるアバターアイコンを変更できます。変更はリアルタイムで即時反映されます。
              </p>

              <form onSubmit={handleSaveProfile} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {profileError && (
                  <div className="error-alert fade-in" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    fontSize: '12.5px'
                  }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span>{profileError}</span>
                  </div>
                )}

                {/* ニックネーム入力欄 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label htmlFor="profile-nickname" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    地図表示ニックネーム（任意）
                  </label>
                  <div className="input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', left: '14px', position: 'absolute', pointerEvents: 'none' }}>✨</span>
                    <input
                      id="profile-nickname"
                      type="text"
                      value={profileNickname}
                      onChange={(e) => setProfileNickname(e.target.value)}
                      placeholder="例: パットバスうさぎ 🐰"
                      maxLength={15}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-glass)',
                        background: 'rgba(0, 0, 0, 0.02)',
                        color: 'var(--text-primary)',
                        padding: '0 12px 0 38px',
                        fontSize: '13.5px',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    地図上に常時表示されるニックネームです。未入力の場合はお名前が表示されます。
                  </span>
                </div>

                {/* 可愛いアバターアイコン選択 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    アバターアイコンを選択（全36種）
                  </label>
                  
                  {/* カテゴリタブ */}
                  <div className="avatar-category-tabs">
                    {AVATAR_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`avatar-cat-tab ${profileAvatarCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setProfileAvatarCategory(cat.id)}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* アバターグリッド */}
                  <div className="avatar-grid-wrapper">
                    <div className="avatar-grid">
                      {AVATAR_CATEGORIES.find(cat => cat.id === profileAvatarCategory)?.items.map(item => {
                        const isSelected = profileAvatar === item.emoji;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`avatar-item-btn ${isSelected ? 'selected avatar-rubber' : ''}`}
                            onClick={() => setProfileAvatar(item.emoji)}
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

                {/* アクションボタン */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-primary), #2563eb)',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
                      transition: 'all 0.2s'
                    }}
                  >
                    変更を保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-glass)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

