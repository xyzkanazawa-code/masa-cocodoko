export interface Announcement {
  id: string;
  text: string;
  timestamp: number;
}

export interface AvatarItem {
  key: string;
  emoji: string;
  label: string;
}

export interface AvatarCategory {
  id: string;
  name: string;
  icon: string;
  items: AvatarItem[];
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  {
    id: 'vehicle',
    name: 'のりもの',
    icon: '🚌',
    items: [
      { key: 'bus', emoji: '🚌', label: 'バス' },
      { key: 'delivery', emoji: '🚚', label: '配送車' },
      { key: 'car', emoji: '🚗', label: '乗用車' },
      { key: 'bike', emoji: '🛵', label: 'バイク' },
      { key: 'bicycle', emoji: '🚲', label: 'じてんしゃ' },
      { key: 'train', emoji: '🚇', label: 'でんしゃ' },
      { key: 'airplane', emoji: '✈️', label: 'ひこうき' },
      { key: 'ship', emoji: '🚢', label: 'おふね' },
      { key: 'helicopter', emoji: '🚁', label: 'ヘリ' },
      { key: 'tractor', emoji: '🚜', label: 'トラクター' },
      { key: 'firetruck', emoji: '🚒', label: 'しょうぼうしゃ' },
      { key: 'ambulance', emoji: '🚑', label: 'きゅうきゅうしゃ' },
    ]
  },
  {
    id: 'animal',
    name: 'どうぶつ',
    icon: '🐰',
    items: [
      { key: 'rabbit', emoji: '🐰', label: 'うさぎ' },
      { key: 'cat', emoji: '🐱', label: 'ねこ' },
      { key: 'dog', emoji: '🐶', label: 'いぬ' },
      { key: 'bear', emoji: '🐻', label: 'くま' },
      { key: 'panda', emoji: '🐼', label: 'ぱんだ' },
      { key: 'lion', emoji: '🦁', label: 'らいおん' },
      { key: 'tiger', emoji: '🐯', label: 'とら' },
      { key: 'koala', emoji: '🐨', label: 'こあら' },
      { key: 'fox', emoji: '🦊', label: 'きつね' },
      { key: 'frog', emoji: '🐸', label: 'かえる' },
      { key: 'monkey', emoji: '🐵', label: 'さる' },
      { key: 'chick', emoji: '🐥', label: 'ひよこ' },
    ]
  },
  {
    id: 'happy',
    name: 'ハッピー',
    icon: '🍀',
    items: [
      { key: 'clover', emoji: '🍀', label: 'よつば' },
      { key: 'cherry', emoji: '🌸', label: 'さくら' },
      { key: 'sun', emoji: '☀️', label: 'たいよう' },
      { key: 'rainbow', emoji: '🌈', label: 'にじ' },
      { key: 'apple', emoji: '🍎', label: 'りんご' },
      { key: 'strawberry', emoji: '🍓', label: 'いちご' },
      { key: 'pizza', emoji: '🍕', label: 'ぴざ' },
      { key: 'icecream', emoji: '🍦', label: 'あいす' },
      { key: 'balloon', emoji: '🎈', label: 'ふうせん' },
      { key: 'gift', emoji: '🎁', label: 'プレゼント' },
      { key: 'rocket', emoji: '🚀', label: 'ロケット' },
      { key: 'diamond', emoji: '💎', label: 'だいや' },
    ]
  }
];

export interface FeedbackMessage {
  id: string;
  text: string;
  timestamp: number;
}

export interface PassengerLocation {
  id: string;
  lat: number;
  lng: number;
  isSos: boolean;
  updatedAt: number; // 最終更新タイムスタンプ
}

