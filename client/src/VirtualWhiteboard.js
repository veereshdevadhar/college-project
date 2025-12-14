import React, { useRef, useState, useEffect } from 'react';

export function VirtualWhiteboard({ show, onClose, socketRef, roomId }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [tool, setTool] = useState('pen'); // pen, eraser, line, rectangle, circle

  useEffect(() => {
    if (!show || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Fill with white background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Listen for drawing data from other users
    if (socketRef.current) {
      socketRef.current.on('whiteboard-draw', (data) => {
        drawFromData(ctx, data);
      });

      socketRef.current.on('whiteboard-clear', () => {
        clearCanvas();
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('whiteboard-draw');
        socketRef.current.off('whiteboard-clear');
      }
    };
  }, [show, socketRef]);

  const startDrawing = (e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = tool === 'eraser' ? '#1a1a1a' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.lineTo(x, y);
    ctx.stroke();

    // Send drawing data to other users
    if (socketRef.current && roomId) {
      socketRef.current.emit('whiteboard-draw', {
        roomId,
        x,
        y,
        color: tool === 'eraser' ? '#1a1a1a' : color,
        lineWidth: tool === 'eraser' ? lineWidth * 3 : lineWidth,
        tool
      });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const drawFromData = (ctx, data) => {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClear = () => {
    clearCanvas();
    if (socketRef.current && roomId) {
      socketRef.current.emit('whiteboard-clear', { roomId });
    }
  };

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  if (!show) return null;

  const colors = ['#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#000000'];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <i className="fas fa-chalkboard"></i>
            Virtual Whiteboard
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition p-2"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 p-4 border-b border-white/10 flex-wrap">
          {/* Tools */}
          <div className="flex gap-2">
            <button
              onClick={() => setTool('pen')}
              className={`px-4 py-2 rounded-lg transition ${
                tool === 'pen' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <i className="fas fa-pen"></i>
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`px-4 py-2 rounded-lg transition ${
                tool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <i className="fas fa-eraser"></i>
            </button>
          </div>

          {/* Colors */}
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool('pen');
                }}
                className={`w-8 h-8 rounded-full border-2 transition ${
                  color === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Line Width */}
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Size:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-white text-sm w-8">{lineWidth}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleClear}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
            >
              <i className="fas fa-trash mr-2"></i>Clear
            </button>
            <button
              onClick={downloadWhiteboard}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              <i className="fas fa-download mr-2"></i>Download
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 p-4 overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-full cursor-crosshair rounded-lg border border-white/10"
          />
        </div>
      </div>
    </div>
  );
}