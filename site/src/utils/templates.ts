import type { Template } from "api/typesGenerated";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(duration);
dayjs.extend(relativeTime);

export const formatTemplateActiveDevelopers = (num?: number): string => {
	if (num === undefined || num < 0) {
		// Loading
		return "-";
	}
	return num.toString();
};

export const formatTemplateBuildTime = (
	buildTimeMs?: number | null,
): string => {
	return buildTimeMs === undefined || buildTimeMs === null
		? "Unknown"
		: `${Math.round(dayjs.duration(buildTimeMs, "milliseconds").asSeconds())}s`;
};

const blockedWorkspaceTemplateDisplayName = "heaan2-0.1.1 playground (a100)";
const blockedTemplateRouteNames = new Set([
	"heaan-playground",
	"heaan2-playground-011",
]);

export const isBlockedWorkspaceTemplate = (
	template: Pick<Template, "display_name">,
): boolean => {
	return (
		template.display_name.toLowerCase() === blockedWorkspaceTemplateDisplayName
	);
};

export const filterBlockedWorkspaceTemplates = <
	T extends Pick<Template, "display_name">,
>(
	templates: readonly T[] | undefined,
	hideBlockedTemplates: boolean,
): readonly T[] | undefined => {
	if (!hideBlockedTemplates) {
		return templates;
	}

	return templates?.filter((template) => !isBlockedWorkspaceTemplate(template));
};

export const isBlockedTemplateRouteName = (templateName: string): boolean => {
	return blockedTemplateRouteNames.has(templateName);
};
