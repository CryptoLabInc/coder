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

	it("hides the blocked template name from the new workspace menu", async () => {
		jest.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
		const blockedTemplate: Template = {
			...MockTemplate,
			id: "heaan2-011-a100",
			name: "HEAAN2-0.1.1-playground-a100",
			display_name: "Blocked A100 template",
			active_user_count: 119,
		};
		const enabledTemplate: Template = {
			...MockTemplate,
			id: "heaan2-current-a100",
			name: "heaan2-current-playground-a100",
			display_name: "HEAAN2-0.1.1 Playground (A100)",
			active_user_count: 42,
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

		expect(screen.queryByText("Blocked A100 template")).not.toBeInTheDocument();
		expect(
			screen.getByText("HEAAN2-0.1.1 Playground (A100)").closest("a"),
		).toHaveAttribute(
			"href",
			"/templates/heaan2-current-playground-a100/workspace",
		);
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
