import React, { useState, useRef, useEffect } from 'react';

export function useMeetingRecorder(localStream) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState([]);
  
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  const startRecording = () => {
    if (!localStream) {
      return { success: false, message: 'No stream available', type: 'error' };
    }

    try {
      const options = {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000
      };

      // Fallback for browsers that don't support vp9
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }

      const mediaRecorder = new MediaRecorder(localStream, options);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks([...chunks]);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setRecordedChunks([]);
        setRecordingTime(0);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      return { success: true, message: 'Recording started', type: 'success' };
    } catch (err) {
      console.error('Error starting recording:', err);
      return { success: false, message: 'Could not start recording', type: 'error' };
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
      return { success: true, message: 'Recording paused', type: 'info' };
    }
    return { success: false, message: 'Cannot pause', type: 'error' };
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      return { success: true, message: 'Recording resumed', type: 'success' };
    }
    return { success: false, message: 'Cannot resume', type: 'error' };
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
      return { success: true, message: 'Recording saved!', type: 'success' };
    }
    return { success: false, message: 'No recording to stop', type: 'error' };
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime: formatTime(recordingTime),
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  };
}

// Recording Indicator Component
export function RecordingIndicator({ isRecording, isPaused, time }) {
  if (!isRecording) return null;

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-slideIn">
        <div className={`w-3 h-3 bg-white rounded-full ${!isPaused && 'animate-pulse'}`}></div>
        <span className="font-semibold">
          {isPaused ? 'PAUSED' : 'RECORDING'} {time}
        </span>
      </div>
    </div>
  );
}