export interface TrackingSession {
  id: string;
  name: string;
  type: 'bus' | 'delivery' | 'person';
  status: 'active' | 'paused' | 'inactive';
  lat: number;
  lng: number;
  bearing?: number; // 進行方向（度数法 0-360）
  updatedAt: string;
  expiresAt: string;
  durationMinutes: number; // お客さまが読み取ってからの有効時間（分）
  announcements?: Announcement[];
  feedbacks?: FeedbackMessage[];
  passengers?: Record<string, PassengerLocation>;
  nickname?: string;
  avatarIcon?: string;
}

export interface Owner {
  id: string;
  name: string;
  passcode: string; // 4桁の暗証番号
  role: 'bus' | 'delivery' | 'person';
  sessionId?: string;
  nickname?: string;
  avatarIcon?: string;
}

const OWNERS_KEY = 'coco-doco-owners';
const SESSIONS_KEY = 'coco-doco-sessions';

// -------------------------------------------------------------
// デモ用の初期データ
// -------------------------------------------------------------
const initialSessions: Record<string, TrackingSession> = {
  'bus-01': {
    id: 'bus-01',
    name: 'デモ用パットバス 1号車',
    type: 'bus',
    status: 'active',
    lat: 35.681236,
    lng: 139.767125,
    bearing: 0,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // デモ用は8時間有効
    durationMinutes: 60,
    nickname: 'パットバスうさぎ 🐰',
    avatarIcon: '🐰'
  },
  'delivery-01': {
    id: 'delivery-01',
    name: 'デモ用配送車 A',
    type: 'delivery',
    status: 'active',
    lat: 35.658580,
    lng: 139.745433,
    bearing: 90,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    nickname: 'ねこ急便 🐱',
    avatarIcon: '🐱'
  },
  'person-01': {
    id: 'person-01',
    name: 'デモ用イベントスタッフ 山田太郎',
    type: 'person',
    status: 'active',
    lat: 35.626446,
    lng: 139.723444,
    bearing: 180,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    nickname: 'ぴよぴよスタッフ 🐥',
    avatarIcon: '🐥'
  }
};

// -------------------------------------------------------------
// 模擬データベース（LocalStorageヘルパー）
// -------------------------------------------------------------
const getStoredOwners = (): Record<string, Owner> => {
  const data = localStorage.getItem(OWNERS_KEY);
  return data ? JSON.parse(data) : {};
};

const saveOwners = (owners: Record<string, Owner>) => {
  localStorage.setItem(OWNERS_KEY, JSON.stringify(owners));
};

const getStoredSessions = (): Record<string, TrackingSession> => {
  const data = localStorage.getItem(SESSIONS_KEY);
  const parsed = data ? JSON.parse(data) : {};
  // 初期データとマージ
  return { ...initialSessions, ...parsed };
};

// -------------------------------------------------------------
// クラウド同期機能 (ntfy.sh を利用)
// -------------------------------------------------------------
// スロットリングと遅延送信用のメモリ空間
const lastPublishTime: Record<string, number> = {};
const delayedPublishTimers: Record<string, any> = {};

const clearDelayedPublish = (id: string) => {
  if (delayedPublishTimers[id]) {
    clearTimeout(delayedPublishTimers[id]);
    delete delayedPublishTimers[id];
  }
};

const scheduleDelayedPublish = (session: TrackingSession) => {
  if (delayedPublishTimers[session.id]) return; // すでに予約されている場合は重ねない
  
  delayedPublishTimers[session.id] = setTimeout(() => {
    delete delayedPublishTimers[session.id];
    publishSessionToCloud(session, true); // 強制即時送信として実行
  }, 8500); // スロットリング周期（8秒）よりもわずかに長いディレイ
};

