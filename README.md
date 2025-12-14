---
## 🎉 INSTALLATION STEPS
### **1. Install Backend Dependencies**
```bash
cd video-conference-app/server
npm install
```
**Expected packages:**
- express
- mongoose
- socket.io
- cors
- dotenv
- bcryptjs
- jsonwebtoken
- express-validator
- uuid
- nodemon (dev dependency)
### **2. Install Frontend Dependencies**
```bash
cd ../client
npm install
```
**Expected packages:**
- react
- react-dom
- react-scripts
- socket.io-client
- simple-peer
- axios
- react-router-dom
- tailwindcss
- autoprefixer
- postcss
### **3. Start MongoDB**
```bash
# Windows (if installed as service):
net start MongoDB
# Mac:
brew services start mongodb-community
# Linux:
sudo systemctl start mongodb
# Or use MongoDB Atlas (cloud) - update .env with connection string
```
### **4. Start Backend Server**
```bash
cd server
npm run dev
```
**Expected output:**
```
🚀 Server running on port 5000
📡 Socket.IO server ready
🌐 CORS enabled for: http://localhost:3000
✅ MongoDB Connected Successfully
```
### **5. Start Frontend**
```bash
# New terminal
cd client
npm start
```
**Expected output:**
```
Compiled successfully!
Local: http://localhost:3000
```
---
## ✅ VERIFICATION CHECKLIST
```
Server Files Created:
☐ server/package.json
☐ server/server.js
☐ server/.env
☐ server/models/User.js
☐ server/models/Room.js
☐ server/routes/auth.js
Client Files Created:
☐ client/package.json
☐ client/.env
☐ client/tailwind.config.js
☐ client/public/index.html
☐ client/src/index.js
☐ client/src/index.css
☐ client/src/App.js
Installation Complete:
☐ server npm install successful
☐ client npm install successful
☐ MongoDB running
☐ Backend server running (port 5000)
☐ Frontend server running (port 3000)
☐ Can access http://localhost:3000
```
---
## 🎯 QUICK TEST
1. ✅ Open `http://localhost:3000`
2. ✅ Register a new account
3. ✅ Login
4. ✅ Create a room
5. ✅ Allow camera/mic permissions
6. ✅ See your video
7. ✅ Copy Room ID
8. ✅ Open new incognito window
9. ✅ Register different account
10. ✅ Join with Room ID
11. ✅ Test video/audio/chat
---
## 🔊 AUDIO IS FIXED!
The audio issue has been resolved with:
- Enhanced audio constraints (48kHz, stereo)
- Explicit audio track enablement
- Volume set to 1.0
- Console logging for debugging
- Proper remote video component
---
**Your complete MERN stack video conference application is ready to use!** 🎉