import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import type { Workspace } from "api/typesGenerated";
import { Alert } from "components/Alert/Alert";
import { PageHeader, PageHeaderTitle } from "components/PageHeader/PageHeader";
import type { FC } from "react";

export interface MigrateResult {
	migrated: Workspace[];
	skipped: Workspace[];
}

interface TemplateMigratePageViewProps {
	templateName: string;
	targetTemplateId: string;
	onTargetTemplateIdChange: (value: string) => void;
	userEmailsInput: string;
	onUserEmailsInputChange: (value: string) => void;
	isSubmitting: boolean;
	result: MigrateResult | undefined;
	error: unknown;
	onSubmit: () => void;
}

const WorkspaceTable: FC<{ workspaces: Workspace[]; emptyText: string }> = ({
	workspaces,
	emptyText,
}) => {
	if (workspaces.length === 0) {
		return (
			<p className="text-sm text-content-secondary italic">{emptyText}</p>
		);
	}

	return (
		<Table size="small">
			<TableHead>
				<TableRow>
					<TableCell>Workspace</TableCell>
					<TableCell>Owner</TableCell>
					<TableCell>Email</TableCell>
				</TableRow>
			</TableHead>
			<TableBody>
				{workspaces.map((ws) => (
					<TableRow key={ws.id}>
						<TableCell className="font-mono text-xs">{ws.name}</TableCell>
						<TableCell>{ws.owner_name}</TableCell>
						<TableCell>{ws.owner_email}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
};

export const TemplateMigratePageView: FC<TemplateMigratePageViewProps> = ({
	templateName,
	targetTemplateId,
	onTargetTemplateIdChange,
	userEmailsInput,
	onUserEmailsInputChange,
	isSubmitting,
	result,
	error,
	onSubmit,
}) => {
	return (
		<div>
			<PageHeader css={{ paddingTop: 0 }}>
				<PageHeaderTitle>Migrate Workspaces</PageHeaderTitle>
			</PageHeader>

			<p className="text-sm text-content-secondary mb-6">
				Move all stopped workspaces from{" "}
				<strong className="text-content-primary">{templateName}</strong> to
				another template. Running workspaces will be skipped.
			</p>

			<div className="flex flex-col gap-4 max-w-lg">
				<TextField
					label="Target Template ID"
					placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
					value={targetTemplateId}
					onChange={(e) => onTargetTemplateIdChange(e.target.value)}
					size="small"
					fullWidth
					required
					helperText="The UUID of the template to migrate workspaces into."
				/>

				<TextField
					label="User Emails (optional)"
					placeholder="alice@example.com, bob@example.com"
					value={userEmailsInput}
					onChange={(e) => onUserEmailsInputChange(e.target.value)}
					size="small"
					fullWidth
					multiline
					rows={3}
					helperText="Comma-separated list of user emails. Leave empty to migrate all users' workspaces."
				/>

				{error != null && (
					<Alert severity="error">
						{error instanceof Error ? error.message : String(error)}
					</Alert>
				)}

				<div>
					<Button
						variant="contained"
						color="primary"
						disabled={isSubmitting || targetTemplateId.trim() === ""}
						onClick={onSubmit}
					>
						{isSubmitting ? "Migrating…" : "Migrate Workspaces"}
					</Button>
				</div>
			</div>

			{result != null && (
				<div className="mt-8 flex flex-col gap-6">
					<section>
						<h2 className="text-sm font-semibold text-content-primary mb-2">
							Migrated ({result.migrated.length})
						</h2>
						<WorkspaceTable
							workspaces={result.migrated}
							emptyText="No workspaces were migrated."
						/>
					</section>

					<section>
						<h2 className="text-sm font-semibold text-content-secondary mb-2">
							Skipped — still running ({result.skipped.length})
						</h2>
						<WorkspaceTable
							workspaces={result.skipped}
							emptyText="No workspaces were skipped."
						/>
						{result.skipped.length > 0 && (
							<p className="mt-2 text-xs text-content-secondary">
								Stop these workspaces and run migration again to include them.
							</p>
						)}
					</section>
				</div>
			)}
		</div>
	);
};