const publishSessionToCloud = async (session: TrackingSession, force = false) => {
  try {
    const now = Date.now();
    const lastTime = lastPublishTime[session.id] || 0;
    
    // SOS状態の乗客がいる、セッションが停止/一時停止、または強制即時フラグがある場合は即時送信
    const isEmergencyOrStatusChange = 
      force ||
      session.status === 'inactive' ||
      session.status === 'paused' ||
      (session.passengers && Object.values(session.passengers).some(p => p.isSos));
      
    if (!isEmergencyOrStatusChange && now - lastTime < 8000) {
      // 8秒未満の高頻度更新はスキップし、最後の移動位置を確実にとらえるため遅延送信を予約
      scheduleDelayedPublish(session);
      return;
    }
    
    // 送信確定のため、遅延タイマーを消去し、最終送信時間を更新
    clearDelayedPublish(session.id);
    lastPublishTime[session.id] = now;

    await fetch(`https://ntfy.sh/coco-doco-${session.id}`, {
      method: 'POST',
      body: JSON.stringify(session),
      headers: {
        'Title': 'Tracking Session Update',
        'Tags': 'location_update'
      }
    });
  } catch (e) {
    console.error('[CloudSync] Failed to publish session:', e);
  }
};

const saveSessions = (
  sessions: Record<string, TrackingSession>, 
  skipCloudSync = false,
  forceCloudSync = false
) => {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  
  if (!skipCloudSync) {
    Object.values(sessions).forEach(session => {
      publishSessionToCloud(session, forceCloudSync);
    });
  }
};

// -------------------------------------------------------------
// リアルタイム通知（オブザーバーパターン）
// -------------------------------------------------------------
const listeners: Record<string, Set<(session: TrackingSession | null) => void>> = {};

const notifyListeners = (id: string, sessionsData: Record<string, TrackingSession>) => {
  if (listeners[id]) {
    const data = sessionsData[id] ? { ...sessionsData[id] } : null;
    
    // 期限切れチェック
    if (data && new Date(data.expiresAt) < new Date()) {
      listeners[id].forEach(cb => cb({ ...data, status: 'inactive' }));
    } else {
      listeners[id].forEach(cb => cb(data));
    }
  }
};

// -------------------------------------------------------------
// オーナー登録・ログイン機能
// -------------------------------------------------------------

/**
 * オーナーの新規登録
 */
