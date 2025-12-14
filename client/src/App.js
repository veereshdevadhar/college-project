// src/App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import axios from 'axios';
import { useAIFeatures, LiveCaption } from './AIFeatures';

// const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'https://videoconference-webrtc-aigz.onrender.com';


function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [user, setUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false); // For password visibility toggle

  // Room State
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // Media State
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState('chat');
  const [showSidebar, setShowSidebar] = useState(false);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs
  const socketRef = useRef();
  const peersRef = useRef(new Map());
  const localVideoRef = useRef();
  const screenStreamRef = useRef();

  // === AI FEATURES HOOK (INTEGRATED) ===
  const aiFeatures = useAIFeatures(localStream, isMicOn, user?.name);

  // Attach local stream to video element once UI + stream are ready
  useEffect(() => {
    if (!inRoom) return;
    if (!localStream) return;
    if (!localVideoRef.current) {
      console.warn('⚠️ Local video ref not ready yet');
      return;
    }

    console.log('📺 Binding local stream to local video element...');
    localVideoRef.current.srcObject = localStream;
    localVideoRef.current.muted = true;

    localVideoRef.current
      .play()
      .then(() => console.log('✅ Local video playing'))
      .catch(err => console.error('❌ Local video play error:', err));
  }, [inRoom, localStream]);

  // Check authentication on mount and URL parameters
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      setIsAuthenticated(true);
    }

    // Check URL for room parameter
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      localStorage.setItem('pendingRoomId', roomParam);
    }
  }, []);

  // Show notification helper
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Add Video Stream
  const addVideoStream = useCallback((socketId, stream, userName) => {
    // Update peer object if present
    const p = peersRef.current.get(socketId);
    if (p) {
      p.stream = stream;
      peersRef.current.set(socketId, p);
      setPeers(Array.from(peersRef.current.values()));
      return;
    }

    // If no peer yet, create a lightweight record (peer may be attached later)
    const peerObj = {
      socketId,
      userName,
      peer: null,
      stream,
    };
    peersRef.current.set(socketId, peerObj);
    setPeers(Array.from(peersRef.current.values()));
  }, []);

  // Create Peer (initiator)
  const createPeer = useCallback((socketId, stream, userName) => {
    if (peersRef.current.has(socketId)) {
      console.log('⏭ Peer already exists in createPeer:', socketId);
      return peersRef.current.get(socketId).peer;
    }

    console.log('🔗 Creating peer connection to:', userName, 'Socket ID:', socketId);

    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      // send offer
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('offer', {
          offer: signal,
          to: socketId,
          from: socketRef.current.id,
          userName: user?.name || 'Guest'
        });
      }
    });

    peer.on('stream', remoteStream => {
      console.log('📺 Received stream from:', userName);
      addVideoStream(socketId, remoteStream, userName);
    });

    peer.on('error', err => {
      console.error('❌ Peer error with:', userName, err);
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed:', userName);
      peersRef.current.delete(socketId);
      setPeers(Array.from(peersRef.current.values()));
    });

    const peerObj = {
      socketId,
      userName,
      peer,
      stream: null
    };

    peersRef.current.set(socketId, peerObj);
    setPeers(Array.from(peersRef.current.values()));

    return peer;
  }, [addVideoStream, user]);

  // Add Peer (receiver)
  const addPeer = useCallback((offer, socketId, stream, userName) => {
    if (peersRef.current.has(socketId)) {
      console.log('⏭ Peer already exists in addPeer:', socketId);
      return peersRef.current.get(socketId).peer;
    }

    console.log('🔗 Adding peer connection from:', userName, 'Socket ID:', socketId);

    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('answer', {
          answer: signal,
          to: socketId,
          from: socketRef.current.id
        });
      }
    });

    peer.on('stream', remoteStream => {
      console.log('📺 Received stream from:', userName);
      addVideoStream(socketId, remoteStream, userName);
    });

    peer.on('error', err => {
      console.error('❌ Peer error with:', userName, err);
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed:', userName);
      peersRef.current.delete(socketId);
      setPeers(Array.from(peersRef.current.values()));
    });

    try {
      peer.signal(offer);
    } catch (err) {
      console.warn('Error signaling peer with offer:', err);
    }

    const peerObj = {
      socketId,
      userName,
      peer,
      stream: null
    };

    peersRef.current.set(socketId, peerObj);
    setPeers(Array.from(peersRef.current.values()));

    return peer;
  }, [addVideoStream]);

  // Join Room with ID (FIXED order)
  const joinRoomWithId = useCallback(async (roomIdToJoin) => {
    if (!user) {
      console.error('No user found');
      return;
    }

    try {
      setLoading(true);

      // ✅ Ensure meeting UI (with localVideoRef) is rendered first
      setRoomId(roomIdToJoin);
      setInRoom(true);
      setShowJoinDialog(false);

      console.log('🎥 Requesting camera and microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          volume: 1.0
        }
      });

      console.log('✅ Camera access granted!');
      console.log('Stream tracks:', stream.getTracks());

      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('🎤 Audio track enabled:', track.label);
      });

      stream.getVideoTracks().forEach(track => {
        track.enabled = true;
        console.log('📹 Video track enabled:', track.label, 'ready state:', track.readyState);
      });

      console.log('Setting local stream...');
      setLocalStream(stream);

      // ✅ No more setTimeout + direct ref, useEffect handles attachment

      socketRef.current = io(SERVER_URL);

      socketRef.current.on('connect', () => {
        console.log('✅ Connected to server, Socket ID:', socketRef.current.id);

        socketRef.current.emit('join-room', {
          roomId: roomIdToJoin,
          userId: user.id,
          userName: user.name
        });

        showNotification('Joined room successfully!', 'success');
      });

      socketRef.current.on('room-users', (users) => {
        console.log('📋 Room users received:', users);

        users.forEach(remoteUser => {
          if (remoteUser.userId === user.id) {
            console.log('⏭ Skipping self:', remoteUser.userName);
            return;
          }

          if (peersRef.current.has(remoteUser.socketId)) {
            console.log('⏭ Peer already exists:', remoteUser.userName);
            return;
          }

          console.log('➕ Creating peer for:', remoteUser.userName);
          createPeer(remoteUser.socketId, stream, remoteUser.userName);
        });
      });

      socketRef.current.on('user-joined', ({ socketId, userName }) => {
        console.log('👋 User joined:', userName, 'Socket ID:', socketId);

        if (peersRef.current.has(socketId)) {
          console.log('⏭ Already connected to:', userName);
          return;
        }

        showNotification(`${userName} joined the room`, 'info');
      });

      socketRef.current.on('offer', ({ offer, from, userName }) => {
        console.log('📥 Received offer from:', userName, 'Socket ID:', from);

        if (peersRef.current.has(from)) {
          console.log('⏭ Peer already exists for offer from:', userName);
          return;
        }

        addPeer(offer, from, stream, userName);
      });

      socketRef.current.on('answer', ({ answer, from }) => {
        console.log('📥 Received answer from:', from);
        const peerObj = peersRef.current.get(from);
        if (peerObj) {
          try {
            peerObj.peer.signal(answer);
          } catch (err) {
            console.warn('Error signaling answer to peer:', err);
          }
        } else {
          console.warn('⚠ Received answer but peer not found:', from);
        }
      });

      socketRef.current.on('ice-candidate', ({ candidate, from }) => {
        const peerObj = peersRef.current.get(from);
        if (peerObj) {
          try {
            peerObj.peer.signal(candidate);
          } catch (err) {
            console.warn('Error applying ICE candidate:', err);
          }
        }
      });

      socketRef.current.on('receive-message', ({ message, userName, timestamp }) => {
        setMessages(prev => [...prev, {
          text: message,
          sender: userName,
          timestamp: new Date(timestamp),
          isOwn: userName === user.name
        }]);
      });

      socketRef.current.on('user-left', ({ socketId, userName }) => {
        console.log('👋 User left:', userName, 'Socket ID:', socketId);
        showNotification(`${userName} left the room`, 'info');

        const peerObj = peersRef.current.get(socketId);
        if (peerObj) {
          console.log('🗑 Destroying peer connection for:', userName);
          try {
            peerObj.peer.destroy();
          } catch (err) {
            console.warn('Error destroying peer:', err);
          }
          peersRef.current.delete(socketId);
          setPeers(Array.from(peersRef.current.values()));
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      showNotification('Could not access camera/microphone', 'error');
      setLoading(false);
      // Reset room state on failure
      setInRoom(false);
      setRoomId('');
      setLocalStream(null);
    }
  }, [showNotification, createPeer, addPeer, user]);

  // Auto-join room after authentication
  useEffect(() => {
    if (isAuthenticated && user && !inRoom) {
      const pendingRoomId = localStorage.getItem('pendingRoomId');
      if (pendingRoomId) {
        localStorage.removeItem('pendingRoomId');
        showNotification('Joining meeting...', 'info');
        setTimeout(() => {
          joinRoomWithId(pendingRoomId);
        }, 1000);
      }
    }
  }, [isAuthenticated, user, inRoom, joinRoomWithId, showNotification]);

  // Register Handler
  const handleRegister = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      setLoading(true);
      const response = await axios.post(`${SERVER_URL}/api/auth/register`, data);
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        setIsAuthenticated(true);
        showNotification('Registration successful!', 'success');
      } else {
        showNotification(response.data.message || 'Registration failed', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showNotification(error.response?.data?.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password')
    };

    try {
      setLoading(true);
      console.log('Attempting login to:', `${SERVER_URL}/api/auth/login`);
      const response = await axios.post(`${SERVER_URL}/api/auth/login`, data);
      console.log('Login response:', response.data);

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        setIsAuthenticated(true);
        showNotification('Login successful!', 'success');
      } else {
        showNotification(response.data.message || 'Login failed', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'ERR_NETWORK') {
        showNotification('Cannot connect to server. Is the backend running?', 'error');
      } else {
        showNotification(error.response?.data?.message || 'Login failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    if (inRoom) leaveRoom();
  };

  // Create Room
  const createRoom = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${SERVER_URL}/api/rooms/create`, {
        userId: user.id,
        userName: user.name
      });

      if (response.data.success) {
        setRoomId(response.data.roomId);
        joinRoomWithId(response.data.roomId);
      } else {
        showNotification(response.data.message || 'Failed to create room', 'error');
      }
    } catch (error) {
      showNotification('Failed to create room', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Join Room (UI handler)
  const joinRoom = () => {
    const inputRoomId = document.getElementById('roomIdInput')?.value?.trim();
    if (!inputRoomId) {
      showNotification('Please enter a room ID', 'error');
      return;
    }
    joinRoomWithId(inputRoomId);
  };

  // Toggle Mic
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
        socketRef.current?.emit('toggle-audio', {
          roomId,
          isMuted: !audioTrack.enabled,
          userName: user.name
        });
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
        socketRef.current?.emit('toggle-video', {
          roomId,
          isVideoOff: !videoTrack.enabled,
          userName: user.name
        });
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });

        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        peersRef.current.forEach(({ peer }) => {
          try {
            const senders = peer && peer._pc && peer._pc.getSenders ? peer._pc.getSenders() : [];
            const sender = senders.find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          } catch (err) {
            console.warn('Replace track failed', err);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        showNotification('Screen sharing started', 'success');

        screenTrack.onended = () => {
          stopScreenShare();
        };
      } catch (error) {
        console.error('Error sharing screen:', error);
        showNotification('Could not share screen', 'error');
      }
    }
  };

  // Stop Screen Share
  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());

      const videoTrack = localStream?.getVideoTracks()[0];
      peersRef.current.forEach(({ peer }) => {
        try {
          const senders = peer && peer._pc && peer._pc.getSenders ? peer._pc.getSenders() : [];
          const sender = senders.find(s => s.track && s.track.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        } catch (err) {
          console.warn('Replace track failed', err);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      screenStreamRef.current = null;
      setIsScreenSharing(false);
      showNotification('Screen sharing stopped', 'info');
    }
  };

  // Send Message
  const sendMessage = () => {
    if (messageInput.trim() && socketRef.current) {
      socketRef.current.emit('send-message', {
        roomId,
        message: messageInput,
        userName: user.name,
        userId: user.id
      });

      setMessages(prev => [...prev, {
        text: messageInput,
        sender: user.name,
        timestamp: new Date(),
        isOwn: true
      }]);

      setMessageInput('');
    }
  };

  // Leave Room - ULTRA SAFE CLEANUP
  const leaveRoom = () => {
    if (window.confirm('Are you sure you want to leave the meeting?')) {
      console.log('🚪 Leaving room...');

      const safeExecute = (fn) => {
        try {
          fn();
        } catch (err) {
          // Silently ignore errors
        }
      };

      if (localStream) {
        localStream.getTracks().forEach(track => {
          safeExecute(() => track.stop());
        });
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          safeExecute(() => track.stop());
        });
      }

      console.log('🗑 Cleaning up peer connections...');

      const peersArray = Array.from(peersRef.current.values());
      peersArray.forEach(({ peer, userName }) => {
        safeExecute(() => {
          if (peer && typeof peer.destroy === 'function') {
            peer.destroy();
          }
        });
      });

      safeExecute(() => peersRef.current.clear());
      safeExecute(() => setPeers([]));

      if (socketRef.current) {
        safeExecute(() => {
          socketRef.current.emit('leave-room', {
            roomId,
            userId: user?.id,
            userName: user?.name
          });
        });

        safeExecute(() => socketRef.current.disconnect());
      }

      setInRoom(false);
      setRoomId('');
      setLocalStream(null);
      setMessages([]);
      setIsScreenSharing(false);
      setIsMicOn(true);
      setIsCameraOn(true);

      showNotification('You left the meeting', 'info');
      console.log('✅ Room cleanup complete');
    }
  };

  // Copy Room ID
  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      showNotification('Room ID copied to clipboard!', 'success');
    } else {
      showNotification('No Room ID to copy', 'error');
    }
  };

  // Copy Meeting Link
  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(meetingLink);
    showNotification('Meeting link copied! Anyone can join by opening this link.', 'success');
  };

  // Render Auth Page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="glass-effect rounded-2xl p-8 md:p-12 max-w-md w-full shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-white rounded-full mb-4">
              <i className="fas fa-video text-5xl text-purple-600"></i>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">WebRTC Conference</h1>
            <p className="text-white/80">Secure Peer-to-Peer Communication</p>
          </div>

          {showLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Login</h2>
              <input
                type="email"
                name="email"
                placeholder="Email"
                required
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              />

              {/* Password Input with Eye Icon */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  required
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <p className="text-white/80 text-center">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="text-white font-semibold underline"
                >
                  Register
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Register</h2>
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                required
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                required
                className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              />

              {/* Password Input with Eye Icon */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password (min 6 characters)"
                  required
                  minLength="6"
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white transition"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
              <p className="text-white/80 text-center">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowLogin(true);
                    setShowPassword(false);
                  }}
                  className="text-white font-semibold underline"
                >
                  Login
                </button>
              </p>
            </form>
          )}
        </div>

        {notification && (
          <div className={`notification px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-600' :
            notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            <div className="flex items-center gap-3 text-white">
              <i className={`fas ${
                notification.type === 'success' ? 'fa-check-circle' :
                notification.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
              }`}></i>
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Main Dashboard
  if (!inRoom) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="glass-effect rounded-2xl p-8 md:p-12 max-w-2xl w-full shadow-2xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Welcome, {user?.name}!</h1>
              <p className="text-white/70">Ready to start a meeting?</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-lg hover:from-green-600 hover:to-emerald-700 transition btn-hover disabled:opacity-50"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              {loading ? 'Creating Room...' : 'Create New Room'}
            </button>

            <button
              onClick={() => setShowJoinDialog(!showJoinDialog)}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-4 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition btn-hover"
            >
              <i className="fas fa-sign-in-alt mr-2"></i>Join Room
            </button>

            {showJoinDialog && (
              <div className="animate-slideIn">
                <label className="block text-white font-semibold mb-2">
                  <i className="fas fa-key mr-2"></i>Room ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="roomIdInput"
                    placeholder="Enter room ID"
                    className="flex-1 px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button
                    onClick={joinRoom}
                    disabled={loading}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold px-6 rounded-lg hover:from-purple-600 hover:to-pink-700 transition disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white/10 rounded-lg p-6 mt-8">
              <h3 className="text-white font-semibold mb-4 flex items-center">
                <i className="fas fa-star text-yellow-400 mr-2"></i>Features
              </h3>
              <div className="grid grid-cols-2 gap-4 text-white/80 text-sm">
                <div><i className="fas fa-video mr-2 text-green-400"></i>HD Video & Audio</div>
                <div><i className="fas fa-desktop mr-2 text-blue-400"></i>Screen Sharing</div>
                <div><i className="fas fa-comments mr-2 text-purple-400"></i>Real-time Chat</div>
                <div><i className="fas fa-closed-captioning mr-2 text-yellow-400"></i>AI Transcription</div>
              </div>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`notification px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-600' :
            notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            <div className="flex items-center gap-3 text-white">
              <i className={`fas ${
                notification.type === 'success' ? 'fa-check-circle' :
                notification.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
              }`}></i>
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Conference Room
  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      {/* Header */}
      <header className="glass-effect px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <i className="fas fa-video text-2xl text-white"></i>
          <div>
            <h2 className="text-white font-bold text-lg">Conference Room</h2>
            <p className="text-white/70 text-sm">Room ID: <span id="displayRoomId" className="font-mono">{roomId}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full pulse-animation"></div>
            <span className="text-white text-sm" id="participantCount">{peers.length + 1} Participant{peers.length !== 0 ? 's' : ''}</span>
          </div>
          <button
            onClick={copyRoomId}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <i className="fas fa-copy"></i>
            <span className="hidden md:inline">Copy Room ID</span>
          </button>
          <button
            onClick={copyMeetingLink}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2 font-semibold"
          >
            <i className="fas fa-link"></i>
            <span className="hidden lg:inline">Share Link</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-y-auto scrollbar-hide">
          <div id="videoGrid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Local Video - HORIZONTAL (16:9) */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
              <video
                id="localVideo"
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              ></video>
              <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
                <i className="fas fa-user mr-1"></i>
                <span id="localVideoLabel">{user?.name} (You)</span>
              </div>
              <div className="absolute top-3 right-3 flex gap-2">
                <div className={`${isMicOn ? 'bg-green-500' : 'bg-red-500'} p-2 rounded-full shadow-lg`}>
                  <i className={`fas ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'} text-white text-xs`}></i>
                </div>
                <div className={`${isCameraOn ? 'bg-green-500' : 'bg-red-500'} p-2 rounded-full shadow-lg`}>
                  <i className={`fas ${isCameraOn ? 'fa-video' : 'fa-video-slash'} text-white text-xs`}></i>
                </div>
              </div>
            </div>
            {/* Remote videos */}
            {peers.map((peer) => (
              <RemoteVideo key={peer.socketId} peer={peer} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div id="sidebar" className="md:w-96 glass-effect flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-white/20">
              <button onClick={() => setActiveTab('chat')} id="chatTab"
                className={`flex-1 py-3 font-semibold border-b-2 ${activeTab === 'chat' ? 'text-white border-white' : 'text-white/60 border-transparent hover:text-white transition'}`}>
                <i className="fas fa-comments mr-2"></i>Chat
              </button>
              <button onClick={() => setActiveTab('transcript')} id="transcriptTab"
                className={`flex-1 py-3 font-semibold border-b-2 ${activeTab === 'transcript' ? 'text-white border-white' : 'text-white/60 border-transparent hover:text-white transition'}`}>
                <i className="fas fa-closed-captioning mr-2"></i>Transcript
              </button>
              <button onClick={() => setActiveTab('participants')} id="participantsTab"
                className={`flex-1 py-3 font-semibold border-b-2 ${activeTab === 'participants' ? 'text-white border-white' : 'text-white/60 border-transparent hover:text-white transition'}`}>
                <i className="fas fa-users mr-2"></i>People
              </button>
            </div>

            {/* Chat Content */}
            {activeTab === 'chat' && (
              <div id="chatContent" className="flex-1 flex flex-col">
                <div id="chatMessages" className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {messages.length === 0 ? (
                    <p className="text-white/60 text-center py-8">No messages yet</p>
                  ) : (
                    messages.map((msg, index) => (
                      <div key={index} className={`chat-message ${msg.isOwn ? 'text-right' : ''}`}>
                        <div className="inline-block max-w-[80%]">
                          <div className={`text-xs ${msg.isOwn ? 'text-right' : ''} mb-1`}>
                            <span className="text-white/60">{msg.sender}</span>
                            <span className="text-white/40 ml-2">{msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className={`${msg.isOwn ? 'bg-blue-600' : 'bg-white/20'} text-white px-4 py-2 rounded-lg`}>
                            {msg.text}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-white/20">
                  <div className="flex gap-2">
                    <input type="text" id="chatInput" placeholder="Type a message..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button onClick={sendMessage}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition">
                      <i className="fas fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transcript Content - AI Feature */}
            {activeTab === 'transcript' && (
              <div id="transcriptContent" className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide" id="transcriptList">
                  {(!aiFeatures.transcript || aiFeatures.transcript.length === 0) ? (
                    <p className="text-white/60 text-center py-8">
                      {aiFeatures.isTranscribing ? 'Listening...' : 'No transcript yet. Click CC button to start AI transcription.'}
                    </p>
                  ) : (
                    aiFeatures.transcript.map((item, index) => (
                      <div key={index} className="bg-white/10 p-3 rounded-lg hover:bg-white/15 transition">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-white/60">{item.timestamp}</span>
                          <span className="text-xs font-semibold text-white">{item.speaker}</span>
                        </div>
                        <p className="text-sm text-white">{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-white/20">
                  <button
                    onClick={() => {
                      const result = aiFeatures.downloadTranscript(roomId);
                      showNotification(result.message, result.type);
                    }}
                    disabled={!aiFeatures.transcript || aiFeatures.transcript.length === 0}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                    <i className="fas fa-cloud-download-alt mr-2"></i>Download Transcript
                  </button>
                </div>
              </div>
            )}

            {/* Participants Content */}
            {activeTab === 'participants' && (
              <div id="participantsContent" className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                <div id="participantsList">
                  {/* Current User */}
                  <div className="bg-white/10 p-3 rounded-lg flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold">{user?.name} (You)</div>
                      <div className="text-white/60 text-sm">Host</div>
                    </div>
                    <div className="flex gap-1">
                      {isMicOn ? <i className="fas fa-microphone text-green-400"></i> : <i className="fas fa-microphone-slash text-red-400"></i>}
                      {isCameraOn ? <i className="fas fa-video text-green-400 ml-2"></i> : <i className="fas fa-video-slash text-red-400 ml-2"></i>}
                    </div>
                  </div>

                  {/* Remote Participants */}
                  {peers.map((peer) => (
                    <div key={peer.socketId} className="bg-white/10 p-3 rounded-lg flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                        {peer.userName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{peer.userName || 'Participant'}</div>
                        <div className="text-white/60 text-sm">Participant</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar - MODERN DESIGN */}
      <div className="glass-effect px-4 py-4">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {/* Mic Button - Modern Design */}
          <button
            onClick={toggleMic}
            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              isMicOn
                ? 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 hover:from-slate-600 hover:to-slate-600 shadow-lg'
                : 'bg-gradient-to-br from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-500 shadow-xl animate-pulse'
            }`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            <i className={`fas ${isMicOn ? 'fa-microphone' : 'fa-microphone-slash'} text-white text-xl drop-shadow-lg`}></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {isMicOn ? 'Mute' : 'Unmute'}
            </div>
          </button>

          {/* Camera Button - Modern Design */}
          <button
            onClick={toggleCamera}
            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              isCameraOn
                ? 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 hover:from-slate-600 hover:to-slate-600 shadow-lg'
                : 'bg-gradient-to-br from-red-600 via-red-500 to-red-600 hover:from-red-500 hover:to-red-500 shadow-xl animate-pulse'
            }`}
            title={isCameraOn ? "Stop Video" : "Start Video"}
          >
            <i className={`fas ${isCameraOn ? 'fa-video' : 'fa-video-slash'} text-white text-xl drop-shadow-lg`}></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {isCameraOn ? 'Stop Video' : 'Start Video'}
            </div>
          </button>

          {/* Screen Share Button - Modern Design */}
          <button
            onClick={toggleScreenShare}
            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              isScreenSharing
                ? 'bg-gradient-to-br from-green-600 via-green-500 to-green-600 hover:from-green-500 hover:to-green-500 shadow-xl'
                : 'bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-500 shadow-lg'
            }`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            <i className={`fas ${isScreenSharing ? 'fa-stop-circle' : 'fa-desktop'} text-white text-xl drop-shadow-lg`}></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </div>
          </button>

          {/* AI Transcription Button - Modern Design */}
          <button
            onClick={() => {
              try {
                const result = aiFeatures.toggleTranscription();
                showNotification(result.message, result.type);
              } catch (err) {
                showNotification('Error toggling transcription', 'error');
              }
            }}
            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              aiFeatures.isTranscribing
                ? 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-xl animate-pulse'
                : 'bg-gradient-to-br from-purple-600 via-purple-500 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg'
            }`}
            title="AI Transcription"
          >
            <i className="fas fa-closed-captioning text-white text-xl drop-shadow-lg"></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              AI Transcription
            </div>
          </button>

          {/* AI Noise Suppression Button - Modern Design */}
          <button
            onClick={() => {
              try {
                const result = aiFeatures.toggleNoiseSuppression();
                showNotification(result.message, result.type);
              } catch (err) {
                showNotification('Error toggling noise suppression', 'error');
              }
            }}
            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 ${
              aiFeatures.isNoiseSuppression
                ? 'bg-gradient-to-br from-green-600 via-emerald-500 to-teal-600 hover:from-green-500 hover:to-teal-500 shadow-xl'
                : 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700 hover:from-slate-600 hover:to-slate-600 shadow-lg'
            }`}
            title="AI Noise Suppression"
          >
            <i className="fas fa-wand-magic-sparkles text-white text-xl drop-shadow-lg"></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Noise Suppression
            </div>
          </button>

          {/* Chat/Sidebar Button - Modern Design */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="group relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 flex items-center justify-center transition-all duration-300 transform hover:scale-110 shadow-lg"
            title="Toggle Sidebar"
          >
            <i className={`fas ${showSidebar ? 'fa-times' : 'fa-comments'} text-white text-xl drop-shadow-lg`}></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {showSidebar ? 'Close' : 'Open'} Sidebar
            </div>
          </button>

          {/* Leave Meeting Button - Modern Design */}
          <button
            onClick={leaveRoom}
            className="group relative w-14 h-14 rounded-full bg-gradient-to-br from-red-700 via-red-600 to-red-700 hover:from-red-600 hover:to-red-600 flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:rotate-12 shadow-xl"
            title="Leave Meeting"
          >
            <i className="fas fa-phone-slash text-white text-xl drop-shadow-lg transform rotate-135"></i>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              Leave Meeting
            </div>
          </button>
        </div>
      </div>

      {/* Live Caption Display - AI Feature */}
      <LiveCaption caption={aiFeatures.currentCaption} show={aiFeatures.showCaption} />

      {/* Notification */}
      {notification && (
        <div className={`notification px-6 py-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          <div className="flex items-center gap-3 text-white">
            <i className={`fas ${
              notification.type === 'success' ? 'fa-check-circle' :
              notification.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
            }`}></i>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Remote Video Component WITH AUDIO FIX - HORIZONTAL (16:9)
function RemoteVideo({ peer }) {
  const videoRef = useRef();

  useEffect(() => {
    if (peer?.stream && videoRef.current) {
      console.log('🎬 Rendering remote video for:', peer.userName);
      try {
        videoRef.current.srcObject = peer.stream;
      } catch (err) {
        // fallback
        videoRef.current.src = window.URL.createObjectURL(peer.stream);
      }

      // EXPLICITLY ENABLE AUDIO PLAYBACK
      videoRef.current.volume = 1.0;

      // ENSURE VIDEO PLAYS
      videoRef.current.play().catch(err => {
        console.warn('Autoplay prevented for:', peer.userName, err);
      });

      // LOG AUDIO TRACKS
      const audioTracks = peer.stream.getAudioTracks ? peer.stream.getAudioTracks() : [];
      console.log('🎤 Remote audio tracks for', peer.userName, ':', audioTracks.length);
      audioTracks.forEach(track => {
        console.log('Track:', track.label, 'enabled:', track.enabled);
      });
    }
  }, [peer?.stream, peer?.userName]);

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      ></video>
      <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-lg text-sm backdrop-blur-sm">
        <i className="fas fa-user mr-1"></i>
        <span>{peer.userName || 'Participant'}</span>
      </div>
    </div>
  );
}

export default App;
