import { MATCH_SCORE_EXCELLENT, MATCH_SCORE_GOOD, MATCH_SCORE_ACCEPTABLE } from '@real-estate-bot/shared';

interface MatchScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function MatchScoreBadge({ score, size = 'md' }: MatchScoreBadgeProps) {
  const getScoreClass = () => {
    if (score >= MATCH_SCORE_EXCELLENT) return 'match-score-excellent';
    if (score >= MATCH_SCORE_GOOD) return 'match-score-good';
    if (score >= MATCH_SCORE_ACCEPTABLE) return 'match-score-acceptable';
    return 'match-score-low';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1';
      case 'lg':
        return 'text-lg px-4 py-2';
      default:
        return 'text-sm px-3 py-1.5';
    }
  };

  const getEmoji = () => {
    if (score >= MATCH_SCORE_EXCELLENT) return '🔥';
    if (score >= MATCH_SCORE_GOOD) return '✅';
    if (score >= MATCH_SCORE_ACCEPTABLE) return '👍';
    return '🤔';
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${getScoreClass()} ${getSizeClass()}`}>
      <span>{getEmoji()}</span>
      <span>{score.toFixed(1)}/10</span>
    </span>
  );
}