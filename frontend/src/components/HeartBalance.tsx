import type { Pillar } from 'client';
import { useMemo, useState, useEffect } from 'react';

/**
 * HeartBalance-Komponente: Zeigt ein Herz, das in Segmente pro Säule (Pillar) unterteilt ist.
 * Der Füllstand des Herzens spiegelt die Ausgewogenheit der Lebenssäulen wider.
 *
 * Design:
 * - Jede Säule entspricht einem Segment des Herzens
 * - Der Füllstand basiert auf der Balance der Säulen (je ausgewogener, desto voller)
 * - Optional: Wellenanimation des Füllpegels
 */
interface HeartBalanceProps {
	/** Die Lebenssäulen für die Segmentierung */
	pillars: Pillar[];
	/** Punkte pro Säule für die Füllstandsberechnung (Map: pillarId -> punkte) */
	punkteProSaeule: ReadonlyMap<number, number>;
	/** Ob die Wellenanimation aktiviert sein soll */
	animated?: boolean;
	/** Größe des Herzens (Breite in px, Höhe wird proportional berechnet) */
	size?: number;
}

/**
 * Berechnet den Balance-Score (0-1) basierend auf der Ausgewogenheit der Säulen.
 * Je gleichmäßiger die Punkte verteilt sind, desto höher der Score.
 *
 * Methode: 1 - (Standardabweichung der Anteile / maximale mögliche Standardabweichung)
 * Dies gibt einen Wert zwischen 0 (vollständig unausgeglichen) und 1 (perfekt ausgewogen).
 */
const calculateBalanceScore = (pillars: Pillar[], punkteProSaeule: ReadonlyMap<number, number>): number => {
	// Punkte pro Säule holen
	const points: number[] = pillars.map((pillar) => punkteProSaeule.get(pillar.id) ?? 0);
	const total = points.reduce((acc, p) => acc + p, 0);

	// Wenn keine Punkte vorhanden, ist der Score 0
	if (total === 0) return 0;

	// Anteile berechnen
	const shares = points.map((p) => p / total);

	// Durchschnitt berechnen
	const mean = shares.reduce((acc, s) => acc + s, 0) / shares.length;

	// Standardabweichung berechnen
	const variance = shares.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / shares.length;
	const stdDev = Math.sqrt(variance);

	// Maximale mögliche Standardabweichung (wenn alle Punkte auf einer Säule)
	const n = shares.length;
	const maxStdDev = Math.sqrt((n - 1) / (n * n));

	// Balance-Score: 1 - (stdDev / maxStdDev)
	const score = 1 - stdDev / maxStdDev;

	// Score auf 0-1 begrenzen
	return Math.max(0, Math.min(1, score));
};

/**
 * Erstellt die SVG-Pfaddaten für ein Herz.
 */
const getHeartPath = (width: number, height: number): string => {
	const centerX = width / 2;
	const centerY = height / 2;
	const radius = Math.min(width, height) * 0.4;

	// Klassische Herzform mit Bézier-Kurven
	const bottomY = centerY + radius * 0.8;
	const topY = centerY - radius * 0.6;
	const leftX = centerX - radius * 0.7;
	const rightX = centerX + radius * 0.7;
	const leftCurveX = centerX - radius * 0.4;
	const rightCurveX = centerX + radius * 0.4;
	const curveY = centerY + radius * 0.2;

	return `M ${centerX} ${bottomY}
		 C ${leftCurveX} ${curveY}, ${leftX} ${topY}, ${centerX} ${topY}
		 C ${rightX} ${topY}, ${rightCurveX} ${curveY}, ${centerX} ${bottomY}
		 Z`;
};

/**
 * Erstellt eine Wellenform für die Animation.
 */
const getWavePath = (width: number, fillLevel: number, time: number): string => {
	const waveHeight = width * 0.03; // Amplitude der Welle
	const waveLength = width * 0.4; // Wellenlänge
	const speed = 0.005; // Geschwindigkeit der Animation

	const yPos = width * (1 - fillLevel);

	let path = `M 0 ${yPos + waveHeight * Math.sin(time * speed)}`;

	for (let x = 0; x <= width; x += 5) {
		const y = yPos + waveHeight * Math.sin((x / waveLength) * Math.PI * 2 + time * speed);
		path += ` L ${x} ${y}`;
	}

	path += ` L ${width} ${width} L 0 ${width} Z`;

	return path;
};

