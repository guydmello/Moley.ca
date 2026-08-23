import { useRef, useState } from 'react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';
import type { DrawingPayload } from '@moley/shared';
import { useGame } from './store';

type Stroke = DrawingPayload['strokes'][number];

export function DrawingPad({ locked }: { locked: boolean }) {
  const send = useGame((state) => state.send);
  const submitted = useGame((state) => state.me?.submittedClue);
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const point = (event: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const box = svgRef.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))];
  };
  const start = (event: React.PointerEvent<SVGSVGElement>) => {
    if (locked || strokes.length >= 80) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true); setStrokes((current) => [...current, { points: [point(event)], color: 'ink', width: 0.012 }]);
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const next = point(event);
    setStrokes((current) => current.map((stroke, index) => index === current.length - 1 && stroke.points.length < 200 ? { ...stroke, points: [...stroke.points, next] } : stroke));
  };
  const finish = () => setDrawing(false);
  const path = (stroke: Stroke) => stroke.points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x * 600} ${y * 360}`).join(' ');
  return <div className="drawing-pad">
    <div className="drawing-toolbar"><strong>Draw one clue</strong><span>No uploads · strokes only</span><button disabled={locked || !strokes.length} onClick={() => setStrokes(strokes.slice(0, -1))}><RotateCcw /> Undo</button><button disabled={locked || !strokes.length} onClick={() => setStrokes([])}><Trash2 /> Clear</button></div>
    <svg ref={svgRef} viewBox="0 0 600 360" role="img" aria-label="Drawing clue canvas" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <rect width="600" height="360" fill="#fffaf1" />
      {strokes.map((stroke, index) => <path key={index} d={path(stroke)} fill="none" stroke="#17140f" strokeWidth={Math.max(2, stroke.width * 600)} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <button className="button button-primary button-wide" disabled={locked || !strokes.length} onClick={() => send({ type: 'submit_drawing', drawing: { strokes } })}><Check /> {submitted ? 'Drawing locked' : 'Lock drawing clue'}</button>
  </div>;
}

export function DrawingReveal({ drawing }: { drawing: DrawingPayload }) {
  return <svg className="drawing-reveal" viewBox="0 0 600 360" role="img" aria-label="Drawing clue">{drawing.strokes.map((stroke, index) => <path key={index} d={stroke.points.map(([x,y], i) => `${i ? 'L' : 'M'} ${x * 600} ${y * 360}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={Math.max(2, stroke.width * 600)} strokeLinecap="round" strokeLinejoin="round" />)}</svg>;
}
