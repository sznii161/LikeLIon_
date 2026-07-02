import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import CafeList from './components/CafeList'
import CategoryPrioritySelector from './components/CategoryPrioritySelector'
import WorkspaceMarker from './components/WorkspaceMarker'
import CafeDetailSheet from './components/CafeDetailSheet'
import { calcWeightedScore } from './constants/scoreConfig'
import AuthModal from './components/AuthModal'
import { getSavedUsername, logout } from './utils/auth'
import './App.css'

const API_BASE = 'http://localhost:8000'
const SEONGDONG_CENTER = { lat: 37.5633, lng: 127.0371 }
const MARKER_LIMIT = 30
const RADIUS_M = 2000 // 2km 반경
const LOCATION_CACHE_KEY = 'tracklook_user_location'
const LOCATION_CACHE_TTL = 1000 * 60 * 10 // 10분

const SNAP_POINTS = {
  collapsed: 15,
  half: 45,
  full: 85,
}

// Haversine 공식 — 두 좌표 사이 거리(m) 반환
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 거리 m → 표시용 문자열
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// 로컬스토리지 캐시 읽기 (10분 TTL)
function loadCachedLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY)
    if (!raw) return null
    const { lat, lng, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > LOCATION_CACHE_TTL) {
      localStorage.removeItem(LOCATION_CACHE_KEY)
      return null
    }
    return { lat, lng }
  } catch {
    return null
  }
}

// 로컬스토리지 캐시 저장
function saveLocationCache(lat, lng) {
  try {
    localStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now() })
    )
  } catch {}
}

