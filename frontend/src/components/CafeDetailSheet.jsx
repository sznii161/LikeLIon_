import { useState, useEffect } from 'react'
import { SCORE_CATEGORIES } from '../constants/scoreConfig'
import { authFetch } from '../utils/auth'

const API_BASE = 'http://localhost:8000'

function calcAvgScore(cafe) {
  const keys = ['score_plug', 'score_wifi', 'score_noise', 'score_comfort']
  const values = keys.map((k) => cafe[k] ?? 0)
  return values.reduce((s, v) => s + v, 0) / values.length
}

function Stars({ score, size = 13 }) {
  return (
    <div className="detail-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`detail-star ${score >= i ? 'full' : score >= i - 0.5 ? 'half' : 'empty'}`}
          style={{ fontSize: size }}
        >★</span>
      ))}
    </div>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function ReviewCard({ review, currentUser, onDelete }) {
  const categories = SCORE_CATEGORIES.filter((c) => c.key !== 'score_table')
  const avg = categories.reduce((s, c) => s + (review[c.key] ?? 0), 0) / categories.length
  const isOwner = currentUser && review.username === currentUser

  return (
    <div className="review-card">
      <div className="review-card-top">
        <Stars score={avg} size={12} />
        <div className="review-card-meta">
          <span className="review-date">{formatDate(review.created_at)}</span>
          {isOwner && (
            <button className="review-delete-btn" onClick={() => onDelete(review.id)}>삭제</button>
          )}
        </div>
      </div>
      <div className="review-chips">
        {categories.map((cat) => (
          <span key={cat.key} className="review-chip">
            {cat.emoji} {review[cat.key]?.toFixed(1) ?? '-'}
          </span>
        ))}
      </div>
      {review.comment && <p className="review-comment">{review.comment}</p>}
    </div>
  )
}

// 블로그에서 가져온 후기 카드 (텍스트만, 섹션 단위로 구분)
function RawReviewCard({ review }) {
  return (
    <a
      className="raw-review-item"
      href={review.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <p className="raw-review-text">{review.text}</p>
    </a>
  )
}

// 별점 선택 컴포넌트 (0.5 단위)
function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="star-picker-wrap">
          {/* 왼쪽 절반 (0.5) */}
          <span
            className={`star-pick ${value >= i - 0.5 ? 'on' : ''}`}
            style={{ clipPath: 'inset(0 50% 0 0)' }}
            onClick={() => onChange(i - 0.5)}
          >★</span>
          {/* 오른쪽 절반 (1.0) */}
          <span
            className={`star-pick ${value >= i ? 'on' : ''}`}
            style={{ clipPath: 'inset(0 0 0 50%)' }}
            onClick={() => onChange(i)}
          >★</span>
        </span>
      ))}
      <span className="star-picker-val">{value.toFixed(1)}</span>
    </div>
  )
}

// 리뷰 작성 폼
function ReviewForm({ cafeId, onSubmitted, onLoginRequest, currentUser }) {
  const reviewableCategories = SCORE_CATEGORIES.filter((c) => c.key !== 'score_table')

  const initScores = () =>
    Object.fromEntries(reviewableCategories.map((c) => [c.key, 3.0]))

  const [scores, setScores] = useState(initScores)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`${API_BASE}/api/spaces/${cafeId}/reviews/`, {
        method: 'POST',
        body: JSON.stringify({ ...scores, comment }),
      })
      if (res.status === 401) { onLoginRequest(); return }
      const data = await res.json()
      if (!res.ok) {
        // 중복 리뷰 처리
        const msg = data?.non_field_errors?.[0] || '리뷰 작성에 실패했어요.'
        throw new Error(msg)
      }
      onSubmitted(data)
      setScores(initScores())
      setComment('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="review-form-login">
        <p>리뷰를 작성하려면 로그인이 필요해요</p>
        <button className="review-login-btn" onClick={onLoginRequest}>로그인하기</button>
      </div>
    )
  }

  return (
    <div className="review-form">
      <p className="review-form-title">리뷰 작성</p>

      {reviewableCategories.map((cat) => (
        <div key={cat.key} className="review-form-row">
          <span className="review-form-label">
            <span>{cat.emoji}</span> {cat.label}
          </span>
          <StarPicker
            value={scores[cat.key]}
            onChange={(v) => setScores((prev) => ({ ...prev, [cat.key]: v }))}
          />
        </div>
      ))}

      <textarea
        className="review-textarea"
        placeholder="방문 후기를 남겨주세요 (선택)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />

      {error && <p className="review-form-error">⚠️ {error}</p>}

      <button className="review-submit-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? '제출 중…' : '리뷰 등록'}
      </button>
    </div>
  )
}

