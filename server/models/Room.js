const mongoose = require('mongoose');
const RoomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hostId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  participants: [{
    userId: String,
    userName: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  }
});
module.exports = mongoose.model('Room', RoomSchema);