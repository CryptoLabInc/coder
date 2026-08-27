import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Template } from "api/typesGenerated";
import { ThemeProvider } from "contexts/ThemeProvider";
import { DashboardContext } from "modules/dashboard/DashboardProvider";
import { act } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import {
	MockAppearanceConfig,
	MockDefaultOrganization,
	MockEntitlements,
	MockExperiments,
	MockTemplate,
} from "testHelpers/entities";
import { WorkspacesButton } from "./WorkspacesButton";

describe("WorkspacesButton", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("hides the blocked template display name from the new workspace menu", async () => {
		jest.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
		const blockedTemplate: Template = {
			...MockTemplate,
			id: "heaan2-011-a100",
			name: "heaan2-011-a100",
			display_name: "HEAAN2-0.1.1 Playground (A100)",
			active_user_count: 120,
		};
		const enabledTemplate: Template = {
			...MockTemplate,
			id: "heaan2-020-a100",
			name: "heaan2-020-a100",
			display_name: "HEaaN2-0.2.0 Playground (A100)",
			active_user_count: 101,
		};

		renderWorkspacesButton(
			<WorkspacesButton
				templates={[blockedTemplate, enabledTemplate]}
				templatesFetchStatus="success"
			>
				New workspace
			</WorkspacesButton>,
		);

		await act(async () => {
			await user.click(screen.getByRole("button", { name: /new workspace/i }));
		});
		await act(async () => {
			jest.runOnlyPendingTimers();
		});

		expect(
			screen.queryByText("HEAAN2-0.1.1 Playground (A100)"),
		).not.toBeInTheDocument();
		expect(
			screen.getByText("HEaaN2-0.2.0 Playground (A100)").closest("a"),
		).toHaveAttribute("href", "/templates/heaan2-020-a100/workspace");
	});

	it("shows the blocked template when blocked template filtering is disabled", async () => {
		jest.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
		const blockedTemplate: Template = {
			...MockTemplate,
			id: "heaan2-011-a100",
			name: "heaan2-011-a100",
			display_name: "HEAAN2-0.1.1 Playground (A100)",
			active_user_count: 120,
		};

		renderWorkspacesButton(
			<WorkspacesButton
				templates={[blockedTemplate]}
				templatesFetchStatus="success"
				hideBlockedTemplates={false}
			>
				New workspace
			</WorkspacesButton>,
		);

		await act(async () => {
			await user.click(screen.getByRole("button", { name: /new workspace/i }));
		});
		await act(async () => {
			jest.runOnlyPendingTimers();
		});

		expect(
			screen.getByText("HEAAN2-0.1.1 Playground (A100)").closest("a"),
		).toHaveAttribute("href", "/templates/heaan2-011-a100/workspace");
	});
});

function renderWorkspacesButton(element: JSX.Element) {
	render(
		<ThemeProvider>
			<DashboardContext.Provider
				value={{
					entitlements: MockEntitlements,
					experiments: MockExperiments,
					appearance: MockAppearanceConfig,
					organizations: [MockDefaultOrganization],
					showOrganizations: false,
				}}
			>
				<RouterProvider
					router={createMemoryRouter([{ path: "/", element }], {
						initialEntries: ["/"],
					})}
				/>
			</DashboardContext.Provider>
		</ThemeProvider>,
	);
}