function App() {
  const [cafes, setCafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [priorityOrder, setPriorityOrder] = useState([])
  const [activeCafe, setActiveCafe] = useState(null)
  const [map, setMap] = useState(null)
  const [mobilePanel, setMobilePanel] = useState(false)
  // 상세 시트
  const [detailCafe, setDetailCafe] = useState(null)
  // 인증
  const [authModal, setAuthModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(
    () => getSavedUsername()
  )

  // 위치 관련 상태
  const [locationPopup, setLocationPopup] = useState(false)
  const [userLocation, setUserLocation] = useState(null)   // { lat, lng }
  const [locationError, setLocationError] = useState(null)
  const [locLoading, setLocLoading] = useState(false)

  // 바텀시트 드래그 상태
  const [sheetHeight, setSheetHeight] = useState(SNAP_POINTS.half)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const sheetRef = useRef(null)
  const mapRef = useRef(null)

  // 로그아웃
  const handleLogout = async () => {
    await logout()
    setCurrentUser(null)
  }

  // 카카오맵 초기화
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || !window.kakao?.maps) return
      window.kakao.maps.load(() => {
        const kakaoMap = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(SEONGDONG_CENTER.lat, SEONGDONG_CENTER.lng),
          level: 4,
        })
        setMap(kakaoMap)
      })
    }
    if (window.kakao?.maps) init()
    else {
      const script = document.querySelector('script[src*="dapi.kakao.com"]')
      script?.addEventListener('load', init)
      return () => script?.removeEventListener('load', init)
    }
  }, [])

  // 앱 로드 시 캐시된 위치 복원 (팝업 없이)
  useEffect(() => {
    const cached = loadCachedLocation()
    if (cached) setUserLocation(cached)
  }, [])

  // 카페 데이터 fetch
  useEffect(() => {
    fetch(`${API_BASE}/api/spaces/`)
      .then((r) => { if (!r.ok) throw new Error(`서버 오류 ${r.status}`); return r.json() })
      .then(setCafes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // 팝업 허용 클릭 → geolocation 요청
  const handleLocationAllow = useCallback(() => {
    setLocationPopup(false)
    setLocationError(null)
    setLocLoading(true)

    // 🎬 발표 영상 촬영용 하드코딩 — 실제 위치 대신 성동구 중심 사용
    // 나중에 풀려면 아래 DEMO_MODE를 false로 바꾸면 됨
    const DEMO_MODE = false

    if (DEMO_MODE) {
      const { lat, lng } = SEONGDONG_CENTER
      setUserLocation({ lat, lng })
      saveLocationCache(lat, lng)
      setLocLoading(false)
      if (map) map.panTo(new window.kakao.maps.LatLng(lat, lng))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserLocation({ lat, lng })
        saveLocationCache(lat, lng)
        setLocLoading(false)
        if (map) map.panTo(new window.kakao.maps.LatLng(lat, lng))
      },
      (err) => {
        setLocLoading(false)
        const msg =
          err.code === 1 ? '위치 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.'
          : err.code === 2 ? '현재 위치를 가져올 수 없어요.'
          : '위치 요청 시간이 초과되었어요.'
        setLocationError(msg)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [map])

  // 위치 해제
  const handleLocationReset = useCallback(() => {
    setUserLocation(null)
    setLocationError(null)
    localStorage.removeItem(LOCATION_CACHE_KEY)
    if (map) map.panTo(new window.kakao.maps.LatLng(SEONGDONG_CENTER.lat, SEONGDONG_CENTER.lng))
  }, [map])

  // top30 계산
  // 우선순위 5개 완성 → 가중치 점수순
  // 위치만 있을 때 → 거리순
  // 둘 다 없으면 → API 순서 그대로
  const top30 = useMemo(() => {
    // 각 카페에 거리 추가
    let list = [...cafes].map((cafe) => ({
      ...cafe,
      _dist: userLocation
        ? getDistanceMeters(userLocation.lat, userLocation.lng, parseFloat(cafe.latitude), parseFloat(cafe.longitude))
        : null,
    }))

    // 위치 있으면 2km 반경 필터 (없으면 전체 fallback)
    if (userLocation) {
      const nearby = list.filter((c) => c._dist <= RADIUS_M)
      list = nearby.length > 0 ? nearby : list
    }

    // 정렬: 우선순위 완성 → 점수순 / 위치만 있으면 → 거리순 / 둘 다 없으면 → API 순서
    if (priorityOrder.length === 5) {
      list.sort((a, b) => calcWeightedScore(b, priorityOrder) - calcWeightedScore(a, priorityOrder))
    } else if (userLocation) {
      list.sort((a, b) => a._dist - b._dist)
    }

    return list.slice(0, MARKER_LIMIT)
  }, [cafes, priorityOrder, userLocation])

  // 카페 클릭 → 지도 이동 + 상세 시트 열기
  const handleCafeClick = (cafe) => {
    setActiveCafe(cafe)
    setDetailCafe(cafe)
    if (map) {
      map.panTo(new window.kakao.maps.LatLng(
        parseFloat(cafe.latitude),
        parseFloat(cafe.longitude)
      ))
    }
  }

  // 드래그 시작
  const onDragStart = useCallback((clientY) => {
    isDragging.current = true
    startY.current = clientY
    startHeight.current = sheetHeight
    document.body.style.userSelect = 'none'
  }, [sheetHeight])

  // 드래그 중
  const onDragMove = useCallback((clientY) => {
    if (!isDragging.current) return
    const deltaY = startY.current - clientY
    const deltaVh = (deltaY / window.innerHeight) * 100
    const newHeight = Math.min(SNAP_POINTS.full, Math.max(SNAP_POINTS.collapsed, startHeight.current + deltaVh))
    setSheetHeight(newHeight)
  }, [])

  // 드래그 끝
  const onDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    document.body.style.userSelect = ''
    const points = Object.values(SNAP_POINTS)
    const closest = points.reduce((prev, curr) =>
      Math.abs(curr - sheetHeight) < Math.abs(prev - sheetHeight) ? curr : prev
    )
    setSheetHeight(closest)
  }, [sheetHeight])

  // 마우스 이벤트
  useEffect(() => {
    const onMove = (e) => onDragMove(e.clientY)
    const onEnd = () => onDragEnd()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
    }
  }, [onDragMove, onDragEnd])

  // 터치 이벤트
  useEffect(() => {
    const onMove = (e) => onDragMove(e.touches[0].clientY)
    const onEnd = () => onDragEnd()
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [onDragMove, onDragEnd])

  const listTitle =
    priorityOrder.length === 5 ? '🎯 최적 카페 순위'
    : userLocation ? '📍 내 주변 카페'
    : '카페 목록'

  return (
    <div className="app-root">
      {/* 카카오맵 */}
      <div ref={mapRef} className="kakao-map" />

      {/* 마커: top30만 렌더링 */}
      {map && top30.map((cafe) => (
        <WorkspaceMarker
          key={cafe.id}
          map={map}
          cafe={cafe}
          priorityOrder={priorityOrder}
          isActive={activeCafe?.id === cafe.id}
          onClick={handleCafeClick}
        />
      ))}

      {/* 카페 상세 시트 */}
      <CafeDetailSheet
        cafe={detailCafe}
        currentUser={currentUser}
        onClose={() => setDetailCafe(null)}
        onLoginRequest={() => setAuthModal(true)}
      />

      {/* 로그인/회원가입 모달 */}
      {authModal && (
        <AuthModal
          onClose={() => setAuthModal(false)}
          onLogin={(username) => setCurrentUser(username)}
        />
      )}

      {/* ── 위치 권한 동의 팝업 ── */}
      {locationPopup && (
        <div className="location-popup-backdrop" onClick={() => setLocationPopup(false)}>
          <div className="location-popup" onClick={(e) => e.stopPropagation()}>
            <div className="location-popup-icon">📍</div>
            <h3 className="location-popup-title">내 위치를 사용할까요?</h3>
            <p className="location-popup-desc">
              현재 위치 기반으로 가까운 카페를 먼저 보여드려요.<br />
              위치 정보는 내 기기에만 저장되며 서버로 전송되지 않아요.
            </p>
            <div className="location-popup-btns">
              <button className="location-btn-deny" onClick={() => setLocationPopup(false)}>
                괜찮아요
              </button>
              <button className="location-btn-allow" onClick={handleLocationAllow}>
                허용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 헤더 */}
      <header className="float-header">
        <span className="header-logo">Track<span>Look</span> 🗺️</span>
        <span className="header-sub">성동구 카공 카페 찾기</span>
        {currentUser ? (
          <div className="header-auth">
            <span className="header-username">{currentUser}</span>
            <button className="header-logout-btn" onClick={handleLogout}>로그아웃</button>
          </div>
        ) : (
          <button className="header-login-btn" onClick={() => setAuthModal(true)}>로그인</button>
        )}
      </header>

      {/* 위치 버튼 (헤더 우측 하단) */}
      <div className="float-location-btn-wrap">
        {locLoading ? (
          <button className="location-inactive-btn" disabled>
            <span className="loc-spinner" /> 위치 찾는 중…
          </button>
        ) : userLocation ? (
          <button className="location-active-btn" onClick={handleLocationReset} title="클릭하면 위치 해제">
            📍 내 위치 ON
          </button>
        ) : (
          <button className="location-inactive-btn" onClick={() => setLocationPopup(true)}>
            📍 내 위치
          </button>
        )}
      </div>

      {/* 위치 오류 토스트 */}
      {locationError && (
        <div className="location-error-toast">
          ⚠️ {locationError}
          <button className="toast-close" onClick={() => setLocationError(null)}>✕</button>
        </div>
      )}

      {/* PC: 플로팅 우선순위 패널 */}
      <div className="float-priority">
        <CategoryPrioritySelector
          priorityOrder={priorityOrder}
          onChange={setPriorityOrder}
        />
      </div>

      {/* 모바일: 우선순위 토글 버튼 */}
      <button className="mobile-priority-btn" onClick={() => setMobilePanel(true)}>
        ✨ 우선순위 설정 {priorityOrder.length > 0 && `(${priorityOrder.length}/5)`}
      </button>

      {/* 모바일: 슬라이드업 패널 */}
      {mobilePanel && (
        <div className="mobile-priority-panel">
          <div className="list-handle" />
          <CategoryPrioritySelector
            priorityOrder={priorityOrder}
            onChange={(order) => {
              setPriorityOrder(order)
              if (order.length === 5) setMobilePanel(false)
            }}
          />
          <button className="priority-reset" style={{ marginTop: 12 }} onClick={() => setMobilePanel(false)}>
            닫기
          </button>
        </div>
      )}

      {/* 드래그 바텀시트 */}
      <div
        ref={sheetRef}
        className="bottom-sheet"
        style={{ height: `${sheetHeight}vh` }}
      >
        <div
          className="sheet-handle-area"
          onMouseDown={(e) => onDragStart(e.clientY)}
          onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
        >
          <div className="list-handle" />
          <div className="list-top">
            <span className="list-title">{listTitle}</span>
            {!loading && <span className="list-count">{top30.length}곳</span>}
          </div>
        </div>

        <div className="sheet-scroll">
          {loading && (
            <div className="empty-state">
              <div className="spinner" />
              <p>카페 불러오는 중</p>
            </div>
          )}
          {error && (
            <div className="empty-state">
              <span className="empty-state-icon">⚠️</span>
              <p>백엔드 서버에 연결할 수 없어요</p>
              <small>{error}</small>
            </div>
          )}
          {!loading && !error && (
            <CafeList
              cafes={top30}
              priorityOrder={priorityOrder}
              userLocation={userLocation}
              activeCafeId={activeCafe?.id}
              onCafeClick={handleCafeClick}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default App