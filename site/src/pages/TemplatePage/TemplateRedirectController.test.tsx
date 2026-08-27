import { render, waitFor } from "@testing-library/react";
import { AuthContext } from "contexts/auth/AuthProvider";
import type { Permissions } from "contexts/auth/permissions";
import { DashboardContext } from "modules/dashboard/DashboardProvider";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import * as M from "testHelpers/entities";
import { TemplateRedirectController } from "./TemplateRedirectController";

const renderTemplateRedirectController = (
	route: string,
	options: {
		permissionOverrides?: Partial<Permissions>;
		showOrganizations?: boolean;
		organizations?: (typeof M.MockDefaultOrganization)[];
	} = {},
) => {
	const router = createMemoryRouter(
		[
			{
				path: "/templates/:organization?/:template",
				element: <TemplateRedirectController />,
			},
			{
				path: "/templates",
				element: <div />,
			},
		],
		{ initialEntries: [route] },
	);

	render(
		<AuthContext.Provider
			value={{
				isLoading: false,
				isSignedOut: false,
				isSigningOut: false,
				isConfiguringTheFirstUser: false,
				isSignedIn: true,
				isSigningIn: false,
				isUpdatingProfile: false,
				user: M.MockUser,
				permissions: {
					...M.MockPermissions,
					...options.permissionOverrides,
				},
				signInError: undefined,
				updateProfileError: undefined,
				signOut: jest.fn(),
				signIn: jest.fn(),
				updateProfile: jest.fn(),
			}}
		>
			<DashboardContext.Provider
				value={{
					entitlements: M.MockEntitlements,
					experiments: M.MockExperiments,
					appearance: M.MockAppearanceConfig,
					organizations: options.organizations ?? [M.MockDefaultOrganization],
					showOrganizations: options.showOrganizations ?? false,
				}}
			>
				<RouterProvider router={router} />
			</DashboardContext.Provider>
		</AuthContext.Provider>,
	);

	return { router };
};

it("redirects from multi-org to single-org", async () => {
	const { router } = renderTemplateRedirectController(
		`/templates/${M.MockTemplate.organization_name}/${M.MockTemplate.name}`,
	);

	await waitFor(() =>
		expect(router.state.location.pathname).toEqual(
			`/templates/${M.MockTemplate.name}`,
		),
	);
});

it("redirects from single-org to multi-org", async () => {
	const { router } = renderTemplateRedirectController(
		`/templates/${M.MockTemplate.name}`,
		{
			organizations: [M.MockDefaultOrganization, M.MockOrganization2],
			showOrganizations: true,
		},
	);

	await waitFor(() =>
		expect(router.state.location.pathname).toEqual(
			`/templates/${M.MockDefaultOrganization.name}/${M.MockTemplate.name}`,
		),
	);
});

it.each(["/templates/heaan-playground", "/templates/heaan2-playground-011"])(
	"redirects non-admins from blocked template URL %s",
	async (route) => {
		const { router } = renderTemplateRedirectController(route, {
			permissionOverrides: { deleteTemplates: false },
		});

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/templates"),
		);
	},
);

it.each(["/templates/heaan-playground", "/templates/heaan2-playground-011"])(
	"allows admins to open blocked template URL %s",
	async (route) => {
		const { router } = renderTemplateRedirectController(route, {
			permissionOverrides: { deleteTemplates: true },
		});

		await waitFor(() => expect(router.state.location.pathname).toBe(route));
	},
);
