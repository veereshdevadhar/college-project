const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const server = http.createServer(app);

// SOCKET.IO (ALLOW ALL ORIGINS)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Models
const User = require('./models/User');
const Room = require('./models/Room');

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// ============================
// 🛑 IN-MEMORY ROOM STORE FIXED
// ============================
const rooms = new Map();  
// rooms.set(roomId, { users: [{ socketId, userId, userName }] })

// Health Check
app.get('/', (req, res) => {
  res.json({ message: 'WebRTC Video Conference API is LIVE', status: 'running' });
});

// ===========================
// CREATE ROOM
// ===========================
app.post('/api/rooms/create', async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const roomId = uuidv4().substring(0, 8);

    const newRoom = new Room({
      roomId,
      hostId: userId,
      hostName: userName,
      participants: [
        { userId, userName, joinedAt: new Date() }
      ],
      isActive: true
    });

    await newRoom.save();
    rooms.set(roomId, { users: [] });

    res.status(201).json({ success: true, roomId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// ===========================
// SOCKET.IO EVENTS
// ===========================
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // JOIN ROOM
  socket.on("join-room", ({ roomId, userId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, { users: [] });

    const room = rooms.get(roomId);

    // Avoid duplicates
    if (!room.users.find(u => u.socketId === socket.id)) {
      room.users.push({ socketId: socket.id, userId, userName });
    }

    console.log(`👥 Room ${roomId} users:`, room.users.length);

    // Send users list to the new user
    socket.emit("room-users", room.users);

    // Notify others
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userId,
      userName
    });
  });

  // ==================================
  // 📩 CHAT MESSAGE RELAY (IMPORTANT)
  // ==================================
  socket.on("send-message", ({ roomId, message, userName, userId }) => {
    const timestamp = new Date().toISOString();

    console.log(`💬 ${userName}: ${message} (Room: ${roomId})`);

    // Broadcast only to other users in the room
    socket.to(roomId).emit("receive-message", {
      message,
      userName,
      userId,
      timestamp
    });
  });

  // OFFER
  socket.on("offer", (data) => {
    socket.to(data.to).emit("offer", data);
  });

  // ANSWER
  socket.on("answer", (data) => {
    socket.to(data.to).emit("answer", data);
  });

  // ICE CANDIDATE
  socket.on("ice-candidate", (data) => {
    socket.to(data.to).emit("ice-candidate", data);
  });

  // LEAVE ROOM
  socket.on("leave-room", ({ roomId, userId, userName }) => {
    console.log(`🚪 User left manually: ${socket.id}`);

    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.users = room.users.filter(u => u.socketId !== socket.id);

      io.to(roomId).emit("user-left", { socketId: socket.id, userName });
      socket.leave(roomId);
    }
  });

  // DISCONNECT (FIXED)
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);

    rooms.forEach((room, roomId) => {
      const user = room.users.find(u => u.socketId === socket.id);

      if (user) {
        console.log(`🔻 Removing user ${user.userName} from room ${roomId}`);

        room.users = room.users.filter(u => u.socketId !== socket.id);

        io.to(roomId).emit("user-left", {
          socketId: socket.id,
          userName: user.userName
        });
      }
    });
  });

});

// Server Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
