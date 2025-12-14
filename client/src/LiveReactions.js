import React, { useState, useEffect } from 'react';

// Live Reactions Component - Floating Emojis
export function useLiveReactions() {
  const [reactions, setReactions] = useState([]);
  const [reactionCount, setReactionCount] = useState(0);

  const sendReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const newReaction = {
      id,
      emoji,
      left: Math.random() * 80 + 10, // Random position 10-90%
      duration: 3000 + Math.random() * 1000 // 3-4 seconds
    };

    setReactions(prev => [...prev, newReaction]);
    setReactionCount(prev => prev + 1);

    // Remove reaction after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, newReaction.duration);
  };

  return {
    reactions,
    sendReaction,
    reactionCount
  };
}

// Reaction Picker Component
export function ReactionPicker({ onReactionSelect, show, onClose }) {
  if (!show) return null;

  const emojis = [
    { emoji: '👍', name: 'Like' },
    { emoji: '👏', name: 'Clap' },
    { emoji: '❤️', name: 'Love' },
    { emoji: '😂', name: 'Laugh' },
    { emoji: '😮', name: 'Wow' },
    { emoji: '🎉', name: 'Celebrate' },
    { emoji: '🙌', name: 'Raised Hands' },
    { emoji: '👌', name: 'OK' },
    { emoji: '🔥', name: 'Fire' },
    { emoji: '💯', name: '100' }
  ];

  return (
    <div className="fixed bottom-24 right-4 bg-gray-900/95 backdrop-blur-lg rounded-2xl p-4 shadow-2xl border border-white/10 animate-slideIn z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Quick Reactions</h3>
        <button onClick={onClose} className="text-white/60 hover:text-white transition">
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {emojis.map(({ emoji, name }) => (
          <button
            key={emoji}
            onClick={() => {
              onReactionSelect(emoji);
              onClose();
            }}
            className="w-12 h-12 flex items-center justify-center text-3xl hover:scale-125 transition-transform duration-200 rounded-lg hover:bg-white/10"
            title={name}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Floating Reactions Display
export function FloatingReactions({ reactions }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-40">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-0 animate-float-up"
          style={{
            left: `${reaction.left}%`,
            animationDuration: `${reaction.duration}ms`
          }}
        >
          <div className="text-6xl drop-shadow-lg">
            {reaction.emoji}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(-50px) scale(1);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-600px) scale(1.5);
            opacity: 0;
          }
        }
        .animate-float-up {
          animation: float-up forwards;
        }
      `}</style>
    </div>
  );
}