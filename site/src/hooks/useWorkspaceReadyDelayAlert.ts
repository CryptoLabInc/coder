import type {
	AgentConnectionTiming,
	WorkspaceBuildTimings,
} from "api/typesGenerated";
import { useEffect, useRef, useState } from "react";

export type WorkspaceReadyDelayAlertState = {
	shouldShow: boolean;
};

const DELAY_THRESHOLD_MS = 5_000;
const INVALID_ENDED_AT = "0001-01-01T00:00:00Z";

export const useWorkspaceReadyDelayAlert = (
	timings: WorkspaceBuildTimings | undefined,
	enabled: boolean,
): WorkspaceReadyDelayAlertState => {
	const [shouldShow, setShouldShow] = useState(false);
	const emptySinceRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			setShouldShow(false);
			emptySinceRef.current = null;
			return;
		}

		const checkDelay = () => {
			if (!timings?.agent_connection_timings) {
				setShouldShow(false);
				emptySinceRef.current = null;
				return;
			}
			const list = timings.agent_connection_timings;
			const now = Date.now();
			if (list.length === 0) {
				if (emptySinceRef.current === null) {
					emptySinceRef.current = now;
				}
				setShouldShow(now - emptySinceRef.current >= DELAY_THRESHOLD_MS);
				return;
			}

			emptySinceRef.current = null;
			const hasDelayedConnection = list.some((timing: AgentConnectionTiming) => {
				if (timing.ended_at !== INVALID_ENDED_AT) {
					return false;
				}
				const startedAt = new Date(timing.started_at).getTime();
				const elapsed = now - startedAt;
				return elapsed >= DELAY_THRESHOLD_MS;
			});

			setShouldShow(hasDelayedConnection);
		};

		checkDelay();

		const intervalId = window.setInterval(checkDelay, 1000);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [timings, enabled]);

	return { shouldShow };
};