/**
 * Farben für die Säulen-Segmente (aus den Design-Tokens) */
const PILLAR_COLORS = [
	'#2a78d6', // pp-pillar-1
	'#eb6834', // pp-pillar-2
	'#1baf7a', // pp-pillar-3
	'#eda100', // pp-pillar-4
	'#e87ba4', // pp-pillar-5
	'#008300', // pp-pillar-6
	'#4a3aa7', // pp-pillar-7
	'#e34948', // pp-pillar-8
];

/**
 * HeartBalance-Komponente
 */
export const HeartBalance = ({ pillars, punkteProSaeule, animated = true, size = 300 }: HeartBalanceProps) => {
	const balanceScore = useMemo(() => calculateBalanceScore(pillars, punkteProSaeule), [pillars, punkteProSaeule]);

	const totalPoints = useMemo(() => [...punkteProSaeule.values()].reduce((acc, p) => acc + p, 0), [punkteProSaeule]);

	// Animations-Timer
	const [time, setTime] = useState(0);

	useEffect(() => {
		if (!animated) return;

		const animationId = requestAnimationFrame(() => {
			setTime(Date.now());
		});

		return () => cancelAnimationFrame(animationId);
	}, [animated, time]);

	// SVG-Dimensionen
	const width = size;
	const height = size * 1.2;
	const centerX = width / 2;
	const centerY = height / 2;

	// Herz-Pfad
	const heartPath = useMemo(() => getHeartPath(width, height), [width, height]);

	// Füllpegel
	const fillY = height * (1 - balanceScore);

	// Farbauswahl für Segmente
	const getSegmentColor = (index: number): string => {
		return PILLAR_COLORS[index % PILLAR_COLORS.length];
	};

	// Anzahl der Segmente (entspricht der Anzahl der Säulen)
	const segmentCount = pillars.length;

	return (
		<div className="heart-balance" role="img" aria-label="Lebensbalance-Herz">
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				className="heart-balance-svg"
				aria-label={`Lebensbalance: ${Math.round(balanceScore * 100)}%`}
			>
				{/* Herz-Umriss */}
				<path
					d={heartPath}
					fill="none"
					stroke="var(--pp-border-subtle, #dfe3ea)"
					strokeWidth="2"
					className="heart-balance-outline"
				/>

				{/* Clip-Pfad für das Herz */}
				<clipPath id="heart-clip">
					<path d={heartPath} />
				</clipPath>

				{/* Hintergrund-Füllung mit Wellenanimation */}
				<g clipPath="url(#heart-clip)">
					{/* Statische Füllung */}
					<rect
						x={0}
						y={fillY}
						width={width}
						height={height - fillY}
						fill="var(--pp-signal, #f2b155)"
						opacity={0.2}
						className="heart-balance-fill"
					/>

					{/* Wellenanimation */}
					{animated && (
						<>
							{/* Erste Welle */}
							<path
								d={getWavePath(width, balanceScore, time)}
								fill="var(--pp-signal, #f2b155)"
								opacity={0.3}
								className="heart-balance-wave"
							/>
							{/* Zweite Welle (phasenverschoben) */}
							<path
								d={getWavePath(width, balanceScore, time + 1000)}
								fill="var(--pp-signal, #f2b155)"
								opacity={0.2}
								className="heart-balance-wave"
							/>
						</>
					)}
				</g>

				{/* Säulen-Segmente als farbige Bereiche */}
				{pillars.map((pillar, index) => {
					const points = punkteProSaeule.get(pillar.id) ?? 0;
					const pillarScore = totalPoints > 0 ? points / totalPoints : 0;

					// Füllhöhe für dieses Segment
					const segmentFillLevel = pillarScore;
					const segmentFillY = height * (1 - segmentFillLevel);

					// Winkelbereich für das Segment
					const startAngle = (index / segmentCount) * Math.PI * 2 - Math.PI / 2;
					const endAngle = ((index + 1) / segmentCount) * Math.PI * 2 - Math.PI / 2;

					// Clip-Pfad für das Segment (Kreis-Segment)
					const radius = Math.min(width, height) * 0.45;
					const clipPathId = `segment-clip-${index}`;

					return (
						<g key={`segment-${index}`}>
							{/* Clip-Pfad Definition */}
							<clipPath id={clipPathId}>
								<path
									d={`M ${centerX} ${centerY}
										L ${centerX + radius * Math.cos(startAngle)} ${centerY + radius * Math.sin(startAngle)}
										A ${radius} ${radius} 0 0 1 ${centerX + radius * Math.cos(endAngle)} ${centerY + radius * Math.sin(endAngle)}
										Z`}
								/>
							</clipPath>

							{/* Gefülltes Segment mit Clip-Pfad */}
							<g clipPath={`url(#${clipPathId})`}>
								<rect
									x={0}
									y={segmentFillY}
									width={width}
									height={height - segmentFillY}
									fill={getSegmentColor(index)}
									opacity={0.6}
								/>
							</g>

							{/* Segment-Umriss */}
							<path
								d={`M ${centerX} ${centerY}
									L ${centerX + radius * Math.cos(startAngle)} ${centerY + radius * Math.sin(startAngle)}
									A ${radius} ${radius} 0 0 1 ${centerX + radius * Math.cos(endAngle)} ${centerY + radius * Math.sin(endAngle)}
									Z`}
								fill="none"
								stroke={getSegmentColor(index)}
								strokeWidth="1"
								opacity={0.3}
							/>
						</g>
					);
				})}

				{/* Balance-Score in der Mitte */}
				<text
					x={centerX}
					y={centerY - height * 0.05}
					textAnchor="middle"
					fill="var(--pp-text, #12161d)"
					fontSize={width * 0.12}
					fontWeight="700"
					className="heart-balance-text"
				>
					{Math.round(balanceScore * 100)}%
				</text>

				{/* Beschriftung */}
				<text
					x={centerX}
					y={centerY + height * 0.22}
					textAnchor="middle"
					fill="var(--pp-text-muted, #525b6a)"
					fontSize={width * 0.05}
					fontWeight="500"
					className="heart-balance-label"
				>
					Lebensbalance
				</text>

				{/* Legende */}
				{pillars.length > 0 && pillars.length <= 8 && (
					<g className="heart-balance-legend" transform={`translate(${width * 0.05}, ${height * 0.65})`}>
						{pillars.map((pillar, index) => {
							const points = punkteProSaeule.get(pillar.id) ?? 0;
							const pillarScore = totalPoints > 0 ? points / totalPoints : 0;
							const yOffset = index * 18;

							return (
								<g key={`legend-${index}`} transform={`translate(0, ${yOffset})`}>
									{/* Farbiger Punkt */}
									<circle cx={0} cy={9} r={6} fill={getSegmentColor(index)} />
									{/* Säulenname */}
									<text
										x={12}
										y={12}
										fill="var(--pp-text-muted, #525b6a)"
										fontSize={12}
										textAnchor="start"
										alignmentBaseline="middle"
									>
										{pillar.name.length > 15 ? `${pillar.name.substring(0, 12)}...` : pillar.name}
									</text>
									{/* Anteil */}
									<text
										x={width * 0.6}
										y={12}
										fill="var(--pp-text-muted, #525b6a)"
										fontSize={12}
										textAnchor="end"
										alignmentBaseline="middle"
									>
										{Math.round(pillarScore * 100)}%
									</text>
								</g>
							);
						})}
					</g>
				)}
			</svg>

			{/* Info-Text */}
			<div className="heart-balance-info">
				<p>
					Dein Herz ist zu <strong>{Math.round(balanceScore * 100)}%</strong> gefüllt.
				</p>
				<p>Je ausgewogener deine Lebenssäulen sind, desto voller wird es.</p>
			</div>
		</div>
	);
};