export const registerOwner = (
  name: string,
  passcode: string,
  role: 'bus' | 'delivery' | 'person',
  nickname?: string,
  avatarIcon?: string
): Owner => {
  const owners = getStoredOwners();
  
  // 同名登録チェック
  const normalizedName = name.trim();
  const exists = Object.values(owners).some(
    o => o.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (exists) {
    throw new Error('この名前はすでに登録されています。');
  }

  // 簡易暗証番号チェック（4桁数字）
  if (!/^\d{4}$/.test(passcode)) {
    throw new Error('暗証番号は4桁の数字で入力してください。');
  }

  const id = `owner-${Date.now()}`;
  const newOwner: Owner = {
    id,
    name: normalizedName,
    passcode,
    role,
    nickname: nickname?.trim() || undefined,
    avatarIcon
  };

  owners[id] = newOwner;
  saveOwners(owners);
  return newOwner;
};

/**
 * オーナーログイン
 */
export const loginOwner = (name: string, passcode: string): Owner => {
  const owners = getStoredOwners();
  const normalizedName = name.trim();
  
  const owner = Object.values(owners).find(
    o => o.name.toLowerCase() === normalizedName.toLowerCase() && o.passcode === passcode
  );

  if (!owner) {
    throw new Error('名前または暗証番号が正しくありません。');
  }

  return owner;
};

// -------------------------------------------------------------
// セッション管理
// -------------------------------------------------------------

/**
 * オーナー用の新しい追跡セッションの開始（位置共有開始）
 */
export const startOwnerSession = (
  ownerId: string,
  durationMinutes: number, // 30, 60, 120, 240
  initialLat: number,
  initialLng: number
): TrackingSession => {
  const owners = getStoredOwners();
  const owner = owners[ownerId];
  if (!owner) {
    throw new Error('オーナー情報が見つかりません。');
  }

  const sessions = getStoredSessions();
  const sessionId = `session-${ownerId}`;
  
  // 有効期限の計算（セッション自体は最大24時間有効にしておき、QRコード自体がいつでも読み取れるようにする）
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 役割に応じた日本語表示名の生成
  let roleLabel = 'バス';
  if (owner.role === 'delivery') roleLabel = '配送車';
  if (owner.role === 'person') roleLabel = 'スタッフ';

  const newSession: TrackingSession = {
    id: sessionId,
    name: owner.nickname ? `${owner.nickname} (${owner.name})` : `${owner.name} の${roleLabel}`,
    type: owner.role,
    status: 'active',
    lat: initialLat,
    lng: initialLng,
    bearing: 0,
    updatedAt: new Date().toISOString(),
    expiresAt,
    durationMinutes,
    nickname: owner.nickname,
    avatarIcon: owner.avatarIcon
  };

  sessions[sessionId] = newSession;
  saveSessions(sessions, false, true); // セッション開始時はスロットリングを無視して強制即時同期

  // オーナーの紐付け更新
  owner.sessionId = sessionId;
  owners[ownerId] = owner;
  saveOwners(owners);

  notifyListeners(sessionId, sessions);
  return newSession;
};

/**
 * オーナー用の追跡セッションの停止（位置共有終了）
 */
export const stopOwnerSession = (ownerId: string) => {
  const owners = getStoredOwners();
  const owner = owners[ownerId];
  if (!owner || !owner.sessionId) return;

  const sessions = getStoredSessions();
  const session = sessions[owner.sessionId];
  
  if (session) {
    session.status = 'inactive';
    session.expiresAt = new Date(Date.now() - 1000).toISOString(); // 即時期限切れにする
    sessions[owner.sessionId] = session;
    saveSessions(sessions, false, true); // セッション停止時は強制即時同期
    notifyListeners(owner.sessionId, sessions);
  }

  // オーナーの紐付け解除
  delete owner.sessionId;
  owners[ownerId] = owner;
  saveOwners(owners);
};

// -------------------------------------------------------------
// 閲覧用リアルタイム同期
// -------------------------------------------------------------

/**
 * 対象の位置情報をリアルタイム購読（監視）する関数
 */
// -------------------------------------------------------------
// クラウドデータマージ処理 (競合防止)
// -------------------------------------------------------------
const mergeSessionData = (
  current: TrackingSession | null, 
  incoming: TrackingSession, 
  id: string
): TrackingSession => {
  if (!current) return incoming;

  const storedOwnerStr = localStorage.getItem('coco-doco-current-owner');
  let isOwner = false;
  if (storedOwnerStr) {
    try {
      const owner = JSON.parse(storedOwnerStr);
      if (owner.sessionId === id) {
        isOwner = true;
      }
    } catch {}
  }

  if (isOwner) {
    return {
      ...current,
      feedbacks: incoming.feedbacks || current.feedbacks || [],
      passengers: incoming.passengers || current.passengers || {}
    };
  } else {
    return incoming;
  }
};

export const subscribeToTracking = (
  id: string,
  callback: (session: TrackingSession | null) => void
): (() => void) => {
  if (!listeners[id]) {
    listeners[id] = new Set();
  }
  listeners[id].add(callback);

  // 初回データ送信 (ローカルキャッシュから)
  const sessions = getStoredSessions();
  let currentSession = sessions[id] ? { ...sessions[id] } : null;
  
  if (currentSession && new Date(currentSession.expiresAt) < new Date()) {
    callback({ ...currentSession, status: 'inactive' });
  } else {
    callback(currentSession);
  }

  let isUnsubscribed = false;

  // クラウドの最新状態をポーリングで取得する関数（JSON Lines逆順走査の堅牢設計）
  const fetchLatestFromCloud = async () => {
    try {
      const response = await fetch(`https://ntfy.sh/coco-doco-${id}/json?poll=1`);
      const text = await response.text();
      if (!text || isUnsubscribed) return;

      const lines = text.trim().split('\n');
      let latestIncomingSession: TrackingSession | null = null;

      // 逆順（最新のメッセージから順）にスキャンし、最初にパース成功した有効なメッセージを採用する
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const payload = JSON.parse(line);
          if (payload.event === 'message' && payload.message) {
            const parsed = JSON.parse(payload.message) as TrackingSession;
            if (parsed && parsed.id && parsed.status) {
              latestIncomingSession = parsed;
              break;
            }
          }
        } catch (e) {
          // 個別のパースエラーは無視して前の行を探す
        }
      }

      if (latestIncomingSession) {
        const localSessions = getStoredSessions();
        const localSession = localSessions[id] || null;
        const merged = mergeSessionData(localSession, latestIncomingSession, id);
        
        localSessions[id] = merged;
        saveSessions(localSessions, true); // クラウド同期はスキップ
        
        currentSession = merged;
        callback(merged);
      } else {
        // クラウドに有効なデータがなく、かつデモ用セッションの場合はローカルキャッシュをそのまま生かす
        if (id.startsWith('bus-') || id.startsWith('delivery-') || id.startsWith('person-')) {
          const localSessions = getStoredSessions();
          if (localSessions[id]) {
            callback(localSessions[id]);
          }
        }
      }
    } catch (e) {
      console.error('[CloudSync] Failed to fetch initial cloud data:', e);
      // 通信エラー時のデモ用フォールバック
      if (id.startsWith('bus-') || id.startsWith('delivery-') || id.startsWith('person-')) {
        const localSessions = getStoredSessions();
        if (localSessions[id]) {
          callback(localSessions[id]);
        }
      }
    }
  };

  fetchLatestFromCloud();

  // 定期的なポーリングによるバックグラウンド同期フォールバック (SSEの電波瞬断・パケットロス対策)
  const pollInterval = setInterval(() => {
    if (!isUnsubscribed) {
      fetchLatestFromCloud();
    }
  }, 10000); // 10秒おきに実行

  // EventSource (SSE) によるリアルタイム購読
  const eventSource = new EventSource(`https://ntfy.sh/coco-doco-${id}/sse`);
  
  eventSource.onmessage = (event) => {
    if (isUnsubscribed) return;
    try {
      const payload = JSON.parse(event.data);
      if (payload.event === 'message' && payload.message) {
        const incomingSession = JSON.parse(payload.message) as TrackingSession;
        
        const localSessions = getStoredSessions();
        const localSession = localSessions[id] || null;
        const merged = mergeSessionData(localSession, incomingSession, id);
        
        localSessions[id] = merged;
        saveSessions(localSessions, true);
        
        currentSession = merged;
        
        callback(merged);
        listeners[id].forEach(cb => {
          if (cb !== callback) cb(merged);
        });
      }
    } catch (e) {
      console.error('[CloudSync] Failed to parse SSE event:', e);
    }
  };

  eventSource.onerror = (e) => {
    console.warn('[CloudSync] SSE Connection warning/error:', e);
  };

  // 購読解除関数
  return () => {
    isUnsubscribed = true;
    eventSource.close();
    clearInterval(pollInterval); // 定期ポーリングタイマーをクリア
    listeners[id].delete(callback);
    if (listeners[id].size === 0) {
      delete listeners[id];
    }
  };
};

