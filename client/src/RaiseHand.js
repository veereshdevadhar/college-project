import React, { useState, useEffect } from 'react';

export function useRaiseHand(socketRef, roomId, userName) {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [pollResults, setPollResults] = useState({});

  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on('hand-raised', ({ userId, userName }) => {
      setRaisedHands(prev => {
        if (prev.find(h => h.userId === userId)) return prev;
        return [...prev, { userId, userName, time: new Date() }];
      });
    });

    socketRef.current.on('hand-lowered', ({ userId }) => {
      setRaisedHands(prev => prev.filter(h => h.userId !== userId));
    });

    socketRef.current.on('poll-created', (poll) => {
      setActivePoll(poll);
      setPollResults({});
    });

    socketRef.current.on('poll-vote', ({ option, userName }) => {
      setPollResults(prev => ({
        ...prev,
        [option]: [...(prev[option] || []), userName]
      }));
    });

    socketRef.current.on('poll-ended', () => {
      setActivePoll(null);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('hand-raised');
        socketRef.current.off('hand-lowered');
        socketRef.current.off('poll-created');
        socketRef.current.off('poll-vote');
        socketRef.current.off('poll-ended');
      }
    };
  }, [socketRef]);

  const toggleHand = () => {
    if (!socketRef.current || !roomId) return { success: false, message: 'Not connected', type: 'error' };

    if (isHandRaised) {
      socketRef.current.emit('hand-lowered', { roomId, userName });
      setIsHandRaised(false);
      return { success: true, message: 'Hand lowered', type: 'info' };
    } else {
      socketRef.current.emit('hand-raised', { roomId, userName });
      setIsHandRaised(true);
      return { success: true, message: 'Hand raised!', type: 'success' };
    }
  };

  const createPoll = (question, options) => {
    if (!socketRef.current || !roomId) return { success: false, message: 'Not connected', type: 'error' };

    const poll = {
      id: Date.now(),
      question,
      options,
      creator: userName
    };

    socketRef.current.emit('poll-created', { roomId, poll });
    setActivePoll(poll);
    return { success: true, message: 'Poll created!', type: 'success' };
  };

  const votePoll = (option) => {
    if (!socketRef.current || !roomId || !activePoll) return { success: false, message: 'No active poll', type: 'error' };

    socketRef.current.emit('poll-vote', { roomId, option, userName });
    return { success: true, message: 'Vote submitted!', type: 'success' };
  };

  const endPoll = () => {
    if (!socketRef.current || !roomId) return { success: false, message: 'Not connected', type: 'error' };

    socketRef.current.emit('poll-ended', { roomId });
    setActivePoll(null);
    return { success: true, message: 'Poll ended', type: 'info' };
  };

  return {
    isHandRaised,
    raisedHands,
    activePoll,
    pollResults,
    toggleHand,
    createPoll,
    votePoll,
    endPoll
  };
}

// Raised Hands Panel
export function RaisedHandsPanel({ hands, onClose }) {
  if (hands.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 bg-gray-900/95 backdrop-blur-lg rounded-xl p-4 shadow-2xl border border-white/10 max-w-sm z-40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <i className="fas fa-hand-paper text-yellow-400"></i>
          Raised Hands ({hands.length})
        </h3>
        <button onClick={onClose} className="text-white/60 hover:text-white">
          <i className="fas fa-times"></i>
        </button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {hands.map((hand, index) => (
          <div key={hand.userId} className="bg-white/10 p-2 rounded-lg flex items-center gap-2">
            <span className="text-white/60 text-sm">#{index + 1}</span>
            <span className="text-white flex-1">{hand.userName}</span>
            <span className="text-white/40 text-xs">
              {new Date(hand.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Poll Component
export function PollComponent({ poll, results, onVote, onEnd, userName }) {
  const [hasVoted, setHasVoted] = useState(false);

  if (!poll) return null;

  const handleVote = (option) => {
    onVote(option);
    setHasVoted(true);
  };

  const totalVotes = Object.values(results).reduce((sum, votes) => sum + votes.length, 0);

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-lg rounded-xl p-6 shadow-2xl border border-white/10 max-w-md w-full z-40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <i className="fas fa-poll text-blue-400"></i>
          Poll
        </h3>
        {poll.creator === userName && (
          <button onClick={onEnd} className="text-red-400 hover:text-red-300 text-sm">
            <i className="fas fa-times-circle mr-1"></i>End Poll
          </button>
        )}
      </div>

      <p className="text-white text-lg mb-4">{poll.question}</p>

      <div className="space-y-3">
        {poll.options.map((option, index) => {
          const votes = results[option]?.length || 0;
          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;

          return (
            <div key={index}>
              <button
                onClick={() => handleVote(option)}
                disabled={hasVoted}
                className={`w-full text-left p-3 rounded-lg transition relative overflow-hidden ${
                  hasVoted ? 'cursor-not-allowed' : 'hover:bg-white/20 cursor-pointer'
                }`}
              >
                <div
                  className="absolute inset-0 bg-blue-600/30 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-white font-medium">{option}</span>
                  <span className="text-white/60 text-sm">
                    {votes} vote{votes !== 1 ? 's' : ''} ({Math.round(percentage)}%)
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-white/60 text-sm text-center">
        Total votes: {totalVotes}
      </div>
    </div>
  );
}

// Create Poll Dialog
export function CreatePollDialog({ show, onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  if (!show) return null;

  const handleCreate = () => {
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }
    onCreate(question, validOptions);
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-white font-bold text-xl mb-4">Create Poll</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-white/80 text-sm mb-2 block">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question"
              className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-white/80 text-sm mb-2 block">Options</label>
            {options.map((option, index) => (
              <input
                key={index}
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[index] = e.target.value;
                  setOptions(newOptions);
                }}
                placeholder={`Option ${index + 1}`}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />
            ))}
            {options.length < 6 && (
              <button
                onClick={addOption}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                <i className="fas fa-plus mr-1"></i>Add Option
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition"
          >
            Create Poll
          </button>
        </div>
      </div>
    </div>
  );
}