import { useEffect, useRef, useState } from 'react';
import { Bar } from './ui';
import { formatDuration } from '../lib/format';
import { currentPhase, PHASE_LABELS, workoutSeconds, type PlannedWorkout } from '../training/plans';

export function WorkoutGuide({ workout, elapsedSec, running }: { workout: PlannedWorkout; elapsedSec: number; running: boolean }) {
  const current = currentPhase(workout, elapsedSec);
  const [audio, setAudio] = useState(false);
  const lastSpoken = useRef(-1);
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const instruction = current.done ? 'Session time reached. Finish when ready; no extra exercise needed.' : PHASE_LABELS[current.phase.kind];

  useEffect(() => {
    if (!audio || !running || !supported) return;
    if (lastSpoken.current === current.index) return;
    lastSpoken.current = current.index;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(instruction));
  }, [audio, running, supported, current.index, instruction]);

  useEffect(() => {
    if (supported && (!audio || !running)) window.speechSynthesis.cancel();
    return () => { if (supported) window.speechSynthesis.cancel(); };
  }, [audio, running, supported]);

  return <section className="panel workout-guide">
    <h2>{workout.title}</h2>
    <p className="workout-instruction" aria-live="polite">{instruction}</p>
    {!current.done && <p className="pixel small">{formatDuration(current.remaining)} left in this block</p>}
    <Bar value={elapsedSec} max={workoutSeconds(workout)} label={`${Math.min(current.index + 1, workout.phases.length)} / ${workout.phases.length} blocks`} />
    <p className="small muted">Walk and recovery blocks count. Pause stops the workout clock. Stop if you feel pain or unwell.</p>
    {supported ? <label className="day-choice">
      <input type="checkbox" checked={audio} onChange={e => { lastSpoken.current = -1; setAudio(e.target.checked); }} />
      Spoken workout cues
    </label> : <p className="small muted">Spoken cues aren't available on this device.</p>}
    <p className="tiny muted">Audio is optional and may stop when this screen is hidden or your phone locks. GPS tracking is separate.</p>
  </section>;
}
