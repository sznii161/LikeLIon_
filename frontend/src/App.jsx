import { useState, useEffect, useRef } from 'react'
import CafeList from './components/CafeList'
import CategoryPrioritySelector from './components/CategoryPrioritySelector'
import WorkspaceMarker from './components/WorkspaceMarker'
import './App.css'

const API_BASE = 'http://localhost:8000'
const SEONGDONG_CENTER = { lat: 37.5633, lng: 127.0371 }

function App() {
  const [cafes, setCafes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [priorityOrder, setPriorityOrder] = useState([])
  const [activeCafe, setActiveCafe] = useState(null)
  const [map, setMap] = useState(null)
  const [mobilePanel, setMobilePanel] = useState(false)
  const mapRef = useRef(null)

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
    if (window.kakao?.maps) {
      init()
    } else {
      const script = document.querySelector('script[src*="dapi.kakao.com"]')
      script?.addEventListener('load', init)
      return () => script?.removeEventListener('load', init)
    }
  }, [])

  // 카페 데이터 불러오기
  useEffect(() => {
    fetch(`${API_BASE}/api/spaces/`)
      .then((r) => { if (!r.ok) throw new Error(`서버 오류 ${r.status}`); return r.json() })
      .then(setCafes)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleCafeClick = (cafe) => {
    setActiveCafe(cafe)
    if (map) {
      map.panTo(new window.kakao.maps.LatLng(
        parseFloat(cafe.latitude),
        parseFloat(cafe.longitude)
      ))
    }
  }

  return (
    <div className="app-root">
      {/* 카카오맵 전체 배경 */}
      <div ref={mapRef} className="kakao-map" />

      {/* 마커들 */}
      {map && cafes.map((cafe) => (
        <WorkspaceMarker
          key={cafe.id}
          map={map}
          cafe={cafe}
          priorityOrder={priorityOrder}
          isActive={activeCafe?.id === cafe.id}
          onClick={handleCafeClick}
        />
      ))}

      {/* 플로팅 헤더 */}
      <header className="float-header">
        <span className="header-logo">Track<span>Look</span> 🗺️</span>
        <span className="header-sub">성동구 카공 카페 찾기</span>
      </header>

      {/* PC: 플로팅 우선순위 패널 */}
      <div className="float-priority">
        <CategoryPrioritySelector
          priorityOrder={priorityOrder}
          onChange={setPriorityOrder}
        />
      </div>

      {/* 모바일: 우선순위 토글 버튼 */}
      <button
        className="mobile-priority-btn"
        onClick={() => setMobilePanel(true)}
      >
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
          <button
            className="priority-reset"
            style={{ marginTop: 12 }}
            onClick={() => setMobilePanel(false)}
          >
            닫기
          </button>
        </div>
      )}

      {/* 플로팅 하단 카페 목록 */}
      <div className="float-list">
        <div className="list-handle" />
        <div className="list-top">
          <span className="list-title">
            {priorityOrder.length === 5 ? '🎯 최적 카페 순위' : '카페 목록'}
          </span>
          {!loading && (
            <span className="list-count">{cafes.length}곳</span>
          )}
        </div>

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
            cafes={cafes}
            priorityOrder={priorityOrder}
            activeCafeId={activeCafe?.id}
            onCafeClick={handleCafeClick}
          />
        )}
      </div>
    </div>
  )
}

export default App