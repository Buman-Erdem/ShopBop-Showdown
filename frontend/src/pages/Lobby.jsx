import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { gameApi, avatarApi } from '../services/api';
import useGameStore from '../store/gameStore';
import socketService from '../services/socket';

function Lobby() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    game,
    players,
    currentPlayer,
    userPhoto,
    setGame,
    setPlayers,
    setCurrentPlayer,
    setUserPhoto,
    setLoading,
    setError,
    isLoading,
    error,
  } = useGameStore();

  const [joining, setJoining] = useState(false);
  const [joinUsername, setJoinUsername] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const hasJoinedRef = useRef(false); // guard against StrictMode double-invoke
  const fileInputRef = useRef(null);

  // Avatar generation state
  const [photoTab, setPhotoTab] = useState('upload'); // 'upload' | 'ai'
  const [avatarForm, setAvatarForm] = useState({
    gender: '',
    ethnicity: '',
    height: '',
    waistSize: '',
    topSize: '',
  });
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);

  const isHost = currentPlayer?.isHost ?? false;

  // Connect socket and set up listeners when we have a player in this game
  useEffect(() => {
    if (!currentPlayer?.playerId || currentPlayer?.gameId !== gameId) return;

    socketService.connect(gameId, currentPlayer.playerId);

    const onPlayerJoined = ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    };
    const onPlayerReadyChanged = ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    };
    const onGameStarted = () => {
      navigate(`/game/${gameId}`);
    };

    socketService.on('player-joined', onPlayerJoined);
    socketService.on('player-ready-changed', onPlayerReadyChanged);
    socketService.on('game-started', onGameStarted);

    return () => {
      socketService.off('player-joined', onPlayerJoined);
      socketService.off('player-ready-changed', onPlayerReadyChanged);
      socketService.off('game-started', onGameStarted);
    };
  }, [currentPlayer?.playerId, gameId, navigate, setPlayers]);

  useEffect(() => {
    const username = searchParams.get('username');
    if (username && !currentPlayer && !hasJoinedRef.current) {
      hasJoinedRef.current = true;
      handleJoinGame(username);
    } else if (currentPlayer?.gameId === gameId) {
      // Already in game — just fetch fresh data
      fetchGameData();
    } else {
      // Landed directly on lobby URL — show join form
      fetchGameData();
      setShowJoinForm(true);
    }
  }, [gameId]);

  const fetchGameData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await gameApi.getGame(gameId);
      const data = response.data;
      setGame(data);
      setPlayers(data.players || []);

      // If game started, navigate to game page
      if (data.status === 'PLAYING') {
        navigate(`/game/${gameId}`);
      }
    } catch {
      if (!silent) setError('Failed to load game');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleJoinGame = async (username) => {
    setJoining(true);
    try {
      const response = await gameApi.joinGame(gameId, { username });
      const { player, game: joinedGame } = response.data;
      setCurrentPlayer(player);
      setGame(joinedGame);
      setPlayers(joinedGame.players || []);
      setShowJoinForm(false);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  const handleToggleReady = async () => {
    if (!currentPlayer) return;
    const newReady = !currentPlayer.isReady;
    try {
      await gameApi.readyToggle(gameId, { playerId: currentPlayer.playerId, isReady: newReady });
      setCurrentPlayer({ ...currentPlayer, isReady: newReady });
      setPlayers(players.map(p =>
        p.playerId === currentPlayer.playerId ? { ...p, isReady: newReady } : p
      ));
    } catch {
      setError('Failed to update ready status');
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await gameApi.startGame(gameId);
      navigate(`/game/${gameId}`);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameId);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUserPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setUserPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateAvatar = async () => {
    setGeneratingAvatar(true);
    setAvatarError(null);
    try {
      const res = await avatarApi.generate(avatarForm);
      const { base64, mimeType } = res.data;
      setUserPhoto(`data:${mimeType};base64,${base64}`);
      setPhotoTab('upload'); // switch to preview tab
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Failed to generate avatar');
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Join form for players arriving via direct link
  if (showJoinForm && !currentPlayer) {
    return (
      <div className="lobby-container">
        <header className="lobby-header">
          <h1>Join Game</h1>
          <div className="game-code-display">
            <span>{gameId}</span>
          </div>
        </header>
        <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>Enter your name to join the showdown</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <input
              type="text"
              placeholder="Your fashion name..."
              value={joinUsername}
              onChange={(e) => setJoinUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinUsername.trim() && handleJoinGame(joinUsername.trim())}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '1rem',
                width: '220px',
              }}
            />
            <button
              onClick={() => joinUsername.trim() && handleJoinGame(joinUsername.trim())}
              className="btn btn-primary"
              disabled={joining || !joinUsername.trim()}
            >
              {joining ? 'Joining...' : 'Join'}
            </button>
          </div>
          {error && <div className="error-message" style={{ marginTop: '16px' }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (isLoading && !game) {
    return (
      <div className="lobby-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading lobby...</p>
        </div>
      </div>
    );
  }

  const allReady = players.length >= 2 && players.every((p) => p.isReady);

  return (
    <div className="lobby-container">
      {/* Header */}
      <header className="lobby-header">
        <h1>Waiting Room</h1>
        <div className="game-code-display">
          <span>{gameId}</span>
          <button onClick={copyGameCode} className="btn btn-small btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Game Info Cards */}
      {game && (
        <div className="game-info-cards">
          <div className="info-card">
            <div className="info-card-label">Theme</div>
            <div className="info-card-value">{game.themeName || game.theme}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Budget</div>
            <div className="info-card-value">${game.budget?.toLocaleString()}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Time Limit</div>
            <div className="info-card-value">{formatTime(game.timeLimit)}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Players</div>
            <div className="info-card-value">{players.length}/{game.maxPlayers}</div>
          </div>
        </div>
      )}

      {/* Photo Section */}
      <section className="photo-upload-section">
        <h2>Your Photo</h2>
        <p className="photo-upload-hint">Used so the AI try-on model looks like you!</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
          <button
            onClick={() => setPhotoTab('upload')}
            style={{
              padding: '6px 18px',
              borderRadius: '20px',
              border: '1px solid var(--border-light)',
              background: photoTab === 'upload' ? 'var(--primary-orange)' : 'var(--bg-card)',
              color: photoTab === 'upload' ? '#fff' : 'var(--text-primary)',
              fontWeight: photoTab === 'upload' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Upload Photo
          </button>
          <button
            onClick={() => setPhotoTab('ai')}
            style={{
              padding: '6px 18px',
              borderRadius: '20px',
              border: '1px solid var(--border-light)',
              background: photoTab === 'ai' ? 'var(--primary-orange)' : 'var(--bg-card)',
              color: photoTab === 'ai' ? '#fff' : 'var(--text-primary)',
              fontWeight: photoTab === 'ai' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            ✨ AI Generate
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handlePhotoUpload}
          style={{ display: 'none' }}
        />

        {/* Upload Tab */}
        {photoTab === 'upload' && (
          userPhoto ? (
            <div className="photo-preview">
              <img src={userPhoto} alt="Your photo" className="photo-preview-img" />
              <button className="photo-remove-btn" onClick={handleRemovePhoto}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                Remove
              </button>
            </div>
          ) : (
            <button className="photo-upload-btn" onClick={() => fileInputRef.current?.click()}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Upload Photo</span>
              <span className="photo-upload-optional">Optional</span>
            </button>
          )
        )}

        {/* AI Avatar Tab */}
        {photoTab === 'ai' && (
          <div style={{ maxWidth: '380px', margin: '0 auto' }}>
            <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', textAlign: 'center', marginBottom: '14px' }}>
              Describe yourself and we'll generate a model that looks like you
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '4px' }}>Gender</label>
                <select
                  value={avatarForm.gender}
                  onChange={e => setAvatarForm(f => ({ ...f, gender: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value="">Any</option>
                  <option value="woman">Woman</option>
                  <option value="man">Man</option>
                  <option value="non-binary person">Non-binary</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '4px' }}>Ethnicity</label>
                <input
                  type="text"
                  placeholder="e.g. South Asian"
                  value={avatarForm.ethnicity}
                  onChange={e => setAvatarForm(f => ({ ...f, ethnicity: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '4px' }}>Height</label>
                <input
                  type="text"
                  placeholder="e.g. 5ft 6in or 168cm"
                  value={avatarForm.height}
                  onChange={e => setAvatarForm(f => ({ ...f, height: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '4px' }}>Top Size</label>
                <select
                  value={avatarForm.topSize}
                  onChange={e => setAvatarForm(f => ({ ...f, topSize: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value="">Any</option>
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-light)', marginBottom: '4px' }}>Waist Size</label>
                <input
                  type="text"
                  placeholder="e.g. 28 or 71cm"
                  value={avatarForm.waistSize}
                  onChange={e => setAvatarForm(f => ({ ...f, waistSize: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {avatarError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.8rem', textAlign: 'center', marginBottom: '10px' }}>
                {avatarError}
              </div>
            )}

            <button
              onClick={handleGenerateAvatar}
              disabled={generatingAvatar}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {generatingAvatar ? (
                <>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Generating...
                </>
              ) : (
                <>✨ Generate My Avatar</>
              )}
            </button>
            <p style={{ color: 'var(--text-light)', fontSize: '0.75rem', textAlign: 'center', marginTop: '8px' }}>
              All fields optional — more detail = better match
            </p>
          </div>
        )}
      </section>

      {/* Players Section */}
      <section className="players-section">
        <h2>Players</h2>
        <div className="players-grid">
          {players.map((player) => {
            const isMe = player.playerId === currentPlayer?.playerId;
            return (
              <div key={player.playerId} className={`player-card ${player.isReady ? 'ready' : ''}`}>
                <div className="player-avatar" style={{
                  background: `linear-gradient(135deg, ${player.isHost ? 'var(--primary-orange)' : '#6B6B6B'}, ${player.isHost ? '#DB3B14' : '#4A4A4A'})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '1.2rem',
                }}>
                  {player.username[0].toUpperCase()}
                </div>
                <div className="player-details">
                  <div className="player-name">
                    {player.isHost ? 'Host' : player.username}
                    {player.isHost && <span style={{ marginLeft: '6px' }}>👑</span>}
                    {!player.isHost && isMe && <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--primary-orange)', fontWeight: '600' }}>(You)</span>}
                  </div>
                  <div className="player-status-badge">
                    {player.isReady ? '● Ready' : '○ Not Ready'}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty slots */}
          {game && [...Array(Math.max(0, game.maxPlayers - players.length))].map((_, i) => (
            <div key={`empty-${i}`} className="player-card" style={{ opacity: 0.4, border: '2px dashed var(--border-light)' }}>
              <div className="player-avatar" style={{
                background: 'var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)',
                fontSize: '1.5rem',
              }}>
                ?
              </div>
              <div className="player-details">
                <div className="player-name" style={{ color: 'var(--text-light)' }}>Waiting...</div>
                <div className="player-status-badge">Empty Slot</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Share Link */}
      {currentPlayer && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '8px' }}>
          Share this link to invite friends:{' '}
          <code style={{ color: 'var(--text-primary)' }}>
            {window.location.origin}/lobby/{gameId}?username=FriendName
          </code>
        </div>
      )}

      {/* Actions */}
      <div className="lobby-actions">
        {currentPlayer && (
          <button onClick={handleToggleReady} className={`btn ${currentPlayer?.isReady ? 'btn-secondary' : 'btn-outline'}`}>
            {currentPlayer?.isReady ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Ready!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Mark Ready
              </>
            )}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStartGame}
            className="btn btn-primary"
            disabled={!allReady || isLoading}
          >
            {allReady ? (
              <>
                Start Showdown
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </>
            ) : (
              <>
                Waiting for Players...
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default Lobby;
