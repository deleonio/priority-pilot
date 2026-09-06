import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

/**
 * Öffentliche Beitrittsseite (#1226): `/gruppen/beitreten?token=…`
 *
 * Ein Screen, eine Aufgabe — Gruppenname und Einladender als Kontext, genau eine Primäraktion
 * „Gruppe beitreten". Die Seite hängt bewusst VOR dem Auth-Gate (siehe `Root`): Die Linkvorschau
 * ist öffentlich (Feldminimierung serverseitig — nur Gruppenname und Einladender), das Einlösen
 * selbst braucht eine Session; ohne Anmeldung wird der stille Google-Login mit der Beitrittsseite
 * als `returnTo` gestartet, damit der Token den Login-Roundtrip überlebt.
 *
 * Vier gestaltete Zustände (KI-UX-Block): Laden, „Einladung nicht mehr gültig" (404/410 —
 * gemeinsame freundliche Meldung statt nacktem Statuscode), Erfolg nach dem Einlösen und der
 * Sonderfall 409 (bereits Mitglied) als eigener Zustand statt Fehler-Alarm.
 */

/** Gruppenname und Einladender aus der öffentlichen Linkvorschau. */
type LinkPreview = { name: string; invitedByName: string };

type Phase = 'loading' | 'invalid' | 'ready' | 'joining' | 'joined' | 'already-member' | 'error';

/** Liest den Token aus der Query — auf der öffentlichen Route ohne Router-Abhängigkeit. */
const readToken = (): string | null => new URLSearchParams(window.location.search).get('token');

export const GroupJoinPage = () => {
	const [phase, setPhase] = useState<Phase>('loading');
	const [preview, setPreview] = useState<LinkPreview | null>(null);
	// Fehlermeldung für technische Störungen — NICHT für 404/410 (die haben ihren eigenen Zustand).
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const token = readToken();
		if (token === null) {
			setPhase('invalid');
			return;
		}
		api
			.getInviteLink({ token })
			.then((link) => {
				setPreview(link);
				setPhase('ready');
			})
			.catch(async (reason) => {
				const apiError = await toApiError(reason);
				if (apiError.status === 404 || apiError.status === 410) {
					setPhase('invalid');
					return;
				}
				setError(apiError.message);
				setPhase('error');
			});
	}, []);

	const handleJoin = async (): Promise<void> => {
		// Doppeltaps ignorieren: während des Einlösens ist die Aktion gesperrt (KI-UX-Block).
		const token = readToken();
		if (token === null || phase === 'joining') {
			return;
		}
		setPhase('joining');
		try {
			await api.redeemInviteLink({ token });
			setPhase('joined');
		} catch (reason) {
			const apiError = await toApiError(reason);
			if (apiError.status === 401) {
				// Erst Anmeldung, dann automatisch zurück auf die Beitrittsseite (#1226): der stille
				// Google-Login nimmt einen sanitisierten internen Return-Path auf (serverseitig
				// `sanitizeReturnPath`), der Query-Parameter überlebt den Roundtrip.
				const returnTo = `/gruppen/beitreten?token=${encodeURIComponent(token)}`;
				window.location.href = `/auth/google/silent?returnTo=${encodeURIComponent(returnTo)}`;
				return;
			}
			if (apiError.status === 409) {
				// Sonderfall als eigener Zustand, nicht als Fehler-Alarm (KI-UX-Block).
				setPhase('already-member');
				return;
			}
			if (apiError.status === 404 || apiError.status === 410) {
				setPhase('invalid');
				return;
			}
			setError(apiError.message);
			setPhase('error');
		}
	};

	return (
		<div className="join-page">
			<div className="join-card">
				{phase === 'loading' && <KolSpin _show _variant="cycle" _label="Einladung wird geprüft …" />}

				{phase === 'invalid' && (
					<KolAlert _type="warning" _label="Einladung nicht mehr gültig">
						Diese Einladung ist nicht mehr gültig — sie ist abgelaufen oder wurde ungültig gemacht. Frag die Person, die
						dich eingeladen hat, gerne um einen neuen Link.
					</KolAlert>
				)}

				{error !== null && phase === 'error' && (
					<KolAlert _type="error" _label="Das hat leider nicht geklappt">
						{error}
					</KolAlert>
				)}

				{/* Kontext (Gruppenname + Einladender) bleibt in allen Beitritts-Phasen sichtbar; Erfolg und
				    409 ersetzen die Primäraktion, damit der Zustand eindeutig bleibt (KI-UX-Block). */}
				{preview !== null && phase !== 'invalid' && phase !== 'loading' && (
					<>
						{(phase === 'ready' || phase === 'joining') && (
							<>
								<p className="join-card-context">
									Du wurdest in die Gruppe <strong>{preview.name}</strong> von <strong>{preview.invitedByName}</strong>{' '}
									eingeladen.
								</p>
								<KolButton
									_label="Gruppe beitreten"
									_variant="primary"
									_disabled={phase === 'joining'}
									_on={{ onClick: () => void handleJoin() }}
								/>
							</>
						)}
						{phase === 'joined' && (
							<>
								<KolAlert _type="success" _label="Beitritt abgeschlossen">
									{`Du bist der Gruppe „${preview.name}“ beigetreten.`}
								</KolAlert>
								<KolButton
									_label="Zu meinen Gruppen"
									_variant="secondary"
									_on={{ onClick: () => window.location.assign('/settings/gruppen') }}
								/>
							</>
						)}
						{phase === 'already-member' && (
							<KolAlert _type="info" _label="Bereits Mitglied">
								{`Du bist bereits Mitglied der Gruppe „${preview.name}“.`}
							</KolAlert>
						)}
					</>
				)}
			</div>
		</div>
	);
};
