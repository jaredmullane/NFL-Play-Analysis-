import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { FIELD_LENGTH, FIELD_WIDTH, FIELD_COLOR, LINE_COLOR, TEAM_RED_COLOR, TEAM_BLUE_COLOR, BALL_COLOR } from '../constants';
import { Keyframe } from '../types';

interface FieldProps {
  currentFrame: Keyframe | null;
  width?: number;
}

export const Field: React.FC<FieldProps> = ({ currentFrame, width = 800 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Aspect ratio calculation
  const height = width * (FIELD_WIDTH / FIELD_LENGTH);
  const margin = 20;

  // Scales
  const xScale = useMemo(() => d3.scaleLinear().domain([0, FIELD_LENGTH]).range([margin, width - margin]), [width]);
  const yScale = useMemo(() => d3.scaleLinear().domain([0, FIELD_WIDTH]).range([height - margin, margin]), [height]); // Invert Y for SVG

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render to handle resize cleanly for this demo

    // 1. Draw Field Background
    svg.append("rect")
      .attr("x", margin)
      .attr("y", margin)
      .attr("width", width - 2 * margin)
      .attr("height", height - 2 * margin)
      .attr("fill", FIELD_COLOR)
      .attr("rx", 4);

    // 2. Draw Endzones
    // Left Endzone (0-10)
    svg.append("rect")
      .attr("x", xScale(0))
      .attr("y", yScale(FIELD_WIDTH))
      .attr("width", xScale(10) - xScale(0))
      .attr("height", yScale(0) - yScale(FIELD_WIDTH))
      .attr("fill", "#225533") // Darker green
      .attr("stroke", LINE_COLOR);

    // Right Endzone (110-120)
    svg.append("rect")
      .attr("x", xScale(110))
      .attr("y", yScale(FIELD_WIDTH))
      .attr("width", xScale(120) - xScale(110))
      .attr("height", yScale(0) - yScale(FIELD_WIDTH))
      .attr("fill", "#225533")
      .attr("stroke", LINE_COLOR);

    // 3. Draw Yard Lines (Every 5 yards)
    for (let i = 10; i <= 110; i += 5) {
      svg.append("line")
        .attr("x1", xScale(i))
        .attr("y1", yScale(0))
        .attr("x2", xScale(i))
        .attr("y2", yScale(FIELD_WIDTH))
        .attr("stroke", LINE_COLOR)
        .attr("stroke-width", i % 10 === 0 ? 2 : 1)
        .attr("opacity", 0.8);

        // Add numbers every 10 yards
        if (i % 10 === 0 && i !== 0 && i !== 120) {
             const yardNum = i <= 60 ? i - 10 : 110 - i;
             if(yardNum !== 0) {
                 // Top numbers
                 svg.append("text")
                    .attr("x", xScale(i))
                    .attr("y", yScale(FIELD_WIDTH - 8))
                    .attr("text-anchor", "middle")
                    .attr("fill", LINE_COLOR)
                    .attr("font-size", Math.max(10, width / 60))
                    .attr("font-weight", "bold")
                    .attr("transform", `rotate(180, ${xScale(i)}, ${yScale(FIELD_WIDTH - 8)})`)
                    .text(yardNum);
                
                 // Bottom numbers
                 svg.append("text")
                    .attr("x", xScale(i))
                    .attr("y", yScale(8))
                    .attr("text-anchor", "middle")
                    .attr("fill", LINE_COLOR)
                    .attr("font-size", Math.max(10, width / 60))
                    .attr("font-weight", "bold")
                    .text(yardNum);
             }
        }
    }
    
    // Hash marks (simplified)
    for (let i = 11; i < 110; i++) {
         if (i % 5 !== 0) {
             // Bottom hashes
             svg.append("line").attr("x1", xScale(i)).attr("y1", yScale(20)).attr("x2", xScale(i)).attr("y2", yScale(20.5)).attr("stroke", LINE_COLOR);
             // Top hashes
             svg.append("line").attr("x1", xScale(i)).attr("y1", yScale(32.8)).attr("x2", xScale(i)).attr("y2", yScale(33.3)).attr("stroke", LINE_COLOR);
         }
    }

  }, [width, xScale, yScale, height]);

  // Render Players and Ball (Separate effect for performance/updates)
  useEffect(() => {
    if (!svgRef.current || !currentFrame) return;
    const svg = d3.select(svgRef.current);

    // Transition duration should match playback speed roughly, or be instant if dragging slider
    const t = svg.transition().duration(200).ease(d3.easeLinear);

    // --- TEAM RED ---
    const redGroup = svg.selectAll<SVGCircleElement, unknown>(".player-red")
        .data(currentFrame.teamRed, (d: any) => d.id || Math.random());

    redGroup.enter()
        .append("circle")
        .attr("class", "player-red")
        .attr("r", 4)
        .attr("fill", TEAM_RED_COLOR)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("opacity", 0)
        .transition(t)
        .attr("opacity", 1);

    redGroup.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));

    redGroup.exit().transition(t).attr("opacity", 0).remove();


    // --- TEAM BLUE ---
    const blueGroup = svg.selectAll<SVGCircleElement, unknown>(".player-blue")
        .data(currentFrame.teamBlue, (d: any) => d.id || Math.random());

    blueGroup.enter()
        .append("circle")
        .attr("class", "player-blue")
        .attr("r", 4)
        .attr("fill", TEAM_BLUE_COLOR)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("opacity", 0)
        .transition(t)
        .attr("opacity", 1);

    blueGroup.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));

    blueGroup.exit().transition(t).attr("opacity", 0).remove();


    // --- BALL ---
    const ball = svg.selectAll<SVGCircleElement, unknown>(".ball")
        .data([currentFrame.ball]);

    ball.enter()
        .append("circle")
        .attr("class", "ball")
        .attr("r", 3)
        .attr("fill", BALL_COLOR)
        .attr("stroke", "black")
        .attr("stroke-width", 0.5)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("opacity", 0)
        .transition(t)
        .attr("opacity", 1);

    ball.transition(t)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y));
        
    ball.exit().remove();

  }, [currentFrame, xScale, yScale]);

  return (
    <div className="relative flex justify-center overflow-hidden rounded-lg shadow-2xl bg-black border border-slate-700">
      <svg ref={svgRef} width={width} height={height} className="cursor-crosshair" />
      <div className="absolute top-2 left-4 pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
             <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
             <span className="text-xs font-mono text-white opacity-75">Offense</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
             <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
             <span className="text-xs font-mono text-white opacity-75">Defense</span>
        </div>
        <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-amber-400 border border-black"></div>
             <span className="text-xs font-mono text-white opacity-75">Ball</span>
        </div>
      </div>
    </div>
  );
};