function CafeDetailSheet({ cafe, currentUser, onClose, onLoginRequest }) {
  const [reviews, setReviews] = useState([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState(null)
  const [rawReviews, setRawReviews] = useState([])

  // 내가 이미 리뷰를 썼는지 확인
  const myReview = reviews.find((r) => r.username === currentUser)

  useEffect(() => {
    if (!cafe) return
    setReviewLoading(true)
    setReviewError(null)
    fetch(`${API_BASE}/api/spaces/${cafe.id}/reviews/`)
      .then((r) => { if (!r.ok) throw new Error(`서버 오류 ${r.status}`); return r.json() })
      .then(setReviews)
      .catch((e) => setReviewError(e.message))
      .finally(() => setReviewLoading(false))

    // 블로그에서 가져온 원문 후기 (점수 없는 텍스트만)
    fetch(`${API_BASE}/api/spaces/${cafe.id}/raw-reviews/`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setRawReviews(data.slice(0, 5))) // 너무 많지 않게 최대 5개만
      .catch(() => setRawReviews([]))
  }, [cafe])

  // 리뷰 작성 완료 → 목록에 추가
  const handleSubmitted = (newReview) => {
    setReviews((prev) => [newReview, ...prev])
  }

  // 리뷰 삭제
  const handleDelete = async (reviewId) => {
    try {
      const res = await authFetch(
        `${API_BASE}/api/spaces/${cafe.id}/reviews/${reviewId}/`,
        { method: 'DELETE' }
      )
      if (res.ok || res.status === 204) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      }
    } catch {}
  }

  if (!cafe) return null

  const hasTable = parseFloat(cafe.score_table) === 5
  const avgScore = calcAvgScore(cafe)
  const reviewableCategories = SCORE_CATEGORIES.filter((c) => c.key !== 'score_table')

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>

        <div className="detail-handle-wrap">
          <div className="list-handle" />
        </div>

        <div className="detail-scroll">

          {/* 기본 정보 */}
          <div className="detail-header">
            <div className="detail-title-row">
              <h2 className="detail-name">{cafe.name}</h2>
              {hasTable && <span className="detail-table-badge">🪑 넓은 테이블</span>}
            </div>
            <p className="detail-address">📌 {cafe.address}</p>
          </div>

          <hr className="detail-divider" />

          {/* 점수 섹션 */}
          <section className="detail-section">
            <h3 className="detail-section-title">카공 지표 점수</h3>
            <div className="detail-score-layout">
              <div className="detail-score-big">
                <span className="detail-score-num">{avgScore.toFixed(1)}</span>
                <Stars score={avgScore} size={13} />
                <span className="detail-score-review-count">리뷰 {cafe.total_review_count}개</span>
              </div>
              <div className="detail-score-bars">
                {reviewableCategories.map((cat) => {
                  const pct = ((cafe[cat.key] ?? 0) / 5) * 100
                  return (
                    <div key={cat.key} className="detail-bar-row">
                      <span className="detail-bar-icon">{cat.emoji}</span>
                      <div className="detail-bar-wrap">
                        <div className="detail-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="detail-bar-val">
                        {cafe[cat.key] != null ? cafe[cat.key].toFixed(1) : '-'}
                      </span>
                    </div>
                  )
                })}
                <div className="detail-bar-row">
                  <span className="detail-bar-icon">🪑</span>
                  <span className={`detail-table-tag ${hasTable ? 'good' : 'bad'}`}>
                    {hasTable ? '넓고 편함' : '보통'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <hr className="detail-divider" />

          {/* 리뷰 작성 폼: 이미 쓴 리뷰 없을 때만 표시 */}
          {!myReview && (
            <>
              <ReviewForm
                cafeId={cafe.id}
                currentUser={currentUser}
                onSubmitted={handleSubmitted}
                onLoginRequest={onLoginRequest}
              />
              <hr className="detail-divider" />
            </>
          )}

          {/* 방문 리뷰 (유저 별점 리뷰) */}
          <section className="detail-section">
            <h3 className="detail-section-title">방문 리뷰</h3>

            {reviewLoading && (
              <div className="empty-state">
                <div className="spinner" />
                <p>리뷰 불러오는 중</p>
              </div>
            )}
            {reviewError && (
              <div className="empty-state">
                <span className="empty-state-icon">⚠️</span>
                <p>리뷰를 불러올 수 없어요</p>
                <small>{reviewError}</small>
              </div>
            )}
            {!reviewLoading && !reviewError && reviews.length === 0 && (
              <div className="empty-state">
                <span className="empty-state-icon">✍️</span>
                <p>아직 리뷰가 없어요</p>
              </div>
            )}
            {!reviewLoading && !reviewError && reviews.length > 0 && (
              <div className="review-list">
                {[...reviews]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((rv) => (
                    <ReviewCard
                      key={rv.id}
                      review={rv}
                      currentUser={currentUser}
                      onDelete={handleDelete}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* 블로그 후기 섹션 — 방문 리뷰와 완전히 분리 */}
          {!reviewLoading && rawReviews.length > 0 && (
            <>
              <hr className="detail-divider" />
              <section className="detail-section raw-review-section">
                <h3 className="detail-section-title">📝 블로그 후기</h3>
                <div className="raw-review-list">
                  {rawReviews.map((rv, idx) => (
                    <RawReviewCard key={idx} review={rv} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <button className="detail-close-btn" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}

export default CafeDetailSheet