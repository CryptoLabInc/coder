import { API } from "api/api";
import { getErrorMessage } from "api/errors";
import { displayError, displaySuccess } from "components/GlobalSnackbar/utils";
import type { FC } from "react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation } from "react-query";
import { pageTitle } from "utils/page";
import { useTemplateSettings } from "../TemplateSettingsLayout";
import {
	type MigrateResult,
	TemplateMigratePageView,
} from "./TemplateMigratePageView";

export const TemplateMigratePage: FC = () => {
	const { template } = useTemplateSettings();
	const [targetTemplateId, setTargetTemplateId] = useState("");
	const [userEmailsInput, setUserEmailsInput] = useState("");

	const {
		mutate: migrate,
		isLoading: isSubmitting,
		data: result,
		error,
		reset,
	} = useMutation(
		async ({
			targetTemplateId,
			userEmails,
		}: {
			targetTemplateId: string;
			userEmails?: string[];
		}): Promise<MigrateResult> => {
			const raw = await API.migrateWorkspaces(template.id, {
				target_template_id: targetTemplateId,
				user_emails: userEmails,
			});

			const fetchAll = (ids: string[]) =>
				Promise.all(ids.map((id) => API.getWorkspace(id)));

			const [migrated, skipped] = await Promise.all([
				fetchAll(raw.migrated_workspace_ids),
				fetchAll(raw.skipped_workspace_ids),
			]);

			return { migrated, skipped };
		},
		{
			onSuccess: (data) => {
				displaySuccess(
					`Migrated ${data.migrated.length} workspace(s) successfully.`,
				);
			},
			onError: (err) => {
				displayError(getErrorMessage(err, "Failed to migrate workspaces"));
			},
		},
	);

	const handleSubmit = () => {
		reset();
		const userEmails = userEmailsInput
			.split(",")
			.map((e) => e.trim())
			.filter(Boolean);

		migrate({
			targetTemplateId: targetTemplateId.trim(),
			userEmails: userEmails.length > 0 ? userEmails : undefined,
		});
	};

	return (
		<>
			<Helmet>
				<title>{pageTitle(template.name, "Migrate Workspaces")}</title>
			</Helmet>
			<TemplateMigratePageView
				templateName={template.display_name || template.name}
				targetTemplateId={targetTemplateId}
				onTargetTemplateIdChange={setTargetTemplateId}
				userEmailsInput={userEmailsInput}
				onUserEmailsInputChange={setUserEmailsInput}
				isSubmitting={isSubmitting}
				result={result}
				error={error}
				onSubmit={handleSubmit}
			/>
		</>
	);
};

export default TemplateMigratePage;
