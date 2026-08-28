import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Template } from "api/typesGenerated";
import { ThemeProvider } from "contexts/ThemeProvider";
import { DashboardContext } from "modules/dashboard/DashboardProvider";
import { type ComponentProps, act } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import {
	MockAppearanceConfig,
	MockDefaultOrganization,
	MockEntitlements,
	MockExperiments,
	MockTemplate,
	MockWorkspace,
} from "testHelpers/entities";
import { WorkspacesPageView } from "./WorkspacesPageView";

jest.mock("components/Filter/UserFilter", () => ({
	UserMenu: () => null,
}));

describe("WorkspacesPageView", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("hides blocked templates from the empty workspaces suggestions", () => {
		const blockedTemplate: Template = {
			...MockTemplate,
			id: "heaan2-011-a100",
			name: "heaan2-011-a100",
			display_name: "HEAAN2-0.1.1 Playground (A100)",
		};
		const enabledTemplate: Template = {
			...MockTemplate,
			id: "heaan2-020-a100",
			name: "heaan2-020-a100",
			display_name: "HEaaN2-0.2.0 Playground (A100)",
		};

		renderWorkspacesPageView({
			templates: [blockedTemplate, enabledTemplate],
			workspaces: [],
			count: 0,
			hideBlockedTemplates: true,
		});

		expect(
			screen.queryByText("HEAAN2-0.1.1 Playground (A100)"),
		).not.toBeInTheDocument();
		expect(
			screen.getByText("HEaaN2-0.2.0 Playground (A100)").closest("a"),
		).toHaveAttribute("href", "/templates/heaan2-020-a100/workspace");
	});

	it("keeps blocked templates in the new workspace menu when filtering is disabled", async () => {
		jest.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
		const blockedTemplate: Template = {
			...MockTemplate,
			id: "heaan2-011-a100",
			name: "heaan2-011-a100",
			display_name: "HEAAN2-0.1.1 Playground (A100)",
		};

		renderWorkspacesPageView({
			templates: [blockedTemplate],
			workspaces: [MockWorkspace],
			count: 1,
			hideBlockedTemplates: false,
		});

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

type WorkspacesPageViewProps = ComponentProps<typeof WorkspacesPageView>;

const menu = {
	initialOption: undefined,
	isInitializing: false,
	isSearching: false,
	query: "",
	searchOptions: [],
	selectedOption: undefined,
	selectOption: jest.fn(),
	setQuery: jest.fn(),
};

const filterProps: WorkspacesPageViewProps["filterProps"] = {
	filter: {
		query: "owner:me",
		update: jest.fn(),
		debounceUpdate: jest.fn(),
		cancelDebounce: jest.fn(),
		used: false,
		values: {
			owner: "me",
			status: undefined,
			template: undefined,
		},
	},
	menus: {
		user: menu,
		template: menu,
		status: menu,
		organizations: menu,
	},
};

function renderWorkspacesPageView(
	overrides: Partial<WorkspacesPageViewProps> = {},
) {
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
					router={createMemoryRouter(
						[
							{
								path: "/",
								element: (
									<WorkspacesPageView
										error={undefined}
										checkedWorkspaces={[]}
										count={0}
										filterProps={filterProps}
										page={1}
										limit={25}
										onPageChange={jest.fn()}
										onUpdateWorkspace={jest.fn()}
										onCheckChange={jest.fn()}
										isRunningBatchAction={false}
										onDeleteAll={jest.fn()}
										onUpdateAll={jest.fn()}
										onStartAll={jest.fn()}
										onStopAll={jest.fn()}
										canCheckWorkspaces={false}
										templatesFetchStatus="success"
										templates={[]}
										canCreateTemplate={false}
										canChangeVersions={false}
										{...overrides}
									/>
								),
							},
						],
						{ initialEntries: ["/"] },
					)}
				/>
			</DashboardContext.Provider>
		</ThemeProvider>,
	);
}
