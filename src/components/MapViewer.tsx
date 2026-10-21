import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Compass, MessageSquare, Send, X, Check, ExternalLink, 
  Bus, Truck, User, Radio, Shield, AlertTriangle, Navigation
} from 'lucide-react';
import { 
  sendFeedback, 
  updatePassengerLocation, 
  removePassenger, 
  clearPassengerSos 
} from '../services/trackingService';
import type { TrackingSession } from '../services/trackingService';

interface MapViewerProps {
  session: TrackingSession | null;
  theme: 'light' | 'dark';
  enableFeedback?: boolean;
  isOwner?: boolean;
  focusCoords?: { lat: number; lng: number } | null;
}

export const MapViewer: React.FC<MapViewerProps> = ({ 
  session, 
  theme, 
  enableFeedback = false,
  isOwner = false,
  focusCoords = null
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // マーカー参照
  const trackingMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const passengerMarkersRef = useRef<Record<string, L.Marker>>({}); // 他の乗客マーカー用（オーナー画面的）

  // 匿名乗客IDの取得・生成
  const [passengerId] = useState<string>(() => {
    let id = sessionStorage.getItem('coco-doco-passenger-id');
    if (!id) {
      id = `passenger-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('coco-doco-passenger-id', id);
    }
    return id;
  });

  // 位置情報オプトイン状態の管理 ('allow' | 'deny' | 'unset')
  const [optInStatus, setOptInStatus] = useState<'allow' | 'deny' | 'unset'>(() => {
    const saved = localStorage.getItem('coco-doco-optin');
    return (saved as 'allow' | 'deny' | 'unset') || 'unset';
  });

  // オプトイン選択ダイアログの表示管理
  const [isOptInModalOpen, setIsOptInModalOpen] = useState<boolean>(false);

  // SOS状態の管理
  const [isSosActive, setIsSosActive] = useState<boolean>(false);

  // 徒歩経路用ポリライン参照
  const routePolylineRef = useRef<L.Polyline | null>(null);


  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null); // 経路表示用のユーザー現在地ステート

  // お客さまメッセージ送受信用のステート
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  // 経路表示ステート
  const showRoute = !!userCoords;
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  // バスアイコンタップ時に出現するアクション選択メニューの開閉ステート（マサさんの要望対応）
  const [isActionMenuOpen, setIsActionMenuOpen] = useState<boolean>(false);

  const handleSendFeedback = () => {
    if (!session || !feedbackText.trim()) return;
    sendFeedback(session.id, feedbackText);
    setFeedbackText('');
    setSendSuccess(true);
    // 2.5秒後に自動で閉じる
    setTimeout(() => {
      setIsFeedbackOpen(false);
      setSendSuccess(false);
    }, 2500);
  };

  // 地図タイルのURL（APIキー不要・完全無料のOpenStreetMap標準タイル）
  const getTileUrl = (_currentTheme?: 'light' | 'dark') => {
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  };

  const getAttribution = () => {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  };

  // 古い経路ポリラインを地図からクリーンアップする関数
  const removeRoutePolyline = () => {
    if (routePolylineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  };

  // OSRM無料ルートAPIから徒歩経路を取得して描画する関数
  const fetchAndDrawRoute = async () => {
    if (!mapRef.current || !session || !userCoords || !showRoute) {
      removeRoutePolyline();
      setRouteInfo(null);
      return;
    }

    try {
      // OSRM (Open Source Routing Machine) 徒歩ルート検索API（完全無料・登録不要）
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${userCoords.lng},${userCoords.lat};${session.lng},${session.lat}?overview=full&geometries=geojson`
      );
      if (!response.ok) throw new Error('OSRM Route API request failed');

      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates; // [[lng, lat], ...]
        const latLngs = coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);

        setRouteInfo({
          distance: route.distance, // メートル
          duration: route.duration  // 秒（徒歩ベース）
        });

        // テーマごとの鮮やかな経路カラー（ライト: 鮮やかなロイヤルブルー, ダーク: 蛍光ネオンシアン）
        const lineColor = theme === 'light' ? '#2563eb' : '#22d3ee';

        if (routePolylineRef.current) {
          routePolylineRef.current.setLatLngs(latLngs);
          routePolylineRef.current.setStyle({ color: lineColor });
        } else {
          // 徒歩ルートらしく可愛いドット点線 (dashArray) にして、プレミアム感を演出
          const polyline = L.polyline(latLngs, {
            color: lineColor,
            weight: 6,
            opacity: 0.75,
            dashArray: '8, 12',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(mapRef.current);
          routePolylineRef.current = polyline;
        }
      } else {
        removeRoutePolyline();
        setRouteInfo(null);
      }
    } catch (err) {
      console.error('徒歩経路の取得に失敗しました:', err);
      removeRoutePolyline();
      setRouteInfo(null);
    }
  };

  // お客さまの位置情報監視と自動送信（常時watchPositionで追跡し、オプトイン許可時またはSOS発信時のみサーバーに送信）
  useEffect(() => {
    if (isOwner || !session || session.status !== 'active') return;

    // オプトインがunsetの場合、自動でモーダルを開く
    if (optInStatus === 'unset') {
      setIsOptInModalOpen(true);
    }

    // 共有OFFの場合はサーバーから自分の位置データを削除
    if (optInStatus === 'deny') {
      removePassenger(session.id, passengerId);
    }

    let watchId: number | null = null;

    if (navigator.geolocation) {
      // 共有設定に関係なく常にwatchPositionで追跡し、地図上のアイコンを連続更新する
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          // ローカル表示用の現在地は常に更新（アイコンが現在地に追従）
          setUserCoords({ lat: latitude, lng: longitude });

          // 共有ONかSOS発信時のみサーバーに送信
          if (optInStatus === 'allow' || isSosActive) {
            updatePassengerLocation(session.id, passengerId, latitude, longitude, isSosActive);
          }
        },
        (err) => {
          console.error('乗客GPS取得エラー:', err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOwner, session?.id, session?.status, optInStatus, isSosActive, passengerId]);

  // オーナー（管理者）自身の現在地のリアルタイム監視（運行開始に関わらず、24時間常に自分だけは見えるようにする）
  useEffect(() => {
    if (!isOwner || !mapRef.current) return;

    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserCoords({ lat: latitude, lng: longitude });
        },
        (err) => {
          console.warn('Owner GPS Watch Error:', err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      setUserCoords(null);
    };
  }, [isOwner]);

  // ユーザー自身（一般乗客またはオーナー）の現在地マーカーを描画・更新する
  useEffect(() => {
    if (!mapRef.current) return;

    if (!userCoords) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const { lat, lng } = userCoords;

    const customUserIcon = L.divIcon({
      className: 'user-marker-wrapper',
      html: `<div class="user-pin"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    } else {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: customUserIcon,
        zIndexOffset: 800 // バス等のアイコンのすぐ下に配置して綺麗に重ねる
      }).addTo(mapRef.current);
    }
  }, [userCoords]);

  // オーナー側：他の乗客の位置やSOSピンを地図上に描画
  useEffect(() => {
    if (!isOwner || !mapRef.current || !session) {
      // オーナーモードではない、またはセッションが無い場合はマーカーを全てクリーンアップ
      Object.keys(passengerMarkersRef.current).forEach(id => {
        passengerMarkersRef.current[id].remove();
      });
      passengerMarkersRef.current = {};
      return;
    }

    const passengers = session.passengers || {};
    const activeIds = new Set(Object.keys(passengers));

    // 1. 存在しなくなった乗客のマーカーを削除
    Object.keys(passengerMarkersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        passengerMarkersRef.current[id].remove();
        delete passengerMarkersRef.current[id];
      }
    });

    // 2. 乗客・SOSマーカーの追加と更新
    Object.keys(passengers).forEach(id => {
      const p = passengers[id];
      const { lat, lng, isSos } = p;

      // カスタムマーカーアイコンの作成
      const createPassengerIcon = (sos: boolean) => {
        return L.divIcon({
          className: `passenger-marker-icon ${sos ? 'sos' : 'normal'}`,
          html: sos 
            ? `<div class="sos-pulse-ring"></div>
               <div class="passenger-pin sos">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
               </div>`
            : `<div class="passenger-pin normal">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
               </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
      };

      const existingMarker = passengerMarkersRef.current[id];
      if (existingMarker) {
        // 更新
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(createPassengerIcon(isSos));
        
        existingMarker.off('click');
        existingMarker.on('click', () => {
          if (isSos) {
            if (window.confirm('この乗客のSOSを解除し、救助完了としますか？')) {
              clearPassengerSos(session.id, id);
            }
          }
        });
      } else {
        // 新規作成
        const marker = L.marker([lat, lng], {
          icon: createPassengerIcon(isSos),
          zIndexOffset: isSos ? 2000 : 500 // SOSピンは最前面に
        }).addTo(mapRef.current!);

        marker.on('click', () => {
          if (isSos) {
            if (window.confirm('この乗客のSOSを解除し、救助完了としますか？')) {
              clearPassengerSos(session.id, id);
            }
          }
        });

        passengerMarkersRef.current[id] = marker;
      }
    });

  }, [isOwner, session?.passengers, session?.id]);

  // 1. 地図初期化
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 初期表示は東京駅周辺
    const initialLat = session ? session.lat : 35.681236;
    const initialLng = session ? session.lng : 139.767125;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false, // ズームボタンは右下にカスタム配置するため無効化
      attributionControl: true
    });

    // ズームボタンを右下に配置
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    const tileLayer = L.tileLayer(getTileUrl(theme), {
      attribution: getAttribution(),
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;

    // クリーンアップ
    return () => {
      removeRoutePolyline();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. テーマ（ライト/ダーク）切り替え時のタイル更新
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    // タイルURLの変更とリロード
    tileLayerRef.current.setUrl(getTileUrl(theme));
  }, [theme]);

  // 3. 追跡対象（セッション）の位置更新と滑らかなマーカー移動
  useEffect(() => {
    if (!mapRef.current || !session) return;

    const { lat, lng, bearing, type, status } = session;

    // カスタムHTMLマーカーの作成（方向矢印とタイプ別クラスを含む）
    const createCustomIcon = (deg: number = 0) => {
      // 進行方向を示すインラインスタイル
      const rotateStyle = deg !== undefined ? `transform: rotate(${deg}deg)` : '';
      const avatarIcon = session.avatarIcon || '';
      const nicknameText = session.nickname || session.name;
      
      return L.divIcon({
        className: 'custom-marker-wrapper',
        html: `
          <div class="custom-pin-container">
            <!-- 浮遊ニックネーム吹き出し（常時表示） -->
            <div class="marker-nickname-bubble glass-panel-solid">
              <span class="bubble-avatar">${avatarIcon || '✨'}</span>
              <span class="bubble-text">${nicknameText}</span>
            </div>
            
            <div class="custom-pin">
              <div class="pin-shadow"></div>
              <div class="pin-body ${avatarIcon ? 'cute-avatar-pin' : ''} ${type}">
                ${
                  avatarIcon
                    ? `<span class="pin-emoji">${avatarIcon}</span>`
                    : (type === 'bus'
                        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M13 17H9"/></svg>'
                        : type === 'delivery'
                        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
                        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>')
                }
                ${deg !== undefined ? `<div class="pin-direction ${avatarIcon ? 'mini' : ''}" style="${rotateStyle}"></div>` : ''}
              </div>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 44] // ピンの先端を正確な座標に合わせる
      });
    };

    const isIdChanged = lastIdRef.current !== session.id;
    lastIdRef.current = session.id;

    if (trackingMarkerRef.current) {
      // すでにマーカーが存在する場合は、座標を更新（CSS of transitionにより滑らかに移動）
      trackingMarkerRef.current.setLatLng([lat, lng]);
      
      // アイコン（角度など）を更新
      trackingMarkerRef.current.setIcon(createCustomIcon(bearing));
      
      // バスマーカーのクリックイベントで、アクションメニュー（ボトムシート）を開くように変更
      trackingMarkerRef.current.off('click');
      if (status === 'active') {
        trackingMarkerRef.current.on('click', () => {
          setIsActionMenuOpen(true);
        });
      }
      
      // IDが変わった場合、または現在の地図の中心から1km以上離れている場合は、自動で地図の中心を移動させる（フォーカス）
      // これにより、東京駅から本当の現在地へ座標がジャンプした際に地図が自動で追従します
      const center = mapRef.current.getCenter();
      const distance = center.distanceTo([lat, lng]); // メートル単位
      if (isIdChanged || distance > 1000) {
        mapRef.current.setView([lat, lng], 16, { animate: true });
      }
      
      // ステータスがinactive（追跡終了）の場合は不透明度を下げる
      if (status === 'inactive') {
        trackingMarkerRef.current.setOpacity(0.5);
      } else {
        trackingMarkerRef.current.setOpacity(1.0);
      }
    } else {
      // 新規にマーカーを作成
      const marker = L.marker([lat, lng], {
        icon: createCustomIcon(bearing),
        zIndexOffset: 1000 // 常に最前面に表示
      }).addTo(mapRef.current);

      if (status === 'active') {
        marker.on('click', () => {
          setIsActionMenuOpen(true);
        });
      }

      // マーカー要素にCSSアニメーション用のクラスを追加
      const element = marker.getElement();
      if (element) {
        element.classList.add('smooth-marker');
      }

      trackingMarkerRef.current = marker;
      
      // 初回表示時に対象にフォーカス
      mapRef.current.setView([lat, lng], 16);
    }
  }, [session?.id, session?.lat, session?.lng, session?.bearing, session?.type, session?.status, enableFeedback]);

  // 4. ユーザーの現在地への移動
  const handleLocateUser = () => {
    if (!mapRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude }); // 経路計算用・マーカー描画用に緯度経度をstateに格納

        // 現在地へジャンプ
        mapRef.current!.setView([latitude, longitude], 16, { animate: true });
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error);
        alert('現在地の取得に失敗しました。位置情報の利用許可を確認してください。');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  };

  // 5. 追跡対象にフォーカス（追尾）する関数
  const handleFocusTarget = () => {
    if (mapRef.current && session) {
      mapRef.current.setView([session.lat, session.lng], 16, { animate: true });
    }
  };

  // 6. 徒歩経路の自動更新と監視
  useEffect(() => {
    if (showRoute && userCoords && session?.lat && session?.lng && session.status !== 'inactive') {
      fetchAndDrawRoute();
    } else {
      removeRoutePolyline();
      setRouteInfo(null);
    }
  }, [showRoute, userCoords?.lat, userCoords?.lng, session?.lat, session?.lng, theme]);

  // 7. 経路表示ONのときに、現在地とバスがすべて収まるように地図範囲を自動調整する
  useEffect(() => {
    if (showRoute && routePolylineRef.current && mapRef.current && routeInfo) {
      try {
        const bounds = routePolylineRef.current.getBounds();
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      } catch (e) {
        console.error('地図のフィットに失敗しました:', e);
      }
    }
  }, [showRoute, routeInfo !== null]);

  // 外部からの強制座標フォーカス (SOSトーストタップ時など)
  useEffect(() => {
    if (mapRef.current && focusCoords) {
      mapRef.current.setView([focusCoords.lat, focusCoords.lng], 18, { animate: true });
    }
  }, [focusCoords]);



  // 無料のGoogleマップナビゲーションURL
  const googleMapsNavUrl = userCoords && session
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${session.lat},${session.lng}&travelmode=walking`
    : '';

  // 車両タイプ別のアイコン取得（アクションメニューで使用）
  const getVehicleIcon = () => {
    if (!session) return <Radio size={20} />;
    switch (session.type) {
      case 'bus':
        return <Bus size={20} />;
      case 'delivery':
        return <Truck size={20} />;
      case 'person':
        return <User size={20} />;
      default:
        return <Radio size={20} />;
    }
  };

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="map-container" />

      {/* プレミアム経路情報 ＆ Googleナビ連携パネル */}
      {showRoute && routeInfo && userCoords && session && (
        <div className="route-info-panel glass-panel-solid bounce-in">
          <div className="route-info-details">
            <span className="route-info-title">🚶 バスまでの徒歩ルート</span>
            <span className="route-info-meta">
              距離: <strong>{(routeInfo.distance / 1000).toFixed(2)} km</strong>
              <span className="divider">|</span>
              時間: <strong>{Math.ceil(routeInfo.duration / 60)} 分</strong>
            </span>
          </div>
          <a
            href={googleMapsNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="google-nav-btn"
            title="Googleマップアプリを無料起動して音声ナビを開始します"
          >
            <ExternalLink size={14} />
            <span>Googleマップでナビ 🧭</span>
          </a>
        </div>
      )}

      {/* フローティングSOSボタン（地図上に常時表示され、押しやすい場所に配置） */}
      {!isOwner && session && (
        <button
          onClick={() => {
            if (isSosActive) {
              setIsSosActive(false);
              alert('SOS緊急位置共有を解除しました。');
            } else {
              if (window.confirm('🚨 運転手へ緊急SOSを発信しますか？現在地がリアルタイムで送信されます。')) {
                setIsSosActive(true);
                // 強制的に位置共有設定をオンにして即座に送信開始
                localStorage.setItem('coco-doco-optin', 'allow');
                setOptInStatus('allow');
                handleLocateUser();
                alert('🚨 SOSを発信しました！運転手へ現在地がリアルタイム送信されています。安全な場所でお待ちください。');
              }
            }
          }}
          className={`sos-floating-btn ${isSosActive ? 'active-sos' : ''}`}
          title="緊急時のSOS発信（現在地送信）"
        >
          <div className="sos-btn-pulse-ring" />
          <AlertTriangle size={18} />
          <span>{isSosActive ? '🟢 SOS緊急共有を解除する' : '🚨 運転手にSOSを発信（現在地共有）'}</span>
        </button>
      )}

      {/* マップ用コントロールボタン群（ガラスモルフィズムデザイン） */}
      {/* 経路ボタンを削除し、現在地・追跡のみにして画面をすっきりと整理。オーナー（管理者）ポータルでは非表示にして重なりを防ぎます */}
      {!isOwner && session && (
        <div className="map-controls">
          <button 
            onClick={handleLocateUser} 
            className="control-btn glass-panel"
            title="自分の現在地"
          >
            <Navigation size={20} />
            <span className="control-label">自分の現在地</span>
          </button>

          <button 
            onClick={handleFocusTarget} 
            className="control-btn glass-panel"
            title="対象を追跡"
          >
            <Compass size={20} className="pulse-icon" />
            <span className="control-label">対象を追跡</span>
          </button>

          <button
            onClick={() => setIsOptInModalOpen(true)}
            className={`control-btn glass-panel optin-toggle ${optInStatus === 'allow' ? 'sharing' : ''}`}
            title="位置情報の共有設定を変更します"
          >
            <Shield size={20} className={optInStatus === 'allow' ? 'pulse-icon text-emerald-500' : 'text-slate-400'} />
            <span className="control-label">
              {optInStatus === 'allow' ? '位置共有: 送信中' : '位置共有: オフ'}
            </span>
          </button>
        </div>
      )}

      {/* バスマーカータップ時に立ち上がるアクションメニュー（ボトムシート風カード） */}
      {isActionMenuOpen && session && (
        <div className="action-menu-overlay fade-in" onClick={() => setIsActionMenuOpen(false)}>
          <div className="action-menu-card glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsActionMenuOpen(false)} title="閉じる">
              <X size={16} />
            </button>
            
            <div className="action-menu-header">
              <div className={`vehicle-icon-wrapper ${session.type}`}>
                {getVehicleIcon()}
              </div>
              <div className="vehicle-meta">
                <h4 className="vehicle-name">{session.name}</h4>
                <span className="vehicle-status-label">🟢 リアルタイム運行中</span>
              </div>
            </div>

            <p className="action-menu-desc">
              この車両に対して行うアクションを選択してください。
            </p>

            <div className="action-menu-buttons">
              {/* メッセージ送信ボタン */}
              {enableFeedback && (
                <button 
                  className="action-btn message-btn"
                  onClick={() => {
                    setIsActionMenuOpen(false); // メニューを閉じる
                    setIsFeedbackOpen(true);    // メッセージ入力モーダルを開く
                    setSendSuccess(false);
                  }}
                >
                  <MessageSquare size={16} />
                  <span>運転手さんへメッセージを送る</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 乗客からオーナーへの自由入力メッセージ送信モーダル */}
      {enableFeedback && isFeedbackOpen && session && (
        <div className="feedback-modal-overlay fade-in" onClick={() => setIsFeedbackOpen(false)}>
          <div className="feedback-modal-content glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsFeedbackOpen(false)} title="閉じる">
              <X size={16} />
            </button>
            
            <div className="modal-body">
              <div className="modal-icon-wrapper feedback-icon-bg">
                <MessageSquare size={24} className="feedback-icon" />
              </div>
              <h3 className="modal-title">{session.name} の運転手さんへメッセージ</h3>
              <p className="modal-desc">
                停車中や運行終了後にドライバーへ届きます。状況の伝達や、応援メッセージなどを自由に入力してください。
              </p>

              {sendSuccess ? (
                <div className="send-success-message fade-in">
                  <div className="success-checkmark">
                    <Check size={28} />
                  </div>
                  <span>メッセージを送信しました！</span>
                </div>
              ) : (
                <div className="feedback-form">
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="例: 青い上着を着てバス停でお待ちしています！"
                    maxLength={150}
                    className="feedback-textarea"
                  />
                  <div className="feedback-form-footer">
                    <span className="char-count">{feedbackText.length}/150文字</span>
                    <button
                      onClick={handleSendFeedback}
                      disabled={!feedbackText.trim()}
                      className="feedback-send-btn"
                    >
                      <Send size={14} />
                      <span>送信する</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* お客さま用：位置情報オプトイン選択モーダル */}
      {isOptInModalOpen && session && !isOwner && (
        <div className="optin-modal-overlay fade-in" onClick={() => setIsOptInModalOpen(false)}>
          <div className="optin-modal-content glass-panel-solid" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setIsOptInModalOpen(false)} title="閉じる">
              <X size={16} />
            </button>
            <div className="modal-body">
              <div className="modal-icon-wrapper optin-icon-bg">
                <Shield size={24} className="optin-icon" />
              </div>
              <h3 className="modal-title">運転手さんへの位置情報共有</h3>
              <p className="modal-desc">
                あなたの現在位置をバスの運転手さんに共有しますか？共有すると、ドライバーが乗客の位置を把握しやすくなり、スムーズな運行・乗車サポートに役立ちます。（最初に「共有しない」を選択した場合でも、あとから設定を変更して共有を開始できます）
              </p>
              
              <div className="optin-options">
                <button
                  className="optin-btn allow-btn"
                  onClick={() => {
                    localStorage.setItem('coco-doco-optin', 'allow');
                    setOptInStatus('allow');
                    setIsOptInModalOpen(false);
                    // 許可時に現在地を即座に取得
                    handleLocateUser();
                  }}
                >
                  🟢 共有する（推奨、あとからでも位置情報共有できます）
                </button>
                <button
                  className="optin-btn deny-btn"
                  onClick={() => {
                    localStorage.setItem('coco-doco-optin', 'deny');
                    setOptInStatus('deny');
                    setIsOptInModalOpen(false);
                  }}
                >
                  ⚪ 共有しない（閲覧のみ）
                </button>
              </div>
              
              <p className="optin-note">
                ※この設定は右下の「位置共有」ボタンからいつでも変更可能です。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* お客さま用：SOS発信中の緊急フローティングアラート */}
      {!isOwner && isSosActive && (
        <div className="sos-active-banner glass-panel-solid bounce-in">
          <div className="sos-banner-details">
            <span className="sos-pulse-ring-slow"></span>
            <span className="sos-banner-title">🚨 SOS緊急位置送信中</span>
            <span className="sos-banner-desc">運転手に現在地を送っています。その場でお待ちください。</span>
          </div>
          <button 
            className="sos-cancel-btn"
            onClick={() => {
              setIsSosActive(false);
              alert('SOSを解除しました。');
            }}
          >
            解除
          </button>
        </div>
      )}

      <style>{`
        .map-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
        }

        /* 経路案内フロートパネル */
        .route-info-panel {
          position: absolute;
          top: 156px;
          left: 16px;
          right: 16px;
          z-index: 9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          border-radius: var(--card-radius);
          border: 1px solid var(--border-glass);
          background: var(--bg-glass-solid);
          box-shadow: var(--shadow-glass);
          animation: slide-down 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        [data-theme="dark"] .route-info-panel {
          background: rgba(15, 23, 42, 0.75);
        }

        .route-info-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .route-info-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .route-info-meta {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .route-info-meta strong {
          color: var(--accent-primary);
        }

        .route-info-meta .divider {
          margin: 0 8px;
          color: var(--text-muted);
          opacity: 0.4;
        }

        .google-nav-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #ffffff !important;
          font-size: 12px;
          font-weight: 600;
          text-decoration: none !important;
          transition: var(--transition-smooth);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
        }

        .google-nav-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .google-nav-btn:active {
          transform: translateY(0);
        }

        @keyframes slide-down {
          0% { transform: translateY(-10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* コントロールボタン */
        .map-controls {
          position: absolute;
          bottom: 24px;
          left: 24px;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .control-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 48px;
          padding: 0 18px;
          border: 1px solid var(--border-glass);
          background: var(--bg-glass-solid);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        }

        .control-btn:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.25);
        }

        .control-btn:active {
          transform: translateY(0);
        }

        .control-btn.locating svg {
          animation: spin 1s infinite linear;
        }

        .spin-icon {
          animation: spin 1.5s infinite linear;
        }

        .pulse-icon {
          animation: pulse-icon-anim 3s infinite ease-in-out;
        }

        /* アクション選択メニュー（ボトムシート風） */
        .action-menu-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.15);
          backdrop-filter: blur(2px);
          z-index: 9999;
          display: flex;
          align-items: flex-end; /* 画面下部に配置 */
          justify-content: center;
          padding: 20px;
        }

        .action-menu-card {
          max-width: 360px;
          width: 100%;
          border-radius: 20px;
          border: 1px solid var(--border-glass);
          box-shadow: var(--shadow-glass);
          padding: 24px;
          position: relative;
          background: var(--bg-glass-solid);
          animation: slide-up-card 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .action-menu-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--border-glass);
          padding-bottom: 12px;
        }

        .vehicle-icon-wrapper {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vehicle-icon-wrapper.bus {
          background: rgba(16, 185, 129, 0.12);
          color: var(--accent-success);
        }

        .vehicle-icon-wrapper.delivery {
          background: rgba(245, 158, 11, 0.12);
          color: var(--accent-warning);
        }

        .vehicle-icon-wrapper.person {
          background: rgba(59, 130, 246, 0.12);
          color: var(--accent-primary);
        }

        .vehicle-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 2px 0;
        }

        .vehicle-status-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .action-menu-desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 18px;
        }

        .action-menu-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 46px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .action-btn.message-btn {
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
        }

        .action-btn.message-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .action-btn.route-btn {
          background: rgba(255, 255, 255, 0.5);
          color: var(--text-primary);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
        }

        [data-theme="dark"] .action-btn.route-btn {
          background: rgba(15, 23, 42, 0.2);
        }

        .action-btn.route-btn:hover {
          background: var(--accent-primary);
          color: #ffffff;
          border-color: var(--accent-primary);
          transform: translateY(-1px);
        }

        .action-btn.route-btn.active-route {
          background: rgba(59, 130, 246, 0.1) !important;
          border-color: var(--accent-primary) !important;
          color: var(--accent-primary) !important;
        }

        @keyframes slide-up-card {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* メッセージ送信モーダル */
        .feedback-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .feedback-modal-content {
          max-width: 360px;
          width: 100%;
          border-radius: 20px;
          border: 1px solid var(--border-glass);
          box-shadow: var(--shadow-glass);
          padding: 28px 24px;
          position: relative;
          text-align: center;
          background: var(--bg-glass-solid);
        }

        .feedback-icon-bg {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .feedback-icon {
          color: var(--accent-primary);
        }

        .feedback-modal-content h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .modal-desc {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .feedback-textarea {
          width: 100%;
          height: 80px;
          padding: 10px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: rgba(255, 255, 255, 0.4);
          color: var(--text-primary);
          font-size: 13px;
          resize: none;
          outline: none;
          transition: var(--transition-smooth);
        }

        [data-theme="dark"] .feedback-textarea {
          background: rgba(15, 23, 42, 0.2);
        }

        .feedback-textarea:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .feedback-form-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        .char-count {
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .feedback-send-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 6px;
          border: none;
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
        }

        .feedback-send-btn:hover:not(:disabled) {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .feedback-send-btn:disabled {
          background: var(--border-glass);
          color: var(--text-muted);
          cursor: not-allowed;
          box-shadow: none;
        }

        .send-success-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px 0;
        }

        .success-checkmark {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.12);
          border: 1.5px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .send-success-message span {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--text-primary);
        }

        @keyframes scale-up {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes spin {
          0% { transform: rotate(45deg); }
          100% { transform: rotate(405deg); }
        }

        @keyframes pulse-icon-anim {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        @media (max-width: 640px) {
          .route-info-panel {
            top: 140px;
            left: 10px;
            right: 10px;
            padding: 8px 12px;
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
            text-align: center;
          }

          .route-info-details {
            align-items: center;
          }

          .route-info-meta {
            font-size: 13px;
          }

          .google-nav-btn {
            justify-content: center;
            padding: 10px;
          }

          .map-controls {
            bottom: 16px;
            left: 16px;
            right: 16px;
            flex-direction: row;
          }

          .control-btn {
            flex: 1;
            justify-content: center;
            height: 44px;
            padding: 0;
            font-size: 12px;
          }

          .action-menu-overlay {
            padding: 16px;
          }

          .action-menu-card {
            border-radius: 20px;
            padding: 20px;
          }
        }

        /* ------------------------------------------------------------- */
        /* オプトイン位置共有 ＆ SOS用プレミアムCSS */
        /* ------------------------------------------------------------- */

        /* 他の乗客 / SOSマーカーのスタイル */
        .passenger-marker-icon {
          background: transparent !important;
          border: none !important;
        }

        .passenger-pin {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
          border: 2px solid #ffffff;
          transition: all 0.3s ease;
        }

        .passenger-pin.normal {
          background: #10b981; /* エメラルドグリーン（一般乗客） */
          color: #ffffff;
        }

        .passenger-pin.sos {
          background: #ef4444; /* レッド（緊急SOS） */
          color: #ffffff;
          animation: sos-bounce 0.8s infinite alternate ease-in-out;
        }

        /* SOSの赤色パルス波形リングアニメーション */
        .sos-pulse-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 4px solid #ef4444;
          animation: sos-pulse-ring-anim 1.5s infinite ease-out;
          pointer-events: none;
          box-sizing: border-box;
        }

        @keyframes sos-pulse-ring-anim {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        @keyframes sos-bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-6px); }
        }

        /* SOS発信ボタン（アクションメニュー内） */
        .action-btn.sos-btn {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
        }

        .action-btn.sos-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(239, 68, 68, 0.3);
        }

        .action-btn.sos-btn.active-sos {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
        }

        /* オプトインモーダル */
        .optin-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .optin-modal-content {
          max-width: 360px;
          width: 100%;
          border-radius: 20px;
          border: 1px solid var(--border-glass);
          box-shadow: var(--shadow-glass);
          padding: 28px 24px;
          position: relative;
          text-align: center;
          background: var(--bg-glass-solid);
        }

        .optin-icon-bg {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .optin-icon {
          color: var(--accent-primary);
        }

        .optin-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 20px;
        }

        .optin-btn {
          width: 100%;
          height: 46px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .optin-btn.allow-btn {
          background: linear-gradient(135deg, var(--accent-primary), #2563eb);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.15);
        }

        .optin-btn.allow-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .optin-btn.deny-btn {
          background: rgba(255, 255, 255, 0.5);
          color: var(--text-primary);
        }

        [data-theme="dark"] .optin-btn.deny-btn {
          background: rgba(15, 23, 42, 0.2);
        }

        .optin-btn.deny-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        [data-theme="dark"] .optin-btn.deny-btn:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .optin-note {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 14px;
        }

        /* SOS緊急フローティングアラート */
        .sos-active-banner {
          position: absolute;
          top: 96px;
          left: 16px;
          right: 16px;
          z-index: 99;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          border-radius: var(--card-radius);
          border: 1px solid rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.08);
          backdrop-filter: blur(10px);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);
          color: var(--text-primary);
          animation: slide-down 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        [data-theme="dark"] .sos-active-banner {
          background: rgba(239, 68, 68, 0.15);
        }

        .sos-banner-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-left: 16px;
          position: relative;
        }

        .sos-pulse-ring-slow {
          position: absolute;
          left: 0;
          top: 4px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border-radius: 50%;
        }

        .sos-pulse-ring-slow::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: inherit;
          animation: pulse-ring 1.5s infinite ease-in-out;
        }

        .sos-banner-title {
          font-size: 12px;
          font-weight: 700;
          color: #ef4444;
        }

        .sos-banner-desc {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .sos-cancel-btn {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .sos-cancel-btn:hover {
          background: #ef4444;
          color: #ffffff;
        }

        /* 位置共有トグルボタン（コントロールエリア） */
        .control-btn.optin-toggle.sharing {
          background: rgba(16, 185, 129, 0.08) !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
          color: #10b981 !important;
        }

        .control-btn.optin-toggle.sharing:hover {
          background: #10b981 !important;
          color: #ffffff !important;
          border-color: #10b981 !important;
        }

        @media (max-width: 640px) {
          .sos-active-banner {
            top: 82px;
            left: 10px;
            right: 10px;
            padding: 8px 12px;
            gap: 10px;
          }
          .sos-banner-desc {
            font-size: 10px;
          }
        }

        /* ------------------------------------------------------------- */
        /* フローティングSOSボタンのプレミアムデザイン */
        /* ------------------------------------------------------------- */
        .sos-floating-btn {
          position: absolute;
          bottom: 88px; /* コントロールボタンの上に浮くように配置 */
          left: 24px;
          z-index: 99;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 30px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #ffffff;
          border: 2px solid rgba(255, 255, 255, 0.4);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }

        .sos-floating-btn:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.5);
          background: linear-gradient(135deg, #f87171, #ef4444);
        }

        .sos-floating-btn:active {
          transform: translateY(-1px) scale(1.0);
        }

        /* SOS発信中の解除状態のデザイン */
        .sos-floating-btn.active-sos {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: rgba(255, 255, 255, 0.4);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }

        .sos-floating-btn.active-sos:hover {
          background: linear-gradient(135deg, #34d399, #10b981);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.5);
        }

        /* 波打つリングアニメーション */
        .sos-btn-pulse-ring {
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 32px;
          border: 4px solid #ef4444;
          animation: sos-btn-pulse-ring-anim 2s infinite ease-out;
          pointer-events: none;
          box-sizing: border-box;
        }

        .sos-floating-btn.active-sos .sos-btn-pulse-ring {
          border-color: #10b981;
        }

        @keyframes sos-btn-pulse-ring-anim {
          0% { transform: scale(1.0); opacity: 0.6; }
          100% { transform: scale(1.3, 1.4); opacity: 0; }
        }

        @media (max-width: 640px) {
          .sos-floating-btn {
            bottom: 76px; /* モバイルではコントロールが少し小さくなるので調整 */
            left: 16px;
            right: 16px;
            width: calc(100% - 32px); /* 画面幅いっぱいの押しやすいバー */
            height: 48px;
            font-size: 14px;
          }
        }

        /* ------------------------------------------------------------- */
        /* 可愛いアバターピン ＆ すりガラス調ニックネーム吹き出し */
        /* ------------------------------------------------------------- */
        .custom-pin-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 48px;
          height: 48px;
        }

        /* 浮遊ニックネーム吹き出し（すりガラス調・常時表示） */
        .marker-nickname-bubble {
          position: absolute;
          bottom: 54px; /* ピンの真上に浮くように配置 */
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          color: #1e293b;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          z-index: 1010;
          pointer-events: none; /* マップのクリックイベントを邪魔しない */
          animation: float-bubble 3s infinite ease-in-out;
        }

        [data-theme="dark"] .marker-nickname-bubble {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f8fafc;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        /* 吹き出しの小さな下矢印 */
        .marker-nickname-bubble::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px 5px 0;
          border-style: solid;
          border-color: rgba(255, 255, 255, 0.85) transparent;
          display: block;
          width: 0;
        }

        [data-theme="dark"] .marker-nickname-bubble::after {
          border-color: rgba(15, 23, 42, 0.85) transparent;
        }

        .bubble-avatar {
          font-size: 13px;
        }

        .bubble-text {
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* 吹き出しのふわふわ浮遊アニメーション */
        @keyframes float-bubble {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* 可愛いアバターピン本体 */
        .pin-body.cute-avatar-pin {
          background: linear-gradient(135deg, #ffe4e6, #fecdd3); /* パステルピンク系 */
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(225, 29, 72, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        [data-theme="dark"] .pin-body.cute-avatar-pin {
          background: linear-gradient(135deg, #f43f5e, #be123c); /* ダーク時は少しビビッドに */
          border: 2px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .pin-body.cute-avatar-pin.bus {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0); /* バス: グリーン系 */
          box-shadow: 0 4px 10px rgba(5, 150, 105, 0.2);
        }
        [data-theme="dark"] .pin-body.cute-avatar-pin.bus {
          background: linear-gradient(135deg, #10b981, #047857);
        }

        .pin-body.cute-avatar-pin.delivery {
          background: linear-gradient(135deg, #fef3c7, #fde68a); /* 配送: イエロー系 */
          box-shadow: 0 4px 10px rgba(217, 119, 6, 0.2);
        }
        [data-theme="dark"] .pin-body.cute-avatar-pin.delivery {
          background: linear-gradient(135deg, #f59e0b, #b45309);
        }

        .pin-body.cute-avatar-pin.person {
          background: linear-gradient(135deg, #dbeafe, #bfdbfe); /* 人: ブルー系 */
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
        }
        [data-theme="dark"] .pin-body.cute-avatar-pin.person {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }

        .pin-emoji {
          font-size: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        /* 進行方向の極小プレミアムデザイン（アバターあり用） */
        .pin-direction.mini {
          width: 8px;
          height: 8px;
          border-width: 0 4px 6px 4px;
          top: -2px; /* ピンの頭辺りに極小に配置 */
        }

        /* 乗客・オーナーの現在地（青ドット）マーカーのプレミアムデザイン */
        .user-marker-wrapper {
          background: transparent !important;
          border: none !important;
        }

        .user-pin {
          width: 16px;
          height: 16px;
          background-color: #3b82f6; /* 鮮やかなロイヤルブルー */
          border: 2.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
          position: relative;
        }

        /* 脈打つ波紋アニメーション */
        .user-pin::after {
          content: '';
          position: absolute;
          top: -8px;
          left: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: rgba(59, 130, 246, 0.4);
          animation: user-pulse 2s infinite ease-out;
          pointer-events: none;
          box-sizing: border-box;
        }

        @keyframes user-pulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