/**
 * 位置情報の更新（オーナーからのGPS送信、またはデモシミュレータ）
 */
export const updateLocation = (
  id: string,
  lat: number,
  lng: number,
  options?: Partial<Omit<TrackingSession, 'id' | 'lat' | 'lng'>>,
  forceCloudSync = false
) => {
  const sessions = getStoredSessions();
  if (sessions[id]) {
    const prev = sessions[id];
    
    // ベアリング（向き）の自動計算
    let bearing = prev.bearing;
    if (lat !== prev.lat || lng !== prev.lng) {
      const toRadians = (deg: number) => (deg * Math.PI) / 180;
      const lat1 = toRadians(prev.lat);
      const lat2 = toRadians(lat);
      const dLng = toRadians(lng - prev.lng);

      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    sessions[id] = {
      ...prev,
      lat,
      lng,
      bearing,
      updatedAt: new Date().toISOString(),
      ...options
    };
    
    saveSessions(sessions, false, forceCloudSync);
    notifyListeners(id, sessions);
  }
};

// -------------------------------------------------------------
// デモ用自動巡回シミュレータ (これまでのデモを維持するため)
// -------------------------------------------------------------
const autoRouteIntervals: Record<string, any> = {};
const autoRouteIndices: Record<string, number> = {};

// 東京周辺のサンプルルートデータ（自動巡回用）
const SAMPLE_ROUTES: Record<string, { lat: number; lng: number }[]> = {
  'bus-01': [
    { lat: 35.681236, lng: 139.767125 }, // 東京駅
    { lat: 35.684136, lng: 139.767425 },
    { lat: 35.686536, lng: 139.762125 },
    { lat: 35.683536, lng: 139.757125 }, // 皇居周辺
    { lat: 35.678536, lng: 139.756125 },
    { lat: 35.674536, lng: 139.760125 }, // 有楽町周辺
    { lat: 35.676536, lng: 139.764125 },
    { lat: 35.681236, lng: 139.767125 }
  ],
  'delivery-01': [
    { lat: 35.658580, lng: 139.745433 }, // 東京タワー
    { lat: 35.662580, lng: 139.740433 },
    { lat: 35.667580, lng: 139.742433 },
    { lat: 35.665580, lng: 139.752433 },
    { lat: 35.659580, lng: 139.750433 },
    { lat: 35.658580, lng: 139.745433 }
  ],
  'person-01': [
    { lat: 35.626446, lng: 139.723444 }, // 五反田駅
    { lat: 35.628446, lng: 139.726444 },
    { lat: 35.625446, lng: 139.730444 },
    { lat: 35.622446, lng: 139.727444 },
    { lat: 35.626446, lng: 139.723444 }
  ]
};

export const startAutoSimulation = (id: string, intervalMs: number = 2000) => {
  if (autoRouteIntervals[id]) return;

  const route = SAMPLE_ROUTES[id] || (id.startsWith('session-') ? SAMPLE_ROUTES['bus-01'] : null);
  if (!route) return;

  if (autoRouteIndices[id] === undefined) {
    autoRouteIndices[id] = 0;
  }

  autoRouteIntervals[id] = setInterval(() => {
    let index = autoRouteIndices[id];
    const currentPoint = route[index];
    const nextIndex = (index + 1) % route.length;
    const nextPoint = route[nextIndex];
    
    const steps = 10;
    let step = 0;

    const lerpInterval = setInterval(() => {
      if (step >= steps) {
        clearInterval(lerpInterval);
        autoRouteIndices[id] = nextIndex;
        return;
      }
      step++;
      const ratio = step / steps;
      const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * ratio;
      const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * ratio;
      
      updateLocation(id, lat, lng, { status: 'active' });
    }, intervalMs / steps);

  }, intervalMs);
};

export const stopAutoSimulation = (id: string) => {
  if (autoRouteIntervals[id]) {
    clearInterval(autoRouteIntervals[id]);
    delete autoRouteIntervals[id];
  }
};

export const isSimulating = (id: string): boolean => {
  return !!autoRouteIntervals[id];
};

export const getAllSessions = (): TrackingSession[] => {
  const sessions = getStoredSessions();
  return Object.values(sessions);
};

// -------------------------------------------------------------
// 双方向自由入力メッセージ機能のAPI
// -------------------------------------------------------------

/**
 * オーナーからのお知らせ（アナウンス）を送信
 */
export const sendAnnouncement = (sessionId: string, text: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session) return;

  const announcement: Announcement = {
    id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    timestamp: Date.now()
  };

  const prevAnnouncements = session.announcements || [];
  session.announcements = [...prevAnnouncements, announcement];

  saveSessions(sessions, false, true); // お知らせ配信時はスロットリングを無視して強制即時同期
  notifyListeners(sessionId, sessions);
};

