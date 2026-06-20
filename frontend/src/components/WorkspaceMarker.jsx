import { useEffect, useRef } from 'react'
import { SCORE_CATEGORIES, calcWeightedScore } from '../constants/scoreConfig'

function WorkspaceMarker({ map, cafe, priorityOrder, isActive, onClick }) {
  const markerRef = useRef(null)
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!map || !window.kakao) return

    const position = new window.kakao.maps.LatLng(
      parseFloat(cafe.latitude),
      parseFloat(cafe.longitude)
    )

    // 마커에 표시할 이모지 결정
    // 우선순위 1위 카테고리 이모지를 보여줌, 없으면 ☕
    const topCat = priorityOrder[0]
      ? SCORE_CATEGORIES.find((c) => c.key === priorityOrder[0])
      : null
    const emoji = topCat ? topCat.emoji : '☕'

    // 가중치 점수 (우선순위 완성 시)
    const scoreText =
      priorityOrder.length === 5
        ? `${(calcWeightedScore(cafe, priorityOrder) * 100).toFixed(0)}`
        : null

    const content = `
      <div class="map-marker ${isActive ? 'active' : ''}" data-id="${cafe.id}">
        <span class="map-marker-emoji">${emoji}</span>
        <span class="map-marker-name">${cafe.name}</span>
        ${scoreText ? `<span class="map-marker-score">${scoreText}점</span>` : ''}
      </div>
    `

    const overlay = new window.kakao.maps.CustomOverlay({
      position,
      content,
      yAnchor: 1.2,
    })

    overlay.setMap(map)
    overlayRef.current = overlay

    // 클릭 이벤트 — CustomOverlay는 DOM 이벤트로 처리
    const el = overlay.getContent()
    if (typeof el !== 'string') {
      el.addEventListener('click', () => onClick(cafe))
    }

    return () => {
      overlay.setMap(null)
    }
  }, [map, cafe, priorityOrder, isActive])

  // CustomOverlay가 DOM 요소일 때 active 클래스 토글
  useEffect(() => {
    if (!overlayRef.current) return
    const el = overlayRef.current.getContent()
    if (typeof el !== 'string') {
      el.querySelector('.map-marker')?.classList.toggle('active', isActive)
    }
  }, [isActive])

  return null // 실제 렌더링은 카카오맵 CustomOverlay가 담당
}

export default WorkspaceMarker