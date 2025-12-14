import { useEffect, useRef, useState } from 'react';

// AI Features Hook - Handles Transcription & Noise Suppression
export function useAIFeatures(localStream, isMicOn, userName) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [showCaption, setShowCaption] = useState(false);
  const [isNoiseSuppression, setIsNoiseSuppression] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const captionTimeoutRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Show caption when speaking
        if (interimTranscript || finalTranscript) {
          setCurrentCaption(interimTranscript || finalTranscript);
          setShowCaption(true);
          
          // Clear existing timeout
          if (captionTimeoutRef.current) {
            clearTimeout(captionTimeoutRef.current);
          }
          
          // Hide caption 2 seconds after speech stops
          captionTimeoutRef.current = setTimeout(() => {
            setShowCaption(false);
            setCurrentCaption('');
          }, 2000);
        }

        // Add to transcript if final
        if (finalTranscript) {
          const now = new Date();
          setTranscript(prev => [...prev, {
            speaker: userName || 'You',
            text: finalTranscript.trim(),
            timestamp: now.toLocaleTimeString()
          }]);
        }
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error === 'no-speech') {
          if (isTranscribing) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              // Already started
            }
          }
        }
      };

      recognitionRef.current.onend = () => {
        if (isTranscribing) {
          try {
            recognitionRef.current.start();
          } catch (err) {
            // Already started
          }
        }
      };
    }

    // Cleanup function
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore error
        }
      }
    };
  }, [isTranscribing, userName]);

  // Toggle Transcription
  const toggleTranscription = () => {
    if (!recognitionRef.current) {
      return { success: false, message: 'Speech recognition not supported in this browser', type: 'error' };
    }

    if (isTranscribing) {
      try {
        recognitionRef.current.stop();
        setIsTranscribing(false);
        setShowCaption(false);
        setCurrentCaption('');
        if (captionTimeoutRef.current) {
          clearTimeout(captionTimeoutRef.current);
          captionTimeoutRef.current = null;
        }
        return { success: true, message: 'AI Transcription stopped', type: 'info' };
      } catch (err) {
        console.error('Error stopping transcription:', err);
        // Force stop anyway
        setIsTranscribing(false);
        setShowCaption(false);
        return { success: true, message: 'Transcription stopped', type: 'info' };
      }
    } else {
      try {
        recognitionRef.current.start();
        setIsTranscribing(true);
        return { success: true, message: 'AI Transcription started', type: 'success' };
      } catch (err) {
        console.error('Error starting transcription:', err);
        return { success: false, message: 'Could not start transcription', type: 'error' };
      }
    }
  };

  // Download Transcript
  const downloadTranscript = (roomId) => {
    if (transcript.length === 0) {
      return { success: false, message: 'No transcript to download', type: 'error' };
    }

    try {
      let text = 'Meeting Transcript\n';
      text += '==================\n\n';
      text += `Meeting ID: ${roomId}\n`;
      text += `Date: ${new Date().toLocaleString()}\n\n`;
      text += 'Transcript:\n';
      text += '----------\n\n';

      transcript.forEach(item => {
        text += `[${item.timestamp}] ${item.speaker}: ${item.text}\n\n`;
      });

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${roomId}-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, message: 'Transcript downloaded!', type: 'success' };
    } catch (err) {
      console.error('Error downloading transcript:', err);
      return { success: false, message: 'Error downloading transcript', type: 'error' };
    }
  };

  // AI Noise Suppression
  const toggleNoiseSuppression = async () => {
    if (!localStream) {
      return { success: false, message: 'No audio stream available', type: 'error' };
    }

    if (isNoiseSuppression) {
      // Disable noise suppression
      try {
        if (audioContextRef.current) {
          if (audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
          }
          audioContextRef.current = null;
        }
        setIsNoiseSuppression(false);
        return { success: true, message: 'AI Noise suppression disabled', type: 'info' };
      } catch (err) {
        console.error('Error disabling noise suppression:', err);
        // Force disable anyway
        audioContextRef.current = null;
        setIsNoiseSuppression(false);
        return { success: true, message: 'Noise suppression disabled', type: 'info' };
      }
    } else {
      // Enable noise suppression
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(localStream);
        
        // Create filters for noise suppression
        const lowpass = audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 3000; // Remove high-frequency noise
        
        const highpass = audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 100; // Remove low-frequency rumble
        
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;
        
        // Connect the filters
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(compressor);
        
        const destination = audioContext.createMediaStreamDestination();
        compressor.connect(destination);
        
        audioContextRef.current = audioContext;
        
        setIsNoiseSuppression(true);
        return { success: true, message: 'AI Noise suppression enabled', type: 'success' };
      } catch (err) {
        console.error('Error enabling noise suppression:', err);
        return { success: false, message: 'Could not enable noise suppression', type: 'error' };
      }
    }
  };

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop transcription
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore
        }
      }
      
      // Close audio context
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        } catch (err) {
          // Ignore
        }
      }
      
      // Clear timeout
      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTranscribing,
    transcript,
    currentCaption,
    showCaption,
    isNoiseSuppression,
    toggleTranscription,
    downloadTranscript,
    toggleNoiseSuppression
  };
}

// Live Caption Component
export function LiveCaption({ caption, show }) {
  if (!show || !caption) return null;

  return (
    <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 max-w-3xl w-full px-4">
      <div className="bg-black/90 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-2xl border border-white/20 animate-slideIn">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-300 font-semibold">Live Caption (AI)</span>
        </div>
        <p className="text-base md:text-lg font-medium leading-relaxed">{caption}</p>
      </div>
    </div>
  );
}