/**
 * お客さまからの乗客連絡（フィードバック）を送信
 */
export const sendFeedback = (sessionId: string, text: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session) return;

  const feedback: FeedbackMessage = {
    id: `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    timestamp: Date.now()
  };

  const prevFeedbacks = session.feedbacks || [];
  session.feedbacks = [...prevFeedbacks, feedback];

  saveSessions(sessions);
  notifyListeners(sessionId, sessions);
};

/**
 * オーナーからのお知らせの履歴を消去
 */
export const clearAnnouncements = (sessionId: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session) return;

  session.announcements = [];
  saveSessions(sessions, false, true); // お知らせ全消去時は強制即時同期
  notifyListeners(sessionId, sessions);
};

/**
 * 乗客メッセージの履歴を消去（確認済み・削除）
 */
export const clearFeedbacks = (sessionId: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session) return;

  session.feedbacks = [];
  saveSessions(sessions);
  notifyListeners(sessionId, sessions);
};

/**
 * 特定の乗客メッセージを削除（確認済）
 */
export const deleteFeedbackMessage = (sessionId: string, messageId: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session || !session.feedbacks) return;

  session.feedbacks = session.feedbacks.filter(fb => fb.id !== messageId);
  saveSessions(sessions);
  notifyListeners(sessionId, sessions);
};

// -------------------------------------------------------------
// お客さま位置情報共有 ＆ SOS機能のAPI
// -------------------------------------------------------------

/**
 * 乗客（お客さま）の位置情報とSOS状況を更新
 */
export const updatePassengerLocation = (
  sessionId: string,
  passengerId: string,
  lat: number,
  lng: number,
  isSos: boolean
) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session) return;

  const passengers = session.passengers || {};
  const now = Date.now();

  // 最新位置の保存/更新
  passengers[passengerId] = {
    id: passengerId,
    lat,
    lng,
    isSos,
    updatedAt: now
  };

  // 60秒以上更新のない古い乗客データを自動クリーンアップ（ハートビート切れ）
  // ただしSOS状態の乗客は救助されるまで勝手には消さない（安全第一）
  const cleanedPassengers: Record<string, PassengerLocation> = {};
  Object.keys(passengers).forEach(id => {
    const p = passengers[id];
    if (p.isSos || now - p.updatedAt < 60000) {
      cleanedPassengers[id] = p;
    }
  });

  session.passengers = cleanedPassengers;
  saveSessions(sessions);
  notifyListeners(sessionId, sessions);
};

/**
 * 乗客の離脱処理（位置情報共有のオフ、またはタブを閉じたとき）
 */
export const removePassenger = (sessionId: string, passengerId: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session || !session.passengers) return;

  if (session.passengers[passengerId]) {
    delete session.passengers[passengerId];
    saveSessions(sessions);
    notifyListeners(sessionId, sessions);
  }
};

/**
 * 特定の乗客のSOS解除および位置共有クリア（オーナー側から救助完了した際）
 */
export const clearPassengerSos = (sessionId: string, passengerId: string) => {
  const sessions = getStoredSessions();
  const session = sessions[sessionId];
  if (!session || !session.passengers) return;

  if (session.passengers[passengerId]) {
    // SOS状態を解除し、かつ位置情報もリストから消去（クリア）する
    delete session.passengers[passengerId];
    saveSessions(sessions);
    notifyListeners(sessionId, sessions);
  }
};

/**
 * スーパー管理者用：すべての登録オーナーの一覧を取得
 */
export const getAllOwners = (): Owner[] => {
  return Object.values(getStoredOwners());
};

/**
 * スーパー管理者用：登録オーナーを削除
 */
export const deleteOwner = (ownerId: string) => {
  const owners = getStoredOwners();
  if (owners[ownerId]) {
    // もしアクティブなセッションがあれば停止
    stopOwnerSession(ownerId);
    
    delete owners[ownerId];
    saveOwners(owners);
  }
};

// -------------------------------------------------------------
// 全体緊急システムメッセージ配信機能（電光掲示板テロップ用）
// -------------------------------------------------------------

export interface SystemMessage {
  text: string;
  updatedAt: number;
}

const SYSTEM_MESSAGE_KEY = 'coco-doco-system-message';

/**
 * スーパー管理者用：全体システムメッセージの送信
 */
export const sendSystemMessage = (text: string) => {
  const message: SystemMessage = {
    text: text.trim(),
    updatedAt: Date.now()
  };
  localStorage.setItem(SYSTEM_MESSAGE_KEY, JSON.stringify(message));
  // 同一ウィンドウ内のリスナーに通知するためのカスタムイベント発火
  window.dispatchEvent(new Event('system-message-update'));
};

/**
 * スーパー管理者用：全体システムメッセージのクリア
 */
export const clearSystemMessage = () => {
  localStorage.removeItem(SYSTEM_MESSAGE_KEY);
  window.dispatchEvent(new Event('system-message-update'));
};

/**
 * 全体システムメッセージの取得
 */
export const getSystemMessage = (): SystemMessage | null => {
  const data = localStorage.getItem(SYSTEM_MESSAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

/**
 * 全体システムメッセージのリアルタイム変更を購読監視するAPI
 */
export const subscribeToSystemMessage = (
  callback: (msg: SystemMessage | null) => void
): (() => void) => {
  const handleUpdate = () => {
    callback(getSystemMessage());
  };

  // 初回データ送信
  callback(getSystemMessage());

  // イベントリスナーの登録
  window.addEventListener('system-message-update', handleUpdate);
  window.addEventListener('storage', handleUpdate); // 他のタブでの変更を監視可能

  // 定期的な監視（念のためのポーリング）
  const interval = setInterval(handleUpdate, 2000);

  // 購読解除関数
  return () => {
    window.removeEventListener('system-message-update', handleUpdate);
    window.removeEventListener('storage', handleUpdate);
    clearInterval(interval);
  };
};

/**
 * オーナーのプロフィール（ニックネームとアバターアイコン）の更新
 */
export const updateOwnerProfile = (
  ownerId: string,
  nickname: string,
  avatarIcon: string
): Owner => {
  const owners = getStoredOwners();
  const owner = owners[ownerId];
  if (!owner) {
    throw new Error('オーナー情報が見つかりません。');
  }

  // オーナー情報の更新
  owner.nickname = nickname.trim() || undefined;
  owner.avatarIcon = avatarIcon;
  owners[ownerId] = owner;
  saveOwners(owners);

  // もしアクティブなセッションがあればセッション情報もリアルタイムに更新
  if (owner.sessionId) {
    const sessions = getStoredSessions();
    const session = sessions[owner.sessionId];
    if (session) {
      session.nickname = owner.nickname;
      session.avatarIcon = owner.avatarIcon;
      
      // セッションの表示名も更新
      let roleLabel = 'バス';
      if (owner.role === 'delivery') roleLabel = '配送車';
      if (owner.role === 'person') roleLabel = 'スタッフ';
      session.name = owner.nickname ? `${owner.nickname} (${owner.name})` : `${owner.name} の${roleLabel}`;
      
      sessions[owner.sessionId] = session;
      saveSessions(sessions, false, true); // プロフィール更新時は強制即時同期
      notifyListeners(owner.sessionId, sessions);
    }
  }

  return owner;
};

