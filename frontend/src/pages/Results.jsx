import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { voteApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

// Mock results for development
const mockResults = [
  {
    rank: 1,
    outfitId: 'OUT001',
    username: 'FashionQueen',
    score: 4.8,
    totalVotes: 5,
    products: [
      { productSin: 'P001', name: 'Silk Evening Gown', category: 'Dresses', price: 1250, imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400' },
      { productSin: 'P002', name: 'Strappy Heels', category: 'Shoes', price: 750, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400' },
      { productSin: 'P003', name: 'Statement Earrings', category: 'Jewelry', price: 425, imageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400' },
    ],
    totalPrice: 2425,
  },
  {
    rank: 2,
    outfitId: 'OUT002',
    username: 'StyleGuru',
    score: 4.2,
    totalVotes: 5,
    products: [
      { productSin: 'P004', name: 'Oversized Blazer', category: 'Outerwear', price: 2100, imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400' },
      { productSin: 'P005', name: 'Wide Leg Trousers', category: 'Bottoms', price: 385, imageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400' },
    ],
    totalPrice: 2485,
  },
  {
    rank: 3,
    outfitId: 'OUT003',
    username: 'TrendSetter',
    score: 3.6,
    totalVotes: 5,
    products: [
      { productSin: 'P006', name: 'Cashmere Sweater', category: 'Tops', price: 695, imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400' },
      { productSin: 'P007', name: 'Crocodile Pattern Bag', category: 'Accessories', price: 890, imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400' },
      { productSin: 'P008', name: 'Luxe Leather Sneakers', category: 'Shoes', price: 450, imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400' },
    ],
    totalPrice: 2035,
  },
];

function Results() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { results, setResults, resetGame, isSinglePlayer, currentPlayer } = useGameStore();
  const [isLoading, setIsLoadingLocal] = useState(true);
  const [expandedItems, setExpandedItems] = useState({}); // outfitId → true means show items dropdown
  const confettiRef = useRef(null);

  const toggleItems = (outfitId) => {
    setExpandedItems(prev => ({ ...prev, [outfitId]: !prev[outfitId] }));
  };

  const launchConfetti = useCallback(() => {
    const container = confettiRef.current;
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#EE4A1B', '#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#F472B6', '#FBBF24', '#34D399'];
    const shapes = ['circle', 'square', 'strip'];
    for (let i = 0; i < 120; i++) {
      const piece = document.createElement('div');
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const duration = 2.5 + Math.random() * 2;
      const drift = (Math.random() - 0.5) * 200;
      const spin = Math.random() * 720 - 360;

      piece.className = `confetti-piece confetti-${shape}`;
      piece.style.cssText = `
        left: ${left}%;
        background: ${color};
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        --drift: ${drift}px;
        --spin: ${spin}deg;
      `;
      container.appendChild(piece);
    }
    // Clean up after animation
    setTimeout(() => { if (container) container.innerHTML = ''; }, 4500);
  }, []);

  useEffect(() => {
    socketService.disconnect();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [gameId]);

  const fetchResults = async () => {
    setIsLoadingLocal(true);
    try {
      const response = await voteApi.getResults(gameId);
      const fetched = response.data.results || [];
      setResults(fetched.length > 0 ? fetched : mockResults);
    } catch {
      setResults(mockResults);
    } finally {
      setIsLoadingLocal(false);
      setTimeout(() => launchConfetti(), 300);
    }
  };

  const handlePlayAgain = () => {
    resetGame();
    navigate('/');
  };

  const handleShareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Style Showdown Results',
        text: `Check out who won the fashion competition!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="results-container">
        <div className="loading" style={{ color: 'white' }}>
          <div className="spinner" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--primary-orange)' }}></div>
          <p>Calculating results...</p>
        </div>
      </div>
    );
  }

  const displayResults = results.length > 0 ? results : mockResults;
  const topThree = displayResults.slice(0, 3);
  const restOfResults = displayResults.slice(3);

  return (
    <div className="results-container">
      {/* Confetti */}
      <div className="confetti-container" ref={confettiRef} />

      {/* Header */}
      <header className="results-header">
        <h1>{isSinglePlayer ? 'Your Look' : 'The Results Are In'}</h1>
      </header>

      {/* Winner Podium */}
      <div className="winner-podium">
        {topThree.map((result, index) => {
          const placeClass = index === 0 ? 'first' : index === 1 ? 'second' : 'third';
          const emoji = index === 0 ? '👑' : index === 1 ? '🥈' : '🥉';
          const isExpanded = expandedItems[result.outfitId];

          const isMe = result.playerId === currentPlayer?.playerId;

          return (
            <div key={result.outfitId} className={`podium-place ${placeClass}`}>
              {/* Main Image — AI generated or product grid fallback */}
              <div className="podium-outfit">
                {result.tryOnImage ? (
                  <img
                    src={result.tryOnImage}
                    alt={`${result.username}'s look`}
                    className="podium-model-img"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="podium-outfit-grid">
                    {result.products.slice(0, 4).map((product) => (
                      <div key={product.productSin} className="podium-outfit-item">
                        <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View Items Toggle */}
              <button
                className={`view-items-btn ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleItems(result.outfitId)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                {isExpanded ? 'Hide Items' : `${result.products.length} Items`}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Items Dropdown */}
              {isExpanded && (
                <div className="items-dropdown">
                  {result.products.map((product) => (
                    <div key={product.productSin} className="items-dropdown-item">
                      <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      <div className="items-dropdown-info">
                        <span className="items-dropdown-name">{product.name}</span>
                        <span className="items-dropdown-price">${product.price.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Rank Emoji */}
              <div className="podium-rank">{emoji}</div>

              {/* Player Info */}
              <div className="podium-player-name">
                {result.username}
                {isMe && <span style={{ marginLeft: '6px', fontSize: '0.7em', color: 'var(--primary-orange)', fontWeight: '600' }}>(You)</span>}
              </div>
              <div className="podium-score">
                <span className="star">★</span>
                <span>{result.score.toFixed(1)}</span>
              </div>

              {/* Podium Bar */}
              <div className="podium-bar">
                {result.rank}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of Results */}
      {restOfResults.length > 0 && (
        <div className="results-rest">
          <h3>Other Submissions</h3>
          {restOfResults.map((result) => {
            const isExpanded = expandedItems[result.outfitId];
            const isMe = result.playerId === currentPlayer?.playerId;
            return (
              <div key={result.outfitId} className="result-item-wrapper">
                <div className="result-item">
                  <div className="result-rank">#{result.rank}</div>
                  <div className="result-outfit-preview">
                    {result.tryOnImage ? (
                      <img
                        src={result.tryOnImage}
                        alt={`${result.username}'s look`}
                        style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      result.products.slice(0, 4).map((product) => (
                        <img key={product.productSin} src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                      ))
                    )}
                  </div>
                  <div className="result-info">
                    <div className="result-player-name">
                      {result.username}
                      {isMe && <span style={{ marginLeft: '6px', fontSize: '0.75em', color: 'var(--primary-orange)', fontWeight: '600' }}>(You)</span>}
                    </div>
                    <div className="result-item-count">{result.products.length} items</div>
                  </div>
                  <div className="result-score">
                    <span>★</span>
                    <span>{result.score.toFixed(1)}</span>
                  </div>
                  <button className="view-items-btn-sm" onClick={() => toggleItems(result.outfitId)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
                {isExpanded && (
                  <div className="items-dropdown items-dropdown-horizontal">
                    {result.products.map((product) => (
                      <div key={product.productSin} className="items-dropdown-item">
                        <img src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
                        <div className="items-dropdown-info">
                          <span className="items-dropdown-name">{product.name}</span>
                          <span className="items-dropdown-price">${product.price.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="results-actions">
        <button onClick={handleShareResults} className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share Results
        </button>
        <button onClick={handlePlayAgain} className="btn btn-primary">
          Play Again
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Results;
