import React, { useState, useEffect, useRef } from 'react';

export function useVirtualBackground(localStream) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const applyBlur = async () => {
    if (!localStream) {
      return { success: false, message: 'No stream available', type: 'error' };
    }

    try {
      setIsProcessing(true);
      
      // Simple blur effect using canvas
      const video = document.createElement('video');
      video.srcObject = localStream;
      video.play();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;

      const processFrame = () => {
        if (!isBlurred) return;
        
        ctx.filter = 'blur(10px)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(processFrame);
      };

      processFrame();
      
      const processedStream = canvas.captureStream(30);
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        processedStream.addTrack(audioTrack);
      }

      setIsBlurred(true);
      setIsProcessing(false);
      
      return { 
        success: true, 
        message: 'Background blur enabled', 
        type: 'success',
        stream: processedStream 
      };
    } catch (err) {
      console.error('Error applying blur:', err);
      setIsProcessing(false);
      return { success: false, message: 'Could not apply blur', type: 'error' };
    }
  };

  const removeBlur = () => {
    setIsBlurred(false);
    return { success: true, message: 'Background blur removed', type: 'info' };
  };

  const applyVirtualBackground = async (imageUrl) => {
    if (!localStream) {
      return { success: false, message: 'No stream available', type: 'error' };
    }

    setBackgroundImage(imageUrl);
    return { success: true, message: 'Virtual background applied', type: 'success' };
  };

  return {
    isBlurred,
    backgroundImage,
    isProcessing,
    applyBlur,
    removeBlur,
    applyVirtualBackground
  };
}

// Background Selector Component
export function BackgroundSelector({ show, onClose, onSelect }) {
  if (!show) return null;

  const backgrounds = [
    { id: 'none', name: 'None', preview: null },
    { id: 'blur', name: 'Blur', preview: 'blur' },
    { id: 'office', name: 'Office', preview: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400' },
    { id: 'home', name: 'Living Room', preview: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400' },
    { id: 'beach', name: 'Beach', preview: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    { id: 'mountain', name: 'Mountain', preview: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400' },
    { id: 'city', name: 'City', preview: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400' },
    { id: 'space', name: 'Space', preview: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-xl">Choose Background</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => {
                onSelect(bg);
                onClose();
              }}
              className="group relative aspect-video rounded-lg overflow-hidden border-2 border-white/20 hover:border-blue-500 transition"
            >
              {bg.preview === 'blur' ? (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 backdrop-blur-xl flex items-center justify-center">
                  <i className="fas fa-circle-notch fa-spin text-white text-3xl"></i>
                </div>
              ) : bg.preview ? (
                <img src={bg.preview} alt={bg.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <i className="fas fa-ban text-white/50 text-3xl"></i>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <span className="text-white font-semibold">{bg.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}