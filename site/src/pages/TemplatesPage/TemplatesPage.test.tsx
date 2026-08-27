import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Template } from "api/typesGenerated";
import type { UseFilterResult } from "components/Filter/Filter";
import { ThemeProvider } from "contexts/ThemeProvider";
import { DashboardContext } from "modules/dashboard/DashboardProvider";
import { act } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import {
	MockAppearanceConfig,
	MockDefaultOrganization,
	MockEntitlements,
	MockExperiments,
	MockTemplate,
} from "testHelpers/entities";
import { TemplatesPageView } from "./TemplatesPageView";

test("create template from scratch", async () => {
	const user = userEvent.setup();
	const router = renderTemplatesPage({
		extraRoutes: [
			{
				path: "/templates/new",
				element: <div data-testid="new-template-page" />,
			},
		],
	});

	const createTemplateButton = await screen.findByRole("button", {
		name: "Create Template",
	});
	await act(async () => {
		await user.click(createTemplateButton);
	});
	const fromScratchMenuItem = await screen.findByText("From scratch");
	await act(async () => {
		await user.click(fromScratchMenuItem);
	});

	await screen.findByTestId("new-template-page");
	expect(router.state.location.pathname).toBe("/templates/new");
	expect(router.state.location.search).toBe("?exampleId=scratch");
});

test("hides the blocked template from non-admin users", async () => {
	renderTemplatesPage({
		templates: heaanTemplates,
		hideBlockedTemplates: true,
	});

	await screen.findByText("Visible Template");
	expect(
		screen.queryByText("HEAAN2-0.1.1 Playground (A100)"),
	).not.toBeInTheDocument();
});

test("shows the blocked template to admins", async () => {
	renderTemplatesPage({
		templates: heaanTemplates,
		hideBlockedTemplates: false,
	});

	await screen.findByText("Visible Template");
	expect(
		await screen.findByText("HEAAN2-0.1.1 Playground (A100)"),
	).toBeInTheDocument();
});

const heaanTemplates = [
	{
		...MockTemplate,
		id: "blocked-heaan2-011",
		name: "heaan2-011-a100",
		display_name: "HEAAN2-0.1.1 Playground (A100)",
	},
	{
		...MockTemplate,
		id: "visible-heaan2-020",
		name: "heaan2-020-a100",
		display_name: "Visible Template",
	},
];

const renderTemplatesPage = ({
	templates = [MockTemplate],
	hideBlockedTemplates = false,
	extraRoutes = [],
}: {
	templates?: Template[];
	hideBlockedTemplates?: boolean;
	extraRoutes?: Parameters<typeof createMemoryRouter>[0];
} = {}) => {
	const router = createMemoryRouter(
		[
			{
				path: "/templates",
				element: (
					<TemplatesPageView
						error={undefined}
						filter={mockFilter}
						showOrganizations={false}
						canCreateTemplates={true}
						examples={[]}
						templates={templates}
						hideBlockedTemplates={hideBlockedTemplates}
					/>
				),
			},
			...extraRoutes,
		],
		{ initialEntries: ["/templates"] },
	);
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				cacheTime: 0,
				refetchOnWindowFocus: false,
			},
		},
	});

	render(
		<HelmetProvider>
			<QueryClientProvider client={queryClient}>
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
						<RouterProvider router={router} />
					</DashboardContext.Provider>
				</ThemeProvider>
			</QueryClientProvider>
		</HelmetProvider>,
	);

	return router;
};

const mockFilter = {
	query: "deprecated:false",
	values: { deprecated: "false" },
	update: jest.fn(),
	debounceUpdate: jest.fn(),
	cancelDebounce: jest.fn(),
	used: false,
} satisfies UseFilterResult